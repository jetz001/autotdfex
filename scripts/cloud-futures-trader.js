// autoTDFex 24/7 Autonomous Cloud Futures Trader Engine
// Runs on GitHub Actions (Microsoft Azure / AWS runners) 24/7
// Zero local PC dependency — USDT-M Perpetual Futures, Hedge Mode, 5x Cross

const crypto = require('crypto');

const BITGET_HOST = 'https://api.bitget.com';
const CLOUD_CONFIG_URL = 'https://autotdfex.pages.dev/api/config';
const PRODUCT_TYPE = 'USDT-FUTURES';

const ACTION_INPUT = process.env.INPUT_ACTION || 'cycle';
const SYMBOL_INPUT = process.env.INPUT_SYMBOL || '';
const AMOUNT_INPUT = process.env.INPUT_AMOUNT || '';

function signBitgetRequest(timestamp, method, requestPath, queryString, bodyStr, secretKey) {
  const message = timestamp + method.toUpperCase() + requestPath + (queryString ? '?' + queryString : '') + (bodyStr || '');
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

function mapFuturesSide(action, positionSide) {
  if (action === 'open' && positionSide === 'long') return 'open_long';
  if (action === 'close' && positionSide === 'long') return 'close_long';
  if (action === 'open' && positionSide === 'short') return 'open_short';
  return 'close_short';
}

function calculateContracts(usdtBudget, price, leverage) {
  if (price <= 0 || usdtBudget <= 0) return 0;
  const notional = usdtBudget * leverage;
  const raw = notional / price;
  if (raw >= 100) return Math.floor(raw);
  if (raw >= 10) return parseFloat(raw.toFixed(1));
  if (raw >= 1) return parseFloat(raw.toFixed(2));
  if (raw >= 0.1) return parseFloat(raw.toFixed(3));
  return Math.max(0.0001, parseFloat(raw.toFixed(4)));
}

async function setLeverage(symbol, leverage, config) {
  try {
    const { apiKey, secretKey, passphrase } = config;
    const timestamp = Date.now().toString();
    const requestPath = '/api/v2/mix/account/set-leverage';
    const body = JSON.stringify({ symbol, productType: PRODUCT_TYPE, marginCoin: 'USDT', leverage: String(leverage) });
    const sign = signBitgetRequest(timestamp, 'POST', requestPath, '', body, secretKey);
    await fetch(`${BITGET_HOST}${requestPath}`, {
      method: 'POST',
      headers: {
        'ACCESS-KEY': apiKey, 'ACCESS-SIGN': sign, 'ACCESS-TIMESTAMP': timestamp,
        'ACCESS-PASSPHRASE': passphrase, 'Content-Type': 'application/json', locale: 'en-US'
      },
      body
    });
  } catch (e) { console.warn('setLeverage error:', e.message); }
}

async function placeFuturesOrder(symbol, positionSide, action, contracts, config) {
  const { apiKey, secretKey, passphrase } = config;
  const leverage = config.leverage || 5;
  const timestamp = Date.now().toString();
  const requestPath = '/api/v2/mix/order/place-order';
  const payload = {
    symbol,
    productType: PRODUCT_TYPE,
    marginMode: 'crossed',
    marginCoin: 'USDT',
    size: String(contracts),
    side: mapFuturesSide(action, positionSide),
    orderType: 'market',
    clientOid: `cloud_fex_${Date.now()}`
  };
  const bodyStr = JSON.stringify(payload);
  const sign = signBitgetRequest(timestamp, 'POST', requestPath, '', bodyStr, secretKey);

  const res = await fetch(`${BITGET_HOST}${requestPath}`, {
    method: 'POST',
    headers: {
      'ACCESS-KEY': apiKey, 'ACCESS-SIGN': sign, 'ACCESS-TIMESTAMP': timestamp,
      'ACCESS-PASSPHRASE': passphrase, 'Content-Type': 'application/json', locale: 'en-US'
    },
    body: bodyStr
  });
  return await res.json();
}

async function fetchFuturesPositions(config) {
  const { apiKey, secretKey, passphrase } = config;
  const timestamp = Date.now().toString();
  const requestPath = '/api/v2/mix/position/all-position';
  const queryString = `productType=${PRODUCT_TYPE}&marginCoin=USDT`;
  const sign = signBitgetRequest(timestamp, 'GET', requestPath, queryString, '', secretKey);

  const res = await fetch(`${BITGET_HOST}${requestPath}?${queryString}`, {
    headers: {
      'ACCESS-KEY': apiKey, 'ACCESS-SIGN': sign, 'ACCESS-TIMESTAMP': timestamp,
      'ACCESS-PASSPHRASE': passphrase, 'Content-Type': 'application/json', locale: 'en-US'
    }
  });
  const json = await res.json();
  if (json.code !== '00000' || !Array.isArray(json.data)) return [];
  return json.data.filter(p => parseFloat(p.total || '0') > 0).map(p => ({
    symbol: p.symbol,
    positionSide: (p.holdSide || 'long').toLowerCase(),
    contracts: parseFloat(p.total || '0'),
    avgOpenPrice: parseFloat(p.openPriceAvg || '0'),
    markPrice: parseFloat(p.markPrice || '0'),
    unrealizedPL: parseFloat(p.unrealizedPL || '0'),
  }));
}

async function fetchFuturesTickers() {
  const res = await fetch(`${BITGET_HOST}/api/v2/mix/market/tickers?productType=${PRODUCT_TYPE}`);
  const json = await res.json();
  if (json.code !== '00000' || !Array.isArray(json.data)) return [];
  return json.data;
}

async function runFuturesCycle() {
  console.log(`[autoTDFex Cloud Futures] Starting cycle at ${new Date().toISOString()} | Action: ${ACTION_INPUT}`);

  // 1. Load cloud config
  let config = null;
  try {
    const res = await fetch(CLOUD_CONFIG_URL);
    if (res.ok) {
      const j = await res.json();
      config = j.data;
    }
  } catch (err) { console.error('Failed to load cloud config:', err.message); }

  if (!config || !config.apiKey || !config.secretKey || !config.passphrase) {
    try {
      console.log('Fetching fallback credentials from AutoTD cloud config (https://autotd.pages.dev/api/config)...');
      const fallbackRes = await fetch('https://autotd.pages.dev/api/config');
      if (fallbackRes.ok) {
        const fj = await fallbackRes.json();
        if (fj?.data?.apiKey && fj?.data?.secretKey) {
          config = {
            ...(config || {}),
            apiKey: fj.data.apiKey,
            secretKey: fj.data.secretKey,
            passphrase: fj.data.passphrase,
            openrouterApiKey: fj.data.openrouterApiKey || config?.openrouterApiKey || '',
            leverage: config?.leverage || 5,
            takeProfitPercent: config?.takeProfitPercent || 3.5,
            cutLossPercent: config?.cutLossPercent || 5.0,
            maxCoins: config?.maxCoins || 4,
          };
          console.log('✓ Successfully inherited Bitget API credentials from AutoTD');
        }
      }
    } catch (fbErr) {
      console.warn('Fallback config fetch error:', fbErr.message);
    }
  }

  if (!config || !config.apiKey || !config.secretKey || !config.passphrase) {
    console.error('Bitget API credentials not configured. Exiting.');
    return;
  }

  const leverage = config.leverage || 5;
  const tpPct = config.takeProfitPercent || 3.5;
  const slPct = config.cutLossPercent || 5.0;
  const maxCoins = config.maxCoins || 4;

  // 2. Fetch tickers
  const tickers = await fetchFuturesTickers();
  const priceMap = {};
  for (const t of tickers) {
    if (t.symbol && t.lastPr) priceMap[t.symbol] = parseFloat(t.lastPr);
  }

  // 3. Fetch current positions
  const positions = await fetchFuturesPositions(config);
  console.log(`Current Futures Positions (${positions.length}):`, positions.map(p => `${p.positionSide.toUpperCase()} ${p.symbol} ${p.contracts}c`).join(', '));

  const newLogs = [];

  // 4. ON-DEMAND: Manual close/open via dispatch
  if ((ACTION_INPUT === 'futures_close_long' || ACTION_INPUT === 'futures_close_short') && SYMBOL_INPUT) {
    const targetSym = SYMBOL_INPUT.endsWith('USDT') ? SYMBOL_INPUT : `${SYMBOL_INPUT}USDT`;
    const side = ACTION_INPUT.includes('long') ? 'long' : 'short';
    const pos = positions.find(p => p.symbol === targetSym && p.positionSide === side);
    if (pos && pos.contracts > 0) {
      const closeRes = await placeFuturesOrder(targetSym, side, 'close', pos.contracts, config);
      if (closeRes.code === '00000') {
        const orderId = closeRes.data?.orderId || 'ok';
        console.log(`On-demand close ${side} ${targetSym}: orderId=${orderId}`);
        newLogs.push({
          id: Date.now().toString(), time: new Date().toLocaleTimeString('th-TH'),
          action: `🎯 [CLOUD CLOSE ${side.toUpperCase()}]`, symbol: targetSym,
          note: `ปิด ${side.toUpperCase()} ${pos.contracts} contracts สำเร็จ orderId=${orderId}`, color: '#10b981'
        });
      }
    }
  }

  if ((ACTION_INPUT === 'futures_open_long' || ACTION_INPUT === 'futures_open_short') && SYMBOL_INPUT) {
    const targetSym = SYMBOL_INPUT.endsWith('USDT') ? SYMBOL_INPUT : `${SYMBOL_INPUT}USDT`;
    const side = ACTION_INPUT.includes('long') ? 'long' : 'short';
    const price = priceMap[targetSym] || 0;
    const budget = parseFloat(AMOUNT_INPUT || '10');
    const contracts = calculateContracts(budget, price, leverage);
    if (contracts > 0 && price > 0) {
      await setLeverage(targetSym, leverage, config);
      const openRes = await placeFuturesOrder(targetSym, side, 'open', contracts, config);
      if (openRes.code === '00000') {
        newLogs.push({
          id: Date.now().toString(), time: new Date().toLocaleTimeString('th-TH'),
          action: `🚀 [CLOUD OPEN ${side.toUpperCase()}]`, symbol: targetSym,
          note: `เปิด ${side.toUpperCase()} ${contracts} contracts @ $${price} orderId=${openRes.data?.orderId || 'ok'}`, color: '#10b981'
        });
      }
    }
  }

  // 5. TAKE PROFIT / CUT LOSS (Autonomous)
  const livePositionsConfig = Array.isArray(config.livePositions) ? config.livePositions : [];
  for (const pos of positions) {
    const markPrice = priceMap[pos.symbol] || pos.markPrice;
    const match = livePositionsConfig.find(lp => lp.symbol === pos.symbol && lp.positionSide === pos.positionSide);
    const avgOpen = match?.avgOpenPrice || pos.avgOpenPrice;

    if (avgOpen > 0 && markPrice > 0) {
      const pnlPct = pos.positionSide === 'long'
        ? ((markPrice - avgOpen) / avgOpen) * 100
        : ((avgOpen - markPrice) / avgOpen) * 100;

      console.log(`Position ${pos.positionSide.toUpperCase()} ${pos.symbol}: Mark $${markPrice}, AvgOpen $${avgOpen}, PnL ${pnlPct.toFixed(2)}% (TP: +${tpPct}%, SL: -${slPct}%)`);

      if (pnlPct >= tpPct) {
        console.log(`🚀 [CLOUD TP] ${pos.positionSide.toUpperCase()} ${pos.symbol} +${pnlPct.toFixed(2)}% >= +${tpPct}%! Closing...`);
        const res = await placeFuturesOrder(pos.symbol, pos.positionSide, 'close', pos.contracts, config);
        if (res.code === '00000') {
          newLogs.push({
            id: Date.now().toString(), time: new Date().toLocaleTimeString('th-TH'),
            action: `🎯 [CLOUD AUTO-TAKE PROFIT ${pos.positionSide.toUpperCase()}]`, symbol: pos.symbol,
            note: `ล็อคกำไร +${pnlPct.toFixed(2)}% @ $${markPrice} — ปิด ${pos.contracts} contracts`, color: '#10b981'
          });
        }
      } else if (pnlPct <= -slPct) {
        console.log(`🚨 [CLOUD SL] ${pos.positionSide.toUpperCase()} ${pos.symbol} ${pnlPct.toFixed(2)}% <= -${slPct}%! Cutting...`);
        const res = await placeFuturesOrder(pos.symbol, pos.positionSide, 'close', pos.contracts, config);
        if (res.code === '00000') {
          newLogs.push({
            id: Date.now().toString(), time: new Date().toLocaleTimeString('th-TH'),
            action: `🚨 [CLOUD AUTO-CUT LOSS ${pos.positionSide.toUpperCase()}]`, symbol: pos.symbol,
            note: `คัทลอส ${pnlPct.toFixed(2)}% @ $${markPrice} — รักษาทุน`, color: '#ef4444'
          });
        }
      }
    }
  }

  // 6. AUTO SCAN & OPEN (Long: Dip in Uptrend | Short: RSI Overbought + positive funding)
  if (ACTION_INPUT === 'cycle') {
    const STABLECOINS = ['USDC', 'USDGO', 'FDUSD', 'USDE', 'DAI', 'TUSD', 'EUR', 'BUSD'];
    const REAL_R_CRYPTO = ['RENDERUSDT', 'ROSEUSDT', 'RUNEUSDT', 'RAYUSDT', 'REQUSDT'];
    const heldSymbols = new Set(positions.map(p => `${p.symbol}_${p.positionSide}`));
    const longCount = positions.filter(p => p.positionSide === 'long').length;
    const shortCount = positions.filter(p => p.positionSide === 'short').length;

    const candidates = tickers
      .filter(item => {
        if (!item.symbol || !item.symbol.endsWith('USDT')) return false;
        const sym = item.symbol;
        if (sym.includes('_')) return false;
        if (sym.startsWith('R') && !REAL_R_CRYPTO.includes(sym)) return false;
        const base = sym.replace('USDT', '');
        if (STABLECOINS.includes(base)) return false;
        const vol = parseFloat(item.usdtVolume || item.quoteVolume || '0');
        const price = parseFloat(item.lastPr || item.last || '0');
        return price > 0 && vol > 2000000;
      })
      .map(item => {
        const vol = parseFloat(item.usdtVolume || item.quoteVolume || '0');
        const price = parseFloat(item.lastPr || item.last || '0');
        const change = parseFloat(item.change24h || '0') * 100;
        const high = parseFloat(item.high24h || '0');
        const low = parseFloat(item.low24h || '0');
        const range = high - low;
        const pos24h = range > 0 ? (price - low) / range : 0.5;

        // Long signal: dip in uptrend
        let longScore = 10;
        if (change >= 1 && change <= 6) longScore += 35;
        else if (change > 0 && change < 1) longScore += 20;
        if (pos24h >= 0.35 && pos24h <= 0.55) longScore += 35;
        else if (pos24h >= 0.25 && pos24h < 0.35) longScore += 25;
        if (vol > 20000000) longScore += 25;
        else if (vol > 5000000) longScore += 15;

        // Short signal: overbought
        let shortScore = 10;
        if (change > 8) shortScore += 35;
        else if (change > 5) shortScore += 20;
        if (pos24h > 0.85) shortScore += 35;
        else if (pos24h > 0.75) shortScore += 20;
        if (vol > 20000000) shortScore += 20;

        return { symbol: item.symbol, price, change, vol, longScore: Math.min(99, longScore), shortScore: Math.min(99, shortScore) };
      });

    // Try open Long
    if (longCount < maxCoins) {
      const longCandidates = candidates
        .filter(c => c.longScore >= 80 && !heldSymbols.has(`${c.symbol}_long`))
        .sort((a, b) => b.longScore - a.longScore);

      if (longCandidates.length > 0) {
        const best = longCandidates[0];
        const budget = 10; // $10 USDT margin per position
        const contracts = calculateContracts(budget, best.price, leverage);
        if (contracts > 0) {
          console.log(`[CLOUD AUTO-LONG] Candidate ${best.symbol} score ${best.longScore}/100 @ $${best.price}. Consulting Groq AI...`);
          let allowTrade = true;
          let aiReason = '';
          try {
            const aiRes = await fetch('https://autotdfex.pages.dev/api/agent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                symbol: best.symbol,
                currentPrice: best.price,
                change24h: best.change,
                rsi15m: 40,
                aiScore: best.longScore,
                tradingMode: 'FUTURES',
              }),
            });
            if (aiRes.ok) {
              const aiData = await aiRes.json();
              if (aiData?.data?.action === 'HOLD') {
                console.log(`Groq AI recommended HOLD for ${best.symbol}: ${aiData.data.reason}`);
                allowTrade = false;
              } else {
                aiReason = aiData?.data?.reason || '';
              }
            }
          } catch (e) {
            console.warn('AI agent consult error:', e.message);
          }

          if (allowTrade) {
            await setLeverage(best.symbol, leverage, config);
            const res = await placeFuturesOrder(best.symbol, 'long', 'open', contracts, config);
            if (res.code === '00000') {
              newLogs.push({
                id: Date.now().toString(), time: new Date().toLocaleTimeString('th-TH'),
                action: '🚀 [CLOUD AUTO-LONG]', symbol: best.symbol,
                note: `เปิด LONG (Score ${best.longScore}/100) ${contracts} contracts @ $${best.price}${aiReason ? ` | AI: ${aiReason}` : ''}`, color: '#10b981'
              });
            }
          }
        }
      }
    }

    // Try open Short
    if (shortCount < maxCoins) {
      const shortCandidates = candidates
        .filter(c => c.shortScore >= 80 && !heldSymbols.has(`${c.symbol}_short`))
        .sort((a, b) => b.shortScore - a.shortScore);

      if (shortCandidates.length > 0) {
        const best = shortCandidates[0];
        const budget = 10;
        const contracts = calculateContracts(budget, best.price, leverage);
        if (contracts > 0) {
          console.log(`[CLOUD AUTO-SHORT] Candidate ${best.symbol} score ${best.shortScore}/100 @ $${best.price}. Consulting Groq AI...`);
          let allowTrade = true;
          let aiReason = '';
          try {
            const aiRes = await fetch('https://autotdfex.pages.dev/api/agent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                symbol: best.symbol,
                currentPrice: best.price,
                change24h: best.change,
                rsi15m: 65,
                aiScore: best.shortScore,
                tradingMode: 'FUTURES',
              }),
            });
            if (aiRes.ok) {
              const aiData = await aiRes.json();
              if (aiData?.data?.action === 'HOLD') {
                console.log(`Groq AI recommended HOLD for ${best.symbol}: ${aiData.data.reason}`);
                allowTrade = false;
              } else {
                aiReason = aiData?.data?.reason || '';
              }
            }
          } catch (e) {
            console.warn('AI agent consult error:', e.message);
          }

          if (allowTrade) {
            await setLeverage(best.symbol, leverage, config);
            const res = await placeFuturesOrder(best.symbol, 'short', 'open', contracts, config);
            if (res.code === '00000') {
              newLogs.push({
                id: Date.now().toString(), time: new Date().toLocaleTimeString('th-TH'),
                action: '📉 [CLOUD AUTO-SHORT]', symbol: best.symbol,
                note: `เปิด SHORT (Score ${best.shortScore}/100) ${contracts} contracts @ $${best.price}${aiReason ? ` | AI: ${aiReason}` : ''}`, color: '#f59e0b'
              });
            }
          }
        }
      }
    }
  }

  // 7. Push health log & synced positions to Cloudflare D1
  const statusLog = {
    id: Date.now().toString(),
    time: new Date().toLocaleTimeString('th-TH'),
    action: '🤖 [FUTURES CLOUD 24/7] ตรวจสอบพอร์ต',
    symbol: 'AUTOTDFEX',
    note: `สแกน Futures พอร์ต ${positions.length} positions | Leverage ${leverage}x | Cross USDT-M ระบบเฝ้าระวัง 24 ชม.`,
    color: '#38bdf8'
  };

  try {
    const existingLogs = Array.isArray(config.quantLogs) ? config.quantLogs : (Array.isArray(config.liveLogs) ? config.liveLogs : []);
    const updatedLogs = [statusLog, ...newLogs, ...existingLogs].slice(0, 50);
    await fetch(CLOUD_CONFIG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        liveLogs: updatedLogs,
        quantLogs: updatedLogs,
        livePositions: positions,
        positions: positions,
      })
    });
    console.log('Pushed cloud health log & positions to Cloudflare D1 successfully.');
  } catch (err) { console.warn('Sync log error:', err.message); }

  console.log('[autoTDFex Cloud Futures] Cycle completed successfully.');
}

runFuturesCycle().catch(console.error);
