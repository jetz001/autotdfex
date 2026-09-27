// Cloudflare Pages Function: OpenRouter AI Agent for autoTDFex Futures
// Supports multi-tier free model fallback for Long/Short/Hold decisions

interface Env {
  OPENROUTER_API_KEY?: string;
  AI_API_KEY?: string;
}

export const DEFAULT_FREE_MODELS = [
  "inclusionai/ling-3.0-flash-fin:free",
  "inclusionai/ling-3.0-flash-sante:free",
  "qwen/qwen3.8-27b:free",
  "dots-studio/dots-3-note-preview:free",
  "liquid/lfm-2.5-2.6b:free",
  "nvidia/nemotron-3.5-lightning:free",
  "thinkingmachines/inkling-small:free",
  "poolside/laguna-s-2.1:free",
];

let cachedFreeModels: string[] = [...DEFAULT_FREE_MODELS];
let lastModelsFetchTime = 0;
const CACHE_TTL_MS = 3600 * 1000;

async function getLiveFreeModels(apiKey?: string): Promise<string[]> {
  const now = Date.now();
  if (cachedFreeModels.length >= 3 && now - lastModelsFetchTime < CACHE_TTL_MS) {
    return cachedFreeModels;
  }
  try {
    const headers: Record<string, string> = { "User-Agent": "autoTDFex-FuturesBot/1.0" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const res = await fetch("https://openrouter.ai/api/v1/models", { headers });
    if (!res.ok) return cachedFreeModels;
    const json = (await res.json()) as any;
    if (!Array.isArray(json?.data)) return cachedFreeModels;
    const freeModels = json.data
      .filter((m: any) => m?.id?.endsWith(":free") && !m.id.toLowerCase().includes("safety"))
      .sort((a: any, b: any) => (b.created || 0) - (a.created || 0))
      .map((m: any) => m.id);
    if (freeModels.length >= 3) {
      cachedFreeModels = freeModels.slice(0, 8);
      lastModelsFetchTime = now;
    }
  } catch {}
  return cachedFreeModels;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-openrouter-key, Authorization",
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const aiKey =
    request.headers.get("x-openrouter-key") ||
    (env as any).OPENROUTER_API_KEY ||
    (env as any).AI_API_KEY;

  if (request.method === "GET") {
    const liveModels = await getLiveFreeModels(aiKey || undefined);
    return Response.json({ status: "READY", hasKey: Boolean(aiKey), availableFreeModels: liveModels }, { headers: corsHeaders });
  }

  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  let body: any = {};
  try { body = await request.json(); } catch {
    return Response.json({ code: "40000", msg: "Invalid JSON" }, { status: 400, headers: corsHeaders });
  }

  const effectiveKey = aiKey || body.apiKey;
  if (!effectiveKey) {
    return Response.json({ code: "40001", msg: "Missing OpenRouter API Key" }, { status: 400, headers: corsHeaders });
  }

  const { symbol = "BTCUSDT", currentPrice = 0, change24h = 0, rsi15m = 50, aiScore = 80, fundingRate = 0, recentCandles = [] } = body;

  const prompt = `You are the Chief Quantitative AI Trading Agent for Bitget USDT-M Perpetual Futures (autoTDFex system).
Evaluate this Futures trading candidate with Two-way Hedge Mode (can go Long or Short):
- Symbol: ${symbol}
- Current Mark Price: $${currentPrice}
- 24h Change: ${change24h}%
- 15m RSI: ${rsi15m}
- Quant Multi-Factor Score: ${aiScore}/100
- Current Funding Rate: ${(fundingRate * 100).toFixed(4)}% (positive = longs pay shorts)
- Recent 15m Candles (OHLCV): ${JSON.stringify(recentCandles.slice(-5))}

Trading Mandate (5x Cross Leverage, Hedge Mode):
1. If RSI < 45 AND trend is down AND funding rate is positive (squeezed longs), recommend SHORT.
2. If RSI < 40 AND pullback in uptrend (Dip-in-Uptrend), recommend LONG with high confidence.
3. If market is sideways or unclear, recommend HOLD.
4. Keep reason analytical, max 2 sentences.

Respond ONLY with valid JSON:
{
  "action": "LONG" | "SHORT" | "HOLD",
  "confidence": number (60-95),
  "reason": "1-2 sentence rationalization",
  "stopLossPrice": number,
  "takeProfitPrice": number
}`;

  const modelsToTry = await getLiveFreeModels(effectiveKey);
  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${effectiveKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://autotdfex.pages.dev",
          "X-Title": "autoTDFex Futures Bot",
        },
        body: JSON.stringify({
          model,
          models: modelsToTry.slice(i, i + 3),
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        lastError = new Error(`HTTP ${res.status}: ${errBody}`);
        continue;
      }

      const data = (await res.json()) as any;
      const content = data.choices?.[0]?.message?.content;
      if (!content) { lastError = new Error("Empty response"); continue; }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);

      return Response.json(
        {
          code: "00000",
          msg: "success",
          data: {
            action: parsed.action || "HOLD",
            confidence: Number(parsed.confidence) || 75,
            reason: parsed.reason || "AI evaluated market conditions",
            modelUsed: model,
            symbol,
            price: currentPrice,
          },
        },
        { headers: corsHeaders }
      );
    } catch (err: any) {
      lastError = err;
    }
  }

  // Heuristic Quant Rule Engine (Fallback when OpenRouter free tier hits daily limit)
  const positionPnl = typeof body.pnlPercent === "number" ? body.pnlPercent : null;
  let fallbackAction = "HOLD";
  let fallbackReason = `[Quant Rule Engine] Score ${aiScore}/100, RSI ${rsi15m}: รอสัญญาณที่ชัดเจน`;
  let fallbackConfidence = 50;

  // 1. Position Close Rules (Take Profit / Cut Loss)
  if (positionPnl !== null) {
    if (positionPnl >= 3.5) {
      fallbackAction = "CLOSE_PROFIT";
      fallbackReason = `[Quant Auto-TP] Position PnL +${positionPnl.toFixed(2)}% >= +3.5%: ถึงเป้าหมาย ทำกำไรทันที`;
      fallbackConfidence = 95;
    } else if (positionPnl <= -5.0) {
      fallbackAction = "CUT_LOSS";
      fallbackReason = `[Quant Auto-SL] Position PnL ${positionPnl.toFixed(2)}% <= -5.0%: ถึงจุดตัดขาดทุน รักษาเงินต้น`;
      fallbackConfidence = 95;
    }
  }
  // 2. Open SHORT Signal (Overbought / Dip from peak / High positive change)
  else if (aiScore >= 75 && (rsi15m >= 62 || (change24h >= 5 && rsi15m >= 55))) {
    fallbackAction = "SHORT";
    fallbackReason = `[Quant Rule Engine] Overbought Signal: Score ${aiScore}/100, RSI 15m ${rsi15m}, 24h Change +${change24h}% — เปิด SHORT ดักย่อ`;
    fallbackConfidence = 85;
  }
  // 3. Open LONG Signal (Dip in Uptrend)
  else if (aiScore >= 75 && rsi15m <= 45 && change24h > 0) {
    fallbackAction = "LONG";
    fallbackReason = `[Quant Rule Engine] Dip in Uptrend: Score ${aiScore}/100, RSI 15m ${rsi15m}, 24h Change +${change24h}% — เปิด LONG ตามเทรนด์`;
    fallbackConfidence = 85;
  }

  return Response.json(
    {
      code: "00000",
      msg: "quant_rule_engine",
      data: {
        action: fallbackAction,
        confidence: fallbackConfidence,
        reason: fallbackReason,
        modelUsed: "heuristic_quant_engine",
        symbol,
        price: currentPrice,
        openRouterDiagnostic: lastError ? lastError.message : "all_models_attempted",
      },
    },
    { headers: corsHeaders }
  );
};
