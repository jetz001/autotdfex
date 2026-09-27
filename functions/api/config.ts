// Cloudflare Pages Function: autoTDFex Cloud Sync Config
// Powered by Cloudflare D1 Database + KV Fallback
// Futures-specific config with leverage, hedge mode, cross margin

interface Env {
  DB?: D1Database;
  AUTOTD_KV?: KVNamespace;
  BITGET_API_KEY?: string;
  BITGET_SECRET_KEY?: string;
  BITGET_PASSPHRASE?: string;
  OPENROUTER_API_KEY?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

let memoryConfigCache: any = null;
let lastCacheReadTime = 0;
const CACHE_TTL_MS = 30000;

const CORE_SETTINGS_KEYS = [
  "apiKey",
  "secretKey",
  "passphrase",
  "openrouterApiKey",
  "isPaperTrading",
  "autoPilotEnabled",
  "tranchePercent",
  "takeProfitPercent",
  "cutLossPercent",
  "maxTranches",
  "maxCoins",
  "cashReservePercent",
  "autoRebalanceEnabled",
  "leverage",
  "positionMode",
  "marginMode",
];

function getBaseDefaults(env: Env) {
  return {
    apiKey: env.BITGET_API_KEY || "",
    secretKey: env.BITGET_SECRET_KEY || "",
    passphrase: env.BITGET_PASSPHRASE || "",
    openrouterApiKey: env.OPENROUTER_API_KEY || "",
    isPaperTrading: false,
    autoPilotEnabled: true,
    tranchePercent: 20,
    takeProfitPercent: 3.5,
    cutLossPercent: 5.0,
    maxTranches: 4,
    maxCoins: 4,
    cashReservePercent: 30,
    autoRebalanceEnabled: true,
    // Futures-specific defaults
    leverage: 5,
    positionMode: "hedge",
    marginMode: "crossed",
    paperBalance: 10000,
    positions: [],
    livePositions: [],
    quantLogs: [],
    liveLogs: [],
  };
}

async function readConfig(env: Env): Promise<any> {
  const now = Date.now();
  if (memoryConfigCache && now - lastCacheReadTime < CACHE_TTL_MS) {
    return memoryConfigCache;
  }

  let sharedBase: any = {};
  let futuresSaved: any = {};

  if (env.DB) {
    try {
      const userRow = await env.DB.prepare("SELECT value FROM config WHERE key = ?")
        .bind("user_config")
        .first<{ value: string }>();
      if (userRow?.value) sharedBase = JSON.parse(userRow.value);

      const futuresRow = await env.DB.prepare("SELECT value FROM config WHERE key = ?")
        .bind("futures_config")
        .first<{ value: string }>();
      if (futuresRow?.value) futuresSaved = JSON.parse(futuresRow.value);
    } catch (e) {
      console.warn("D1 read error:", e);
    }
  }

  if (env.AUTOTD_KV) {
    try {
      if (Object.keys(sharedBase).length === 0) {
        const raw = await env.AUTOTD_KV.get("user_config");
        if (raw) sharedBase = JSON.parse(raw);
      }
      if (Object.keys(futuresSaved).length === 0) {
        const rawF = await env.AUTOTD_KV.get("futures_config");
        if (rawF) futuresSaved = JSON.parse(rawF);
      }
    } catch (e) {
      console.warn("KV read error:", e);
    }
  }

  // Fallback: inherit live credentials directly from AutoTD Cloudflare Pages
  if (!sharedBase?.apiKey && !futuresSaved?.apiKey) {
    try {
      const res = await fetch("https://autotd.pages.dev/api/config");
      if (res.ok) {
        const json = (await res.json()) as any;
        if (json?.data?.apiKey) {
          sharedBase = {
            apiKey: json.data.apiKey,
            secretKey: json.data.secretKey,
            passphrase: json.data.passphrase,
            openrouterApiKey: json.data.openrouterApiKey,
          };
        }
      }
    } catch {}
  }

  const combined = {
    ...sharedBase,
    ...futuresSaved,
    apiKey: futuresSaved?.apiKey || sharedBase?.apiKey || "",
    secretKey: futuresSaved?.secretKey || sharedBase?.secretKey || "",
    passphrase: futuresSaved?.passphrase || sharedBase?.passphrase || "",
    openrouterApiKey: futuresSaved?.openrouterApiKey || sharedBase?.openrouterApiKey || "",
  };

  memoryConfigCache = combined;
  lastCacheReadTime = now;
  return combined;
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const baseDefaults = getBaseDefaults(env);
  const savedConfig = await readConfig(env);

  const merged = {
    ...baseDefaults,
    ...(savedConfig || {}),
    apiKey: savedConfig?.apiKey || baseDefaults.apiKey,
    secretKey: savedConfig?.secretKey || baseDefaults.secretKey,
    passphrase: savedConfig?.passphrase || baseDefaults.passphrase,
    openrouterApiKey: savedConfig?.openrouterApiKey || baseDefaults.openrouterApiKey,
  };

  return Response.json(
    {
      code: "00000",
      msg: "success",
      data: merged,
      storage: env.DB ? "Cloudflare D1" : "Memory/KV",
    },
    { headers: corsHeaders }
  );
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const baseDefaults = getBaseDefaults(env);

  try {
    const body = (await request.json()) as any;
    let currentSaved: any = memoryConfigCache || {};

    if (Object.keys(currentSaved).length === 0) {
      const fromStore = await readConfig(env);
      if (fromStore) currentSaved = fromStore;
    }

    const merged = {
      ...baseDefaults,
      ...currentSaved,
      ...body,
      apiKey: body.apiKey || currentSaved.apiKey || baseDefaults.apiKey,
      secretKey: body.secretKey || currentSaved.secretKey || baseDefaults.secretKey,
      passphrase: body.passphrase || currentSaved.passphrase || baseDefaults.passphrase,
      openrouterApiKey: body.openrouterApiKey || currentSaved.openrouterApiKey || baseDefaults.openrouterApiKey,
    };

    memoryConfigCache = merged;
    lastCacheReadTime = Date.now();

    // PRIMARY: Write to D1 (key: futures_config)
    if (env.DB) {
      try {
        await env.DB.prepare(
          "INSERT INTO config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
        ).bind("futures_config", JSON.stringify(merged)).run();

        // Also sync credentials to user_config if provided
        if (body.apiKey && body.secretKey) {
          try {
            await env.DB.prepare(
              "INSERT INTO config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = json_patch(value, ?), updated_at = CURRENT_TIMESTAMP"
            ).bind("user_config", JSON.stringify(merged), JSON.stringify({
              apiKey: body.apiKey,
              secretKey: body.secretKey,
              passphrase: body.passphrase || "",
              openrouterApiKey: body.openrouterApiKey || ""
            })).run();
          } catch {}
        }

        const logsToInsert = Array.isArray(body.liveLogs) ? body.liveLogs : Array.isArray(body.quantLogs) ? body.quantLogs : [];
        if (logsToInsert.length > 0) {
          const latest = logsToInsert[0];
          if (latest?.id) {
            await env.DB.prepare(
              "INSERT OR IGNORE INTO quant_logs (id, time, action, symbol, note, color, is_paper) VALUES (?, ?, ?, ?, ?, ?, ?)"
            ).bind(
              latest.id,
              latest.time || "",
              `[FUTURES] ${latest.action || ""}`,
              latest.symbol || "",
              latest.note || "",
              latest.color || "",
              merged.isPaperTrading ? 1 : 0
            ).run();
          }
        }
      } catch (e) {
        console.warn("D1 write error:", e);
      }
    }

    // SECONDARY: KV for core settings (key: futures_config)
    if (env.AUTOTD_KV && !env.DB) {
      try {
        const coreSettings: Record<string, any> = {};
        for (const key of CORE_SETTINGS_KEYS) {
          coreSettings[key] = merged[key];
        }
        await env.AUTOTD_KV.put("futures_config", JSON.stringify(coreSettings));
      } catch (e) {
        console.warn("KV write error:", e);
      }
    }

    return Response.json(
      {
        code: "00000",
        msg: "Config synced to Cloudflare D1 successfully",
        data: merged,
        storage: env.DB ? "Cloudflare D1" : "Memory/KV",
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return Response.json(
      { code: "40000", msg: err.message },
      { status: 400, headers: corsHeaders }
    );
  }
};
