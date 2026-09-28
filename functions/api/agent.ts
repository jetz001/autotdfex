// Cloudflare Pages Function: Groq & OpenRouter AI Autonomous Futures Agent
// Tier 1: Groq High-Speed LPU Inference (Primary — Sub-second latency)
// Tier 2: OpenRouter Dynamic Free Models Auto-Fallback (Secondary)
// Tier 3: Heuristic Quant Multi-Factor Rule Engine (Guaranteed Safeguard)

interface Env {
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  AI_API_KEY?: string;
}

export const GROQ_MODELS = [
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "allam-2-7b",
];

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

let aiRateLimitState = {
  isLimited: false,
  limitedAt: "",
  resumeAt: "",
  resumeTimestamp: 0,
  provider: "",
};

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
  "Access-Control-Allow-Headers": "Content-Type, x-groq-key, x-openrouter-key, Authorization",
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const groqKey =
    request.headers.get("x-groq-key") ||
    (env as any).GROQ_API_KEY ||
    (env as any).GROQ_KEY ||
    (env as any).AI_GROQ_KEY;

  const openrouterKey =
    request.headers.get("x-openrouter-key") ||
    (env as any).OPENROUTER_API_KEY ||
    (env as any).AI_API_KEY;

  if (request.method === "GET") {
    const liveModels = await getLiveFreeModels(openrouterKey || undefined);
    return Response.json(
      {
        status: "READY",
        primaryProvider: "groq",
        hasGroqKey: Boolean(groqKey),
        hasOpenRouterKey: Boolean(openrouterKey),
        groqModels: GROQ_MODELS,
        fallbackFreeModels: liveModels,
      },
      { headers: corsHeaders }
    );
  }

  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "40000", msg: "Invalid JSON" }, { status: 400, headers: corsHeaders });
  }

  const effectiveGroqKey = body.groqApiKey || groqKey;
  const effectiveOpenrouterKey = body.openrouterApiKey || body.apiKey || openrouterKey;

  const {
    symbol = "BTCUSDT",
    currentPrice = 0,
    change24h = 0,
    rsi15m = 50,
    aiScore = 80,
    fundingRate = 0,
    recentCandles = [],
  } = body;

  const now = Date.now();

  // 0. Rate Limit Cooldown Guard
  if (now < aiRateLimitState.resumeTimestamp) {
    const remainingSec = Math.ceil((aiRateLimitState.resumeTimestamp - now) / 1000);
    return Response.json(
      {
        code: "00000",
        msg: "rate_limited_cooldown",
        data: {
          action: aiScore >= 80 ? (rsi15m <= 45 ? "LONG" : "SHORT") : "HOLD",
          confidence: aiScore >= 80 ? 80 : 50,
          reason: `[AI Cooldown] ติด Rate Limit (${aiRateLimitState.provider}) เมื่อ ${aiRateLimitState.limitedAt} | จะเริ่มเรียก AI ใหม่อัตโนมัติเวลา ${aiRateLimitState.resumeAt} (ระบบ Quant เฝ้าระวังเงียบๆ โดยไม่ยิง API ซ้ำ)`,
          modelUsed: "quant_passive_sentinel",
          symbol,
          price: currentPrice,
          isCoolingDown: true,
          limitedAt: aiRateLimitState.limitedAt,
          resumeAt: aiRateLimitState.resumeAt,
          remainingSec,
        },
      },
      { headers: corsHeaders }
    );
  } else if (aiRateLimitState.isLimited) {
    aiRateLimitState.isLimited = false;
  }

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
1. If RSI < 45 AND pullback in uptrend (Dip-in-Uptrend), recommend LONG with high confidence (70-95%).
2. If RSI > 62 OR sharp overbought peak with negative divergence, recommend SHORT with high confidence (70-95%).
3. If market is sideways or unclear, recommend HOLD.
4. Keep reason analytical, concise, max 2 sentences (in Thai or English).

Respond ONLY with valid JSON:
{
  "action": "LONG" | "SHORT" | "HOLD",
  "confidence": number,
  "reason": "1-2 sentence rationalization",
  "stopLossPrice": number,
  "takeProfitPrice": number
}`;

  let lastError: any = null;

  // ==========================================
  // TIER 1: GROQ HIGH-SPEED ULTRA-LOW-LATENCY INFERENCE (PRIMARY)
  // ==========================================
  if (effectiveGroqKey) {
    for (const model of GROQ_MODELS) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${effectiveGroqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            max_tokens: 300,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.2,
          }),
        });

        if (!res.ok) {
          if (res.status === 429) {
            const retryHeader = res.headers.get("retry-after") || res.headers.get("x-ratelimit-reset");
            const waitSeconds = retryHeader ? Math.min(300, Math.max(30, parseInt(retryHeader, 10) || 60)) : 60;
            const resumeTime = new Date(Date.now() + waitSeconds * 1000);
            aiRateLimitState = {
              isLimited: true,
              limitedAt: new Date().toLocaleTimeString("th-TH"),
              resumeAt: resumeTime.toLocaleTimeString("th-TH"),
              resumeTimestamp: Date.now() + waitSeconds * 1000,
              provider: `Groq/${model}`,
            };
            lastError = new Error(`Groq rate limit hit, cooldown until ${aiRateLimitState.resumeAt}`);
            break;
          }
          lastError = new Error(`Groq ${model} returned HTTP ${res.status}`);
          continue;
        }

        const data = (await res.json()) as any;
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          lastError = new Error(`Empty response from Groq ${model}`);
          continue;
        }

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);

        let action = parsed.action || "HOLD";
        if (action !== "LONG" && action !== "SHORT" && action !== "HOLD") {
          action = "HOLD";
        }

        return Response.json(
          {
            code: "00000",
            msg: "success",
            provider: "groq",
            data: {
              action,
              confidence: Number(parsed.confidence) || 85,
              reason: parsed.reason || "Groq AI evaluated Futures technicals and momentum",
              modelUsed: `groq/${model}`,
              symbol,
              price: currentPrice,
              stopLossPrice: parsed.stopLossPrice,
              takeProfitPrice: parsed.takeProfitPrice,
            },
          },
          { headers: corsHeaders }
        );
      } catch (err: any) {
        lastError = err;
      }
    }
  }

  // ==========================================
  // TIER 2: OPENROUTER MULTI-MODEL FALLBACK LOOP (SECONDARY)
  // ==========================================
  if (effectiveOpenrouterKey) {
    const modelsToTry = await getLiveFreeModels(effectiveOpenrouterKey);

    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${effectiveOpenrouterKey}`,
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
          if (res.status === 429) {
            const waitSeconds = 120;
            const resumeTime = new Date(Date.now() + waitSeconds * 1000);
            aiRateLimitState = {
              isLimited: true,
              limitedAt: new Date().toLocaleTimeString("th-TH"),
              resumeAt: resumeTime.toLocaleTimeString("th-TH"),
              resumeTimestamp: Date.now() + waitSeconds * 1000,
              provider: `OpenRouter/${model}`,
            };
            lastError = new Error(`OpenRouter rate limit hit, cooldown until ${aiRateLimitState.resumeAt}`);
            break;
          }
          lastError = new Error(`OpenRouter ${model} returned HTTP ${res.status}`);
          continue;
        }

        const data = (await res.json()) as any;
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          lastError = new Error(`Empty response from OpenRouter ${model}`);
          continue;
        }

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);

        let action = parsed.action || "HOLD";
        if (action !== "LONG" && action !== "SHORT" && action !== "HOLD") {
          action = "HOLD";
        }

        return Response.json(
          {
            code: "00000",
            msg: "success",
            provider: "openrouter",
            data: {
              action,
              confidence: Number(parsed.confidence) || 75,
              reason: parsed.reason || "OpenRouter AI evaluated Futures market conditions",
              modelUsed: `openrouter/${model}`,
              symbol,
              price: currentPrice,
              stopLossPrice: parsed.stopLossPrice,
              takeProfitPrice: parsed.takeProfitPrice,
            },
          },
          { headers: corsHeaders }
        );
      } catch (err: any) {
        lastError = err;
      }
    }
  }

  // ==========================================
  // TIER 3: HEURISTIC QUANT MULTI-FACTOR ENGINE (SAFEGUARD)
  // ==========================================
  const positionPnl = typeof body.pnlPercent === "number" ? body.pnlPercent : null;
  let fallbackAction = "HOLD";
  let fallbackReason = `[Quant Rule Engine] Score ${aiScore}/100, RSI ${rsi15m}: รอสัญญาณที่ชัดเจน`;
  let fallbackConfidence = 50;

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
  } else if (aiScore >= 75 && (rsi15m >= 62 || (change24h >= 5 && rsi15m >= 55))) {
    fallbackAction = "SHORT";
    fallbackReason = `[Quant Rule Engine] Overbought Signal: Score ${aiScore}/100, RSI 15m ${rsi15m}, 24h Change +${change24h}% — เปิด SHORT ดักย่อ`;
    fallbackConfidence = 85;
  } else if (aiScore >= 75 && rsi15m <= 45 && change24h > 0) {
    fallbackAction = "LONG";
    fallbackReason = `[Quant Rule Engine] Dip in Uptrend: Score ${aiScore}/100, RSI 15m ${rsi15m}, 24h Change +${change24h}% — เปิด LONG ตามเทรนด์`;
    fallbackConfidence = 85;
  }

  return Response.json(
    {
      code: "00000",
      msg: "quant_rule_engine",
      provider: "heuristic",
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
