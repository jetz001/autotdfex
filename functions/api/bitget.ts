// Cloudflare Pages Function: Bitget USDT-M Perpetual Futures Proxy
// Built with native Web Crypto API (crypto.subtle) - 100% native Edge compatible, zero node modules

const BITGET_HOST = "https://api.bitget.com";
const PRODUCT_TYPE = "USDT-FUTURES";

interface Env {
  DB?: D1Database;
  AUTOTD_KV?: KVNamespace;
  BITGET_API_KEY?: string;
  BITGET_SECRET_KEY?: string;
  BITGET_PASSPHRASE?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-bitget-key, x-bitget-secret, x-bitget-passphrase",
};

async function signBitgetRequest(
  timestamp: string,
  method: string,
  requestPath: string,
  queryString: string,
  body: string,
  secretKey: string
): Promise<string> {
  const message = timestamp + method.toUpperCase() + requestPath + (queryString ? `?${queryString}` : "") + (body || "");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function getCredentials(req: Request, env: Env) {
  let apiKey = req.headers.get("x-bitget-key") || env.BITGET_API_KEY || "";
  let secretKey = req.headers.get("x-bitget-secret") || env.BITGET_SECRET_KEY || "";
  let passphrase = req.headers.get("x-bitget-passphrase") || env.BITGET_PASSPHRASE || "";

  if ((!apiKey || !secretKey) && env.DB) {
    try {
      const row = await env.DB.prepare("SELECT value FROM config WHERE key = ?")
        .bind("user_config")
        .first<{ value: string }>();
      if (row?.value) {
        const parsed = JSON.parse(row.value);
        if (parsed.apiKey) apiKey = parsed.apiKey;
        if (parsed.secretKey) secretKey = parsed.secretKey;
        if (parsed.passphrase) passphrase = parsed.passphrase;
      }
    } catch {}
  }

  return { apiKey, secretKey, passphrase };
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};

// GET: Query Real Futures Balance, Positions, Orders, History
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const { apiKey, secretKey, passphrase } = await getCredentials(request, env);

  if (!apiKey || !secretKey || !passphrase) {
    return Response.json(
      { code: "40001", msg: "Missing Bitget API credentials (Not configured in Cloudflare or headers)" },
      { status: 400, headers: corsHeaders }
    );
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "balance";

  try {
    let requestPath = "/api/v2/mix/account/accounts";
    let queryString = `productType=${PRODUCT_TYPE}`;

    if (action === "balance" || action === "assets" || action === "wallet") {
      requestPath = "/api/v2/mix/account/accounts";
      queryString = `productType=${PRODUCT_TYPE}`;
    } else if (action === "positions") {
      requestPath = "/api/v2/mix/position/all-position";
      queryString = `productType=${PRODUCT_TYPE}&marginCoin=USDT`;
    } else if (action === "orders") {
      const symbol = searchParams.get("symbol") || "";
      requestPath = "/api/v2/mix/order/current";
      queryString = `productType=${PRODUCT_TYPE}${symbol ? `&symbol=${symbol}` : ""}`;
    } else if (action === "history") {
      const symbol = searchParams.get("symbol") || "";
      requestPath = "/api/v2/mix/order/history";
      queryString = `productType=${PRODUCT_TYPE}${symbol ? `&symbol=${symbol}` : ""}&limit=50`;
    }

    const timestamp = Date.now().toString();
    const sign = await signBitgetRequest(timestamp, "GET", requestPath, queryString, "", secretKey);

    const res = await fetch(`${BITGET_HOST}${requestPath}?${queryString}`, {
      headers: {
        "ACCESS-KEY": apiKey,
        "ACCESS-SIGN": sign,
        "ACCESS-TIMESTAMP": timestamp,
        "ACCESS-PASSPHRASE": passphrase,
        "Content-Type": "application/json",
        locale: "en-US",
      },
      cache: "no-store",
    });

    const data = await res.json();
    return Response.json(data, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ code: "50000", msg: error.message }, { status: 500, headers: corsHeaders });
  }
};

// POST: Place Futures Order, Set Leverage, Close Positions
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const { apiKey, secretKey, passphrase } = await getCredentials(request, env);

  if (!apiKey || !secretKey || !passphrase) {
    return Response.json(
      { code: "40001", msg: "Missing Bitget API credentials" },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const payload = (await request.json()) as any;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || payload.action || "order";

    let requestPath = "/api/v2/mix/order/place-order";
    if (action === "leverage") {
      requestPath = "/api/v2/mix/account/set-leverage";
    } else if (action === "close") {
      requestPath = "/api/v2/mix/order/close-positions";
    }

    const bodyStr = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const sign = await signBitgetRequest(timestamp, "POST", requestPath, "", bodyStr, secretKey);

    const res = await fetch(`${BITGET_HOST}${requestPath}`, {
      method: "POST",
      headers: {
        "ACCESS-KEY": apiKey,
        "ACCESS-SIGN": sign,
        "ACCESS-TIMESTAMP": timestamp,
        "ACCESS-PASSPHRASE": passphrase,
        "Content-Type": "application/json",
        locale: "en-US",
      },
      body: bodyStr,
    });

    const data = await res.json();
    return Response.json(data, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ code: "50000", msg: error.message }, { status: 500, headers: corsHeaders });
  }
};
