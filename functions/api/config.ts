// Cloudflare Pages Function: autoTDFex Cloud Sync Config
// Powered by Cloudflare D1 Database + KV Fallback
// Futures-specific config with leverage, hedge mode, cross margin

interface Env {
  DB?: D1Database;
  AUTOTDFEX_KV?: KVNamespace;
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

  if (env.DB) {
    try {
      const row = await env.DB.prepare("SELECT value FROM config WHERE key = ?")
        .bind("user_config")
        .first<{ value: string }>();
      if (row?.value) {
        const parsed = JSON.parse(row.value);
        memoryConfigCache = parsed;
        lastCacheReadTime = now;
        return parsed;
      }
    } catch (e) {
      console.warn("D1 read error:", e);
    }
  }

  if (env.AUTOTDFEX_KV) {
    try {
      const raw = await env.AUTOTDFEX_KV.get("user_config");
      if (raw) {
        const parsed = JSON.parse(raw);
        memoryConfigCache = parsed;
        lastCacheReadTime = now;
        return parsed;
      }
    } catch (e) {
      console.warn("KV read error:", e);
    }
  }

  return memoryConfigCache || null;
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

    // PRIMARY: Write to D1
    if (env.DB) {
      try {
        await env.DB.prepare(
          "INSERT INTO config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
        ).bind("user_config", JSON.stringify(merged)).run();

        const logsToInsert = Array.isArray(body.liveLogs) ? body.liveLogs : Array.isArray(body.quantLogs) ? body.quantLogs : [];
        if (logsToInsert.length > 0) {
          const latest = logsToInsert[0];
          if (latest?.id) {
            await env.DB.prepare(
              "INSERT OR IGNORE INTO quant_logs (id, time, action, symbol, note, color, is_paper) VALUES (?, ?, ?, ?, ?, ?, ?)"
            ).bind(
              latest.id,
              latest.time || "",
              latest.action || "",
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

    // SECONDARY: KV for core settings only
    if (env.AUTOTDFEX_KV && !env.DB) {
      try {
        const coreSettings: Record<string, any> = {};
        for (const key of CORE_SETTINGS_KEYS) {
          coreSettings[key] = merged[key];
        }
        await env.AUTOTDFEX_KV.put("user_config", JSON.stringify(coreSettings));
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
