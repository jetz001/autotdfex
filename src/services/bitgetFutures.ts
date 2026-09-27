// Bitget V2 USDT-M Perpetual Futures Quantitative Engine
// Built with native Web Crypto API (crypto.subtle) for 100% Edge & Browser compatibility
// autoTDFex — Two-way Hedge Mode, Cross Margin, 5x Leverage default

import { calculateRSI } from './quantEngine';

export const EDGE_BOT_URL = '';

export interface FuturesConfig {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  openrouterApiKey?: string;
  isPaperTrading: boolean;
  autoPilotEnabled: boolean;
  tranchePercent: number;
  takeProfitPercent: number;
  cutLossPercent: number;
  maxTranches: number;
  maxCoins: number;
  cashReservePercent: number;
  autoRebalanceEnabled: boolean;
  // Futures-specific
  leverage: number;           // default 5
  positionMode: 'hedge';      // always hedge (two-way)
  marginMode: 'crossed';      // always cross margin
}

export interface FuturesPosition {
  symbol: string;           // e.g. 'SOLUSDT'
  baseCoin: string;         // e.g. 'SOL'
  positionSide: 'long' | 'short';
  contracts: number;        // number of contracts held
  notionalUsdt: number;     // contracts * markPrice / leverage (margin used)
  avgOpenPrice: number;
  markPrice: number;
  unrealizedPnlUsdt: number;
  pnlPercent: number;       // % on notional (not margin)
  takeProfitPrice: number;
  cutLossPrice: number;
  liquidationPrice: number;
  leverage: number;
  isPaper: boolean;
  openTime: string;
  tranchesCount: number;
  totalInvestedUsdt: number; // total USDT margin committed
}

export interface FuturesTickerItem {
  symbol: string;
  baseCoin: string;
  lastPr: number;
  change24h: number;
  high24h: number;
  low24h: number;
  usdtVolume: number;
  fundingRate?: number;
  openInterest?: number;
  rsi15m?: number;
  aiScore?: number;
  signal?: 'LONG' | 'SHORT' | 'WATCH' | 'COOLDOWN';
}

export interface AIAgentFuturesDecision {
  action: 'LONG' | 'SHORT' | 'HOLD';
  confidence: number;
  reason: string;
  modelUsed: string;
  symbol: string;
  price: number;
}

// Storage keys — prefixed with 'bitget_futures_' to avoid collisions with Spot
const STORAGE_KEY_CONFIG = 'bitget_futures_config_v1';
const STORAGE_KEY_PAPER_POSITIONS = 'bitget_futures_paper_positions_v1';
const STORAGE_KEY_LIVE_POSITIONS = 'bitget_futures_live_positions_v1';
const STORAGE_KEY_COOLDOWN = 'bitget_futures_cooldown_v1';
const STORAGE_KEY_PAPER_BALANCE = 'bitget_futures_paper_balance_v1';

const PRODUCT_TYPE = 'USDT-FUTURES';
const BITGET_HOST = 'https://api.bitget.com';

// ──────────────────────────────────────
// Config Management
// ──────────────────────────────────────

export function loadFuturesConfig(): FuturesConfig {
  const defaults: FuturesConfig = {
    apiKey: '',
    secretKey: '',
    passphrase: '',
    openrouterApiKey: '',
    isPaperTrading: true,
    autoPilotEnabled: true,
    tranchePercent: 20,
    takeProfitPercent: 3.5,
    cutLossPercent: 5.0,
    maxTranches: 4,
    maxCoins: 4,
    cashReservePercent: 30,
    autoRebalanceEnabled: true,
    leverage: 5,
    positionMode: 'hedge',
    marginMode: 'crossed',
  };
  if (typeof window === 'undefined') return defaults;
  let saved = localStorage.getItem(STORAGE_KEY_CONFIG);
  if (!saved) {
    saved = localStorage.getItem('bitget_spot_config_v1') || localStorage.getItem('bitget_config_v1');
  }
  if (saved) {
    try { return { ...defaults, ...JSON.parse(saved) }; } catch {}
  }
  return defaults;
}

export function saveFuturesConfig(cfg: FuturesConfig) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cfg));
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    }).catch(() => {});
  }
}

// ──────────────────────────────────────
// Paper Balance
// ──────────────────────────────────────

export function getPaperFuturesBalance(): number {
  if (typeof window === 'undefined') return 10000;
  const saved = localStorage.getItem(STORAGE_KEY_PAPER_BALANCE);
  return saved ? parseFloat(saved) : 10000;
}

export function setPaperFuturesBalance(amt: number) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_PAPER_BALANCE, amt.toString());
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperBalance: amt }),
    }).catch(() => {});
  }
}

export function resetPaperFuturesBalance(amt = 10000) {
  setPaperFuturesBalance(amt);
  return amt;
}

// ──────────────────────────────────────
// Real Bitget Futures Wallet Account
// ──────────────────────────────────────

export interface RealFuturesAccount {
  connected: boolean;
  marginCoin: string;
  availableUsdt: number;
  equityUsdt: number;
  lockedUsdt: number;
  unrealizedPnl: number;
  bonus: number;
  message?: string;
}

export async function fetchRealFuturesAccountViaWs(config: FuturesConfig): Promise<RealFuturesAccount | null> {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return null;
  if (!config.apiKey || !config.secretKey || !config.passphrase) return null;

  return new Promise((resolve) => {
    let resolved = false;
    let ws: WebSocket | null = null;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { ws?.close(); } catch {}
        resolve(null);
      }
    }, 4500);

    try {
      ws = new WebSocket('wss://ws.bitget.com/v2/ws/private');

      ws.onopen = async () => {
        try {
          const timestamp = Math.floor(Date.now() / 1000).toString();
          const sign = await signBitgetRequest(timestamp, 'GET', '/user/verify', '', '', config.secretKey);
          ws?.send(
            JSON.stringify({
              op: 'login',
              args: [
                {
                  apiKey: config.apiKey,
                  passphrase: config.passphrase,
                  timestamp,
                  sign,
                },
              ],
            })
          );
        } catch {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            try { ws?.close(); } catch {}
            resolve(null);
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'login' && msg.code === 0) {
            ws?.send(
              JSON.stringify({
                op: 'subscribe',
                args: [{ instType: 'USDT-FUTURES', channel: 'account', coin: 'default' }],
              })
            );
          } else if (msg.action === 'snapshot' && Array.isArray(msg.data)) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              try { ws?.close(); } catch {}

              const usdtAcc = msg.data.find((a: any) => a.marginCoin === 'USDT') || msg.data[0];
              if (usdtAcc) {
                const avail = parseFloat(usdtAcc.available || usdtAcc.maxOpenPosAvailable || '0');
                const eq = parseFloat(usdtAcc.equity || usdtAcc.usdtEquity || '0');
                const frozen = parseFloat(usdtAcc.frozen || '0');
                const unPnl = parseFloat(usdtAcc.unrealizedPL || '0');
                resolve({
                  connected: true,
                  marginCoin: 'USDT',
                  availableUsdt: avail,
                  equityUsdt: eq,
                  lockedUsdt: frozen,
                  unrealizedPnl: unPnl,
                  bonus: 0,
                  message: `✓ เชื่อมต่อกระเป๋า Bitget USDT-M Futures จริงสำเร็จ (พร้อมเทรด $${avail.toFixed(2)} USDT)`,
                });
              } else {
                resolve(null);
              }
            }
          }
        } catch {}
      };

      ws.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          try { ws?.close(); } catch {}
          resolve(null);
        }
      };
    } catch {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(null);
      }
    }
  });
}

export async function fetchRealFuturesAccount(config?: FuturesConfig): Promise<RealFuturesAccount> {
  const defaultRes: RealFuturesAccount = {
    connected: false,
    marginCoin: 'USDT',
    availableUsdt: 0,
    equityUsdt: 0,
    lockedUsdt: 0,
    unrealizedPnl: 0,
    bonus: 0,
    message: 'ยังไม่ได้เชื่อมต่อ Bitget API',
  };

  let activeConfig = config;
  if (!activeConfig?.apiKey || !activeConfig?.secretKey) {
    const synced = await syncFuturesConfigFromCloudflare();
    if (synced?.apiKey) {
      activeConfig = { ...(config || loadFuturesConfig()), ...synced } as FuturesConfig;
      saveFuturesConfig(activeConfig);
    }
  }

  if (!activeConfig?.apiKey || !activeConfig?.secretKey || !activeConfig?.passphrase) {
    return defaultRes;
  }

  // 1. WebSocket Live Stream (Priority 1 — 100% bypasses CORS & WAF in browser)
  try {
    const wsRes = await fetchRealFuturesAccountViaWs(activeConfig);
    if (wsRes && wsRes.connected) return wsRes;
  } catch (wsErr) {
    console.warn('WS balance fetch failed, falling back to REST:', wsErr);
  }

  // 2. Direct WebCrypto API call
  try {
    const timestamp = Date.now().toString();
    const requestPath = '/api/v2/mix/account/accounts';
    const queryString = `productType=${PRODUCT_TYPE}`;
    const sign = await signBitgetRequest(timestamp, 'GET', requestPath, queryString, '', activeConfig.secretKey);

    const res = await fetch(`${BITGET_HOST}${requestPath}?${queryString}`, {
      headers: {
        'ACCESS-KEY': activeConfig.apiKey,
        'ACCESS-SIGN': sign,
        'ACCESS-TIMESTAMP': timestamp,
        'ACCESS-PASSPHRASE': activeConfig.passphrase,
        'Content-Type': 'application/json',
        locale: 'en-US',
      },
    });

    const json = await res.json();
    if (json.code === '00000' && Array.isArray(json.data)) {
      const usdtAcc = json.data.find((a: any) => a.marginCoin === 'USDT') || json.data[0];
      if (usdtAcc) {
        return {
          connected: true,
          marginCoin: usdtAcc.marginCoin || 'USDT',
          availableUsdt: parseFloat(usdtAcc.available || usdtAcc.maxOpenPosAvailable || '0'),
          equityUsdt: parseFloat(usdtAcc.equity || usdtAcc.usdtEquity || '0'),
          lockedUsdt: parseFloat(usdtAcc.locked || '0'),
          unrealizedPnl: parseFloat(usdtAcc.unrealizedPL || '0'),
          bonus: parseFloat(usdtAcc.bonus || '0'),
          message: '✓ เชื่อมต่อกระเป๋า Bitget USDT-M Futures จริงสำเร็จ',
        };
      }
    } else if (json.msg) {
      defaultRes.message = `Bitget API (${json.code}): ${json.msg}`;
    }
  } catch (err: any) {
    console.warn('Direct fetchRealFuturesAccount error, falling back to proxy:', err);
  }

  // 3. Fallback via Cloudflare Pages Function proxy
  try {
    const headers: Record<string, string> = {};
    if (activeConfig.apiKey) headers['x-bitget-key'] = activeConfig.apiKey;
    if (activeConfig.secretKey) headers['x-bitget-secret'] = activeConfig.secretKey;
    if (activeConfig.passphrase) headers['x-bitget-passphrase'] = activeConfig.passphrase;

    const pRes = await fetch('/api/bitget?action=balance', { headers });
    if (pRes.ok) {
      const pJson = await pRes.json();
      if (pJson.code === '00000' && Array.isArray(pJson.data)) {
        const usdtAcc = pJson.data.find((a: any) => a.marginCoin === 'USDT') || pJson.data[0];
        if (usdtAcc) {
          return {
            connected: true,
            marginCoin: usdtAcc.marginCoin || 'USDT',
            availableUsdt: parseFloat(usdtAcc.available || usdtAcc.maxOpenPosAvailable || '0'),
            equityUsdt: parseFloat(usdtAcc.equity || usdtAcc.usdtEquity || '0'),
            lockedUsdt: parseFloat(usdtAcc.locked || '0'),
            unrealizedPnl: parseFloat(usdtAcc.unrealizedPL || '0'),
            bonus: parseFloat(usdtAcc.bonus || '0'),
            message: '✓ เชื่อมต่อกระเป๋า Bitget USDT-M Futures จริงสำเร็จ (Proxy)',
          };
        }
      }
    }
  } catch {}

  return defaultRes;
}

// ──────────────────────────────────────
// Cooldown Management
// ──────────────────────────────────────

export function getCooldownMap(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  const saved = localStorage.getItem(STORAGE_KEY_COOLDOWN);
  if (!saved) return {};
  try {
    const map = JSON.parse(saved);
    const now = Date.now();
    const active: Record<string, number> = {};
    for (const [sym, expireTs] of Object.entries(map)) {
      if ((expireTs as number) > now) active[sym] = expireTs as number;
    }
    return active;
  } catch { return {}; }
}

export function setCooldown(symbol: string, durationHours = 3) {
  if (typeof window === 'undefined') return;
  const map = getCooldownMap();
  map[symbol] = Date.now() + durationHours * 3600 * 1000;
  localStorage.setItem(STORAGE_KEY_COOLDOWN, JSON.stringify(map));
}

export function isUnderCooldown(symbol: string): boolean {
  const map = getCooldownMap();
  return !!(map[symbol] && map[symbol] > Date.now());
}

// ──────────────────────────────────────
// Positions Management (Paper & Live)
// ──────────────────────────────────────

export function loadFuturesPositions(isPaper = true): FuturesPosition[] {
  if (typeof window === 'undefined') return [];
  const key = isPaper ? STORAGE_KEY_PAPER_POSITIONS : STORAGE_KEY_LIVE_POSITIONS;
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

export function saveFuturesPositions(positions: FuturesPosition[], isPaper = true) {
  if (typeof window !== 'undefined') {
    const key = isPaper ? STORAGE_KEY_PAPER_POSITIONS : STORAGE_KEY_LIVE_POSITIONS;
    localStorage.setItem(key, JSON.stringify(positions));
  }
}

// ──────────────────────────────────────
// Market Data — Tickers
// ──────────────────────────────────────

export async function fetchTopBitgetFuturesTickers(): Promise<FuturesTickerItem[]> {
  try {
    const res = await fetch(`${BITGET_HOST}/api/v2/mix/market/tickers?productType=${PRODUCT_TYPE}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.code !== '00000' || !Array.isArray(json.data)) return [];

    const STABLECOINS = ['USDC', 'USDGO', 'FDUSD', 'USDE', 'DAI', 'TUSD', 'EUR', 'BUSD'];
    const REAL_R_CRYPTO = ['RENDERUSDT', 'ROSEUSDT', 'RUNEUSDT', 'RAYUSDT', 'REQUSDT'];

    return json.data
      .filter((item: any) => {
        if (!item.symbol || !item.symbol.endsWith('USDT')) return false;
        const sym = item.symbol;
        if (sym.includes('_')) return false;
        if (sym.startsWith('R') && !REAL_R_CRYPTO.includes(sym)) return false;
        const base = sym.replace('USDT', '');
        if (STABLECOINS.includes(base)) return false;
        const vol = parseFloat(item.usdtVolume || item.quoteVolume || '0');
        const price = parseFloat(item.lastPr || item.last || '0');
        return price > 0 && vol > 1000000;
      })
      .map((item: any) => {
        const vol = parseFloat(item.usdtVolume || item.quoteVolume || '0');
        const price = parseFloat(item.lastPr || item.last || '0');
        const change = parseFloat(item.change24h || item.priceChangePercent || '0') * 100;
        const sym = item.symbol;
        const base = sym.replace('USDT', '');
        return {
          symbol: sym,
          baseCoin: base,
          lastPr: price,
          change24h: change,
          high24h: parseFloat(item.high24h || '0'),
          low24h: parseFloat(item.low24h || '0'),
          usdtVolume: vol,
        } as FuturesTickerItem;
      })
      .filter((i: FuturesTickerItem) => i.lastPr > 0 && i.usdtVolume > 1000000)
      .sort((a: FuturesTickerItem, b: FuturesTickerItem) => b.usdtVolume - a.usdtVolume)
      .slice(0, 20);
  } catch (e) {
    console.warn('Failed to fetch Bitget Futures tickers:', e);
    return [];
  }
}

// ──────────────────────────────────────
// Market Data — Candles
// ──────────────────────────────────────

export async function fetchBitgetFuturesCandles(
  symbol: string,
  granularity = '15m',
  limit = 100
) {
  try {
    const res = await fetch(
      `${BITGET_HOST}/api/v2/mix/market/candles?symbol=${symbol}&productType=${PRODUCT_TYPE}&granularity=${granularity}&limit=${limit}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.code !== '00000' || !Array.isArray(json.data)) return [];

    return [...json.data]
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(item => ({
        time: Math.floor(parseInt(item[0]) / 1000),
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[6] || item[5]),
      }));
  } catch (e) {
    console.warn('Failed to fetch Futures candles:', e);
    return [];
  }
}

// ──────────────────────────────────────
// Market Data — Funding Rate
// ──────────────────────────────────────

export async function fetchFundingRate(symbol: string): Promise<number> {
  try {
    const res = await fetch(
      `${BITGET_HOST}/api/v2/mix/market/current-fund-rate?symbol=${symbol}&productType=${PRODUCT_TYPE}`
    );
    if (!res.ok) return 0;
    const json = await res.json();
    if (json.code === '00000' && json.data) {
      const rate = Array.isArray(json.data) ? json.data[0]?.fundingRate : json.data.fundingRate;
      return parseFloat(rate || '0');
    }
  } catch {}
  return 0;
}

// ──────────────────────────────────────
// RSI Calculation & Cache
// ──────────────────────────────────────

const rsiCache: Record<string, { rsi: number; timestamp: number }> = {};

export async function fetchRealRsi15m(symbol: string): Promise<number> {
  const cached = rsiCache[symbol];
  if (cached && Date.now() - cached.timestamp < 60000) return cached.rsi;
  try {
    const candles = await fetchBitgetFuturesCandles(symbol, '15m', 30);
    if (candles && candles.length >= 15) {
      const closes = candles.map(c => c.close);
      const rsi = calculateRSI(closes, 14);
      rsiCache[symbol] = { rsi, timestamp: Date.now() };
      return rsi;
    }
  } catch (e) {
    console.warn(`Failed to fetch 15m RSI for ${symbol}:`, e);
  }
  return 50;
}

export async function fetchBatchRealRsi(symbols: string[]): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  const chunkSize = 5;
  for (let i = 0; i < symbols.length; i += chunkSize) {
    const chunk = symbols.slice(i, i + chunkSize);
    await Promise.allSettled(
      chunk.map(async (sym) => {
        map[sym] = await fetchRealRsi15m(sym);
      })
    );
  }
  return map;
}

// ──────────────────────────────────────
// HMAC-SHA256 Signer (Web Crypto API)
// ──────────────────────────────────────

export async function signBitgetRequest(
  timestamp: string,
  method: string,
  requestPath: string,
  queryString: string,
  body: string,
  secretKey: string
): Promise<string> {
  const message = timestamp + method.toUpperCase() + requestPath + (queryString ? `?${queryString}` : '') + (body || '');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ──────────────────────────────────────
// Cloud Config Sync
// ──────────────────────────────────────

export interface SyncedCloudFuturesData extends Partial<FuturesConfig> {
  paperBalance?: number;
  positions?: FuturesPosition[];
  quantLogs?: Array<{ id: string; time: string; action: string; symbol: string; note: string; color: string }>;
}

export async function syncFuturesConfigFromCloudflare(): Promise<SyncedCloudFuturesData | null> {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const json = await res.json();
      if (json.code === '00000' && json.data) {
        if (json.data.apiKey && json.data.secretKey) {
          return json.data as SyncedCloudFuturesData;
        }
      }
    }
  } catch {}

  // Fallback: inherit credentials from AutoTD Spot Cloudflare Pages
  try {
    const fallbackRes = await fetch('https://autotd.pages.dev/api/config');
    if (fallbackRes.ok) {
      const fj = await fallbackRes.json();
      if (fj.code === '00000' && fj.data?.apiKey) {
        return {
          apiKey: fj.data.apiKey,
          secretKey: fj.data.secretKey,
          passphrase: fj.data.passphrase,
          openrouterApiKey: fj.data.openrouterApiKey,
        } as SyncedCloudFuturesData;
      }
    }
  } catch {}

  return null;
}

// ──────────────────────────────────────
// Real Order Execution (Bitget Futures API)
// ──────────────────────────────────────

interface FuturesOrderParams {
  symbol: string;
  positionSide: 'long' | 'short';
  action: 'open' | 'close';
  contracts: string;   // number of contracts as string
  leverage: number;
}

// Maps action+positionSide to Bitget side string
function mapSide(action: 'open' | 'close', positionSide: 'long' | 'short'): string {
  if (action === 'open' && positionSide === 'long') return 'open_long';
  if (action === 'close' && positionSide === 'long') return 'close_long';
  if (action === 'open' && positionSide === 'short') return 'open_short';
  return 'close_short';
}

export async function executeRealFuturesOrder(
  order: FuturesOrderParams,
  config?: FuturesConfig
): Promise<{ success: boolean; data?: any; message: string }> {
  let activeConfig = config;
  if (!activeConfig?.apiKey || !activeConfig?.secretKey) {
    const synced = await syncFuturesConfigFromCloudflare();
    if (synced?.apiKey) {
      activeConfig = { ...(config || loadFuturesConfig()), ...synced } as FuturesConfig;
      saveFuturesConfig(activeConfig);
    }
  }

  // 1. Cloud Dispatch via Cloudflare Pages (GitHub Actions)
  try {
    const cloudRes = await fetch('/api/cloud-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: `futures_${order.action}_${order.positionSide}`,
        symbol: order.symbol,
        amount: order.contracts,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (cloudRes.ok) {
      const cJson = await cloudRes.json();
      if (cJson.success) {
        return { success: true, data: { orderId: `cloud_futures_${Date.now()}` }, message: cJson.message };
      }
    }
  } catch {}

  // 2. Direct Browser WebCrypto request to Bitget
  if (activeConfig?.apiKey && activeConfig?.secretKey && activeConfig?.passphrase) {
    try {
      const timestamp = Date.now().toString();
      const requestPath = '/api/v2/mix/order/place-order';
      const payload: any = {
        symbol: order.symbol,
        productType: PRODUCT_TYPE,
        marginMode: 'crossed',
        marginCoin: 'USDT',
        size: order.contracts,
        side: mapSide(order.action, order.positionSide),
        orderType: 'market',
        clientOid: `fex_${Date.now()}`,
      };

      // Set leverage before opening
      if (order.action === 'open') {
        try {
          const leverageTs = Date.now().toString();
          const leveragePath = '/api/v2/mix/account/set-leverage';
          const leverageBody = JSON.stringify({ symbol: order.symbol, productType: PRODUCT_TYPE, marginCoin: 'USDT', leverage: String(order.leverage) });
          const levSign = await signBitgetRequest(leverageTs, 'POST', leveragePath, '', leverageBody, activeConfig.secretKey);
          await fetch(`${BITGET_HOST}${leveragePath}`, {
            method: 'POST',
            headers: {
              'ACCESS-KEY': activeConfig.apiKey,
              'ACCESS-SIGN': levSign,
              'ACCESS-TIMESTAMP': leverageTs,
              'ACCESS-PASSPHRASE': activeConfig.passphrase,
              'Content-Type': 'application/json',
              locale: 'en-US',
            },
            body: leverageBody,
          });
        } catch {}
      }

      const bodyStr = JSON.stringify(payload);
      const sign = await signBitgetRequest(timestamp, 'POST', requestPath, '', bodyStr, activeConfig.secretKey);

      const directRes = await fetch(`${BITGET_HOST}${requestPath}`, {
        method: 'POST',
        headers: {
          'ACCESS-KEY': activeConfig.apiKey,
          'ACCESS-SIGN': sign,
          'ACCESS-TIMESTAMP': timestamp,
          'ACCESS-PASSPHRASE': activeConfig.passphrase,
          'Content-Type': 'application/json',
          locale: 'en-US',
        },
        body: bodyStr,
      });

      const directJson = await directRes.json();
      if (directJson.code === '00000') {
        return {
          success: true,
          data: directJson.data,
          message: `✓ [Bitget Futures] ${mapSide(order.action, order.positionSide).toUpperCase()} ${order.symbol} ${order.contracts} contracts @ market`,
        };
      }
      return { success: false, message: `Bitget Futures API (${directJson.code}): ${directJson.msg || 'Order failed'}` };
    } catch (err: any) {
      console.warn('Direct Futures order failed:', err);
    }
  }

  return { success: false, message: 'ไม่สามารถส่งออเดอร์ Futures ได้ — ตรวจสอบ API credentials' };
}

// ──────────────────────────────────────
// Fetch Real Futures Positions from Bitget
// ──────────────────────────────────────

export async function fetchRealFuturesPositions(config?: FuturesConfig): Promise<FuturesPosition[]> {
  let activeConfig = config;
  if (!activeConfig?.apiKey || !activeConfig?.secretKey) {
    const synced = await syncFuturesConfigFromCloudflare();
    if (synced?.apiKey) {
      activeConfig = { ...(config || loadFuturesConfig()), ...synced } as FuturesConfig;
    }
  }

  if (!activeConfig?.apiKey || !activeConfig?.secretKey || !activeConfig?.passphrase) return [];

  try {
    const timestamp = Date.now().toString();
    const requestPath = '/api/v2/mix/position/all-position';
    const queryString = `productType=${PRODUCT_TYPE}&marginCoin=USDT`;
    const sign = await signBitgetRequest(timestamp, 'GET', requestPath, queryString, '', activeConfig.secretKey);

    const res = await fetch(`${BITGET_HOST}${requestPath}?${queryString}`, {
      headers: {
        'ACCESS-KEY': activeConfig.apiKey,
        'ACCESS-SIGN': sign,
        'ACCESS-TIMESTAMP': timestamp,
        'ACCESS-PASSPHRASE': activeConfig.passphrase,
        'Content-Type': 'application/json',
        locale: 'en-US',
      },
    });

    const json = await res.json();
    if (json.code !== '00000' || !Array.isArray(json.data)) return [];

    return json.data
      .filter((p: any) => parseFloat(p.total || '0') > 0)
      .map((p: any) => {
        const contracts = parseFloat(p.total || '0');
        const avgOpen = parseFloat(p.openPriceAvg || '0');
        const mark = parseFloat(p.markPrice || '0');
        const unrealized = parseFloat(p.unrealizedPL || '0');
        const liqPrice = parseFloat(p.liquidationPrice || '0');
        const lev = parseFloat(p.leverage || '5');
        const margin = parseFloat(p.margin || '0');
        const positionSide = (p.holdSide || 'long').toLowerCase() as 'long' | 'short';
        const sym = p.symbol || '';
        const base = sym.replace('USDT', '');
        const notional = contracts * mark;
        const pnlPct = avgOpen > 0 ? ((mark - avgOpen) / avgOpen) * 100 * (positionSide === 'short' ? -1 : 1) : 0;
        const lev5 = activeConfig?.takeProfitPercent ?? 3.5;
        const sl5 = activeConfig?.cutLossPercent ?? 5.0;
        const tpPrice = positionSide === 'long'
          ? parseFloat((avgOpen * (1 + lev5 / 100)).toFixed(4))
          : parseFloat((avgOpen * (1 - lev5 / 100)).toFixed(4));
        const slPrice = positionSide === 'long'
          ? parseFloat((avgOpen * (1 - sl5 / 100)).toFixed(4))
          : parseFloat((avgOpen * (1 + sl5 / 100)).toFixed(4));

        return {
          symbol: sym,
          baseCoin: base,
          positionSide,
          contracts,
          notionalUsdt: notional,
          avgOpenPrice: avgOpen,
          markPrice: mark,
          unrealizedPnlUsdt: unrealized,
          pnlPercent: pnlPct,
          takeProfitPrice: tpPrice,
          cutLossPrice: slPrice,
          liquidationPrice: liqPrice,
          leverage: lev,
          isPaper: false,
          openTime: new Date().toLocaleTimeString('th-TH'),
          tranchesCount: 1,
          totalInvestedUsdt: margin,
        } as FuturesPosition;
      });
  } catch (e) {
    console.warn('fetchRealFuturesPositions failed:', e);
    return [];
  }
}

// ──────────────────────────────────────
// Paper / Live Position Execution
// ──────────────────────────────────────

/**
 * Calculate contracts from USDT budget:
 * contracts = floor((usdtBudget * leverage) / price)
 */
export function calculateContracts(usdtBudget: number, price: number, leverage: number): number {
  if (price <= 0 || usdtBudget <= 0) return 0;
  const notional = usdtBudget * leverage;
  const raw = notional / price;
  if (raw >= 100) return Math.floor(raw);
  if (raw >= 10) return parseFloat(raw.toFixed(1));
  if (raw >= 1) return parseFloat(raw.toFixed(2));
  if (raw >= 0.1) return parseFloat(raw.toFixed(3));
  return Math.max(0.0001, parseFloat(raw.toFixed(4)));
}

export async function executeFuturesOpenPosition(
  symbol: string,
  positionSide: 'long' | 'short',
  price: number,
  usdtBudget: number,
  config: FuturesConfig
): Promise<{ success: boolean; message: string; updatedPositions: FuturesPosition[] }> {
  const isPaper = config.isPaperTrading ?? true;
  const positions = loadFuturesPositions(isPaper);
  const leverage = config.leverage || 5;
  const contracts = calculateContracts(usdtBudget, price, leverage);

  if (contracts <= 0) {
    return { success: false, message: `Budget $${usdtBudget} ไม่พอเปิด position (ต้องการ >= ${Math.ceil(price / leverage)} USDT)`, updatedPositions: positions };
  }

  const existingIdx = positions.findIndex(p => p.symbol === symbol && p.positionSide === positionSide);
  const nowStr = new Date().toLocaleTimeString('th-TH');
  const marginUsed = usdtBudget;

  if (!isPaper) {
    const orderRes = await executeRealFuturesOrder(
      { symbol, positionSide, action: 'open', contracts: String(contracts), leverage },
      config
    );
    if (!orderRes.success) {
      return { success: false, message: `🚨 ส่งออเดอร์ Futures ไม่สำเร็จ: ${orderRes.message}`, updatedPositions: positions };
    }
  }

  const tpPct = config.takeProfitPercent;
  const slPct = config.cutLossPercent;
  const tpPrice = positionSide === 'long'
    ? parseFloat((price * (1 + tpPct / 100)).toFixed(4))
    : parseFloat((price * (1 - tpPct / 100)).toFixed(4));
  const slPrice = positionSide === 'long'
    ? parseFloat((price * (1 - slPct / 100)).toFixed(4))
    : parseFloat((price * (1 + slPct / 100)).toFixed(4));

  if (existingIdx >= 0) {
    // Add-to-position (DCA tranche)
    const ex = positions[existingIdx];
    if (ex.tranchesCount >= config.maxTranches) {
      return { success: false, message: `ครบโควตา ${config.maxTranches} ไม้แล้วสำหรับ ${symbol} ${positionSide.toUpperCase()}`, updatedPositions: positions };
    }
    const newContracts = ex.contracts + contracts;
    const newInvested = ex.totalInvestedUsdt + marginUsed;
    const newAvgOpen = newInvested / newContracts * leverage; // weighted avg
    // Simpler weighted avg: (ex.avgOpenPrice * ex.contracts + price * contracts) / newContracts
    const newAvgOpenPrice = (ex.avgOpenPrice * ex.contracts + price * contracts) / newContracts;

    const updated: FuturesPosition = {
      ...ex,
      contracts: newContracts,
      notionalUsdt: newContracts * price,
      avgOpenPrice: parseFloat(newAvgOpenPrice.toFixed(4)),
      markPrice: price,
      unrealizedPnlUsdt: positionSide === 'long'
        ? (price - newAvgOpenPrice) * newContracts
        : (newAvgOpenPrice - price) * newContracts,
      pnlPercent: positionSide === 'long'
        ? ((price - newAvgOpenPrice) / newAvgOpenPrice) * 100
        : ((newAvgOpenPrice - price) / newAvgOpenPrice) * 100,
      takeProfitPrice: positionSide === 'long'
        ? parseFloat((newAvgOpenPrice * (1 + tpPct / 100)).toFixed(4))
        : parseFloat((newAvgOpenPrice * (1 - tpPct / 100)).toFixed(4)),
      cutLossPrice: positionSide === 'long'
        ? parseFloat((newAvgOpenPrice * (1 - slPct / 100)).toFixed(4))
        : parseFloat((newAvgOpenPrice * (1 + slPct / 100)).toFixed(4)),
      tranchesCount: ex.tranchesCount + 1,
      totalInvestedUsdt: newInvested,
    };

    positions[existingIdx] = updated;
    saveFuturesPositions(positions, isPaper);
    if (isPaper) {
      const cur = getPaperFuturesBalance();
      setPaperFuturesBalance(Math.max(0, cur - marginUsed));
    }

    const modeTag = isPaper ? '[PAPER]' : '🔥[REAL BITGET FUTURES]';
    return {
      success: true,
      message: `✓ ${modeTag} เพิ่มไม้ ${symbol} ${positionSide.toUpperCase()} ไม้ที่ ${updated.tranchesCount}/${config.maxTranches} @ $${price} (${contracts} contracts, AvgOpen: $${updated.avgOpenPrice})`,
      updatedPositions: positions,
    };
  } else {
    // New position
    if (positions.filter(p => p.positionSide === positionSide).length >= config.maxCoins) {
      return { success: false, message: `พอร์ตเต็ม ${config.maxCoins} ${positionSide.toUpperCase()} positions แล้ว`, updatedPositions: positions };
    }

    const newPosition: FuturesPosition = {
      symbol,
      baseCoin: symbol.replace('USDT', ''),
      positionSide,
      contracts,
      notionalUsdt: contracts * price,
      avgOpenPrice: price,
      markPrice: price,
      unrealizedPnlUsdt: 0,
      pnlPercent: 0,
      takeProfitPrice: tpPrice,
      cutLossPrice: slPrice,
      liquidationPrice: positionSide === 'long'
        ? parseFloat((price * (1 - 1 / leverage * 0.9)).toFixed(4))
        : parseFloat((price * (1 + 1 / leverage * 0.9)).toFixed(4)),
      leverage,
      isPaper,
      openTime: nowStr,
      tranchesCount: 1,
      totalInvestedUsdt: marginUsed,
    };

    positions.push(newPosition);
    saveFuturesPositions(positions, isPaper);
    setCooldown(symbol, 0.2); // 12-min cooldown to prevent rapid loop

    if (isPaper) {
      const cur = getPaperFuturesBalance();
      setPaperFuturesBalance(Math.max(0, cur - marginUsed));
    }

    const modeTag = isPaper ? '[PAPER]' : '🔥[REAL BITGET FUTURES]';
    return {
      success: true,
      message: `✓ ${modeTag} เปิด ${positionSide.toUpperCase()} ${symbol} [1/${config.maxTranches}] @ $${price} — ${contracts} contracts`,
      updatedPositions: positions,
    };
  }
}

export async function executeFuturesClosePosition(
  symbol: string,
  positionSide: 'long' | 'short',
  currentPrice: number,
  isCutLoss: boolean,
  config?: FuturesConfig
): Promise<{ success: boolean; message: string; realizedPnl: number; updatedPositions: FuturesPosition[] }> {
  const isPaper = config ? (config.isPaperTrading ?? true) : true;
  const positions = loadFuturesPositions(isPaper);
  const idx = positions.findIndex(p => p.symbol === symbol && p.positionSide === positionSide);

  if (idx === -1) {
    return { success: false, message: `ไม่พบ ${positionSide.toUpperCase()} ${symbol} ในพอร์ต`, realizedPnl: 0, updatedPositions: positions };
  }

  const pos = positions[idx];

  if (config && !config.isPaperTrading) {
    const orderRes = await executeRealFuturesOrder(
      { symbol, positionSide, action: 'close', contracts: String(pos.contracts), leverage: pos.leverage },
      config
    );
    if (!orderRes.success) {
      return { success: false, message: `🚨 ปิด Futures ไม่สำเร็จ: ${orderRes.message}`, realizedPnl: 0, updatedPositions: positions };
    }
  }

  // Realized PnL: Long = (close - open) * contracts; Short = (open - close) * contracts
  const realizedPnl = positionSide === 'long'
    ? (currentPrice - pos.avgOpenPrice) * pos.contracts
    : (pos.avgOpenPrice - currentPrice) * pos.contracts;

  const returnUsdt = pos.totalInvestedUsdt + realizedPnl;
  const pnlPct = ((currentPrice - pos.avgOpenPrice) / pos.avgOpenPrice) * 100 * (positionSide === 'short' ? -1 : 1);

  positions.splice(idx, 1);
  saveFuturesPositions(positions, isPaper);

  if (!config || config.isPaperTrading) {
    const cur = getPaperFuturesBalance();
    setPaperFuturesBalance(cur + returnUsdt);
  }

  if (isCutLoss) setCooldown(symbol, 3);

  const modeTag = config && !config.isPaperTrading ? '🔥[REAL LIVE] ' : '';
  const pnlSign = realizedPnl >= 0 ? '+' : '';
  const actionText = isCutLoss ? '🚨 CUT LOSS' : '🎯 TAKE PROFIT';
  const msg = `${modeTag}${actionText} ${positionSide.toUpperCase()} ${symbol} @ $${currentPrice}: กำไร ${pnlSign}$${realizedPnl.toFixed(2)} (${pnlSign}${pnlPct.toFixed(2)}%)`;

  return { success: true, message: msg, realizedPnl, updatedPositions: positions };
}

// ──────────────────────────────────────
// Update Live Prices
// ──────────────────────────────────────

export function updatePositionsWithLivePrices(
  positions: FuturesPosition[],
  priceMap: Record<string, number>
): FuturesPosition[] {
  return positions.map(p => {
    const mark = priceMap[p.symbol] ?? p.markPrice;
    const unrealized = p.positionSide === 'long'
      ? (mark - p.avgOpenPrice) * p.contracts
      : (p.avgOpenPrice - mark) * p.contracts;
    const pnlPct = p.avgOpenPrice > 0
      ? ((mark - p.avgOpenPrice) / p.avgOpenPrice) * 100 * (p.positionSide === 'short' ? -1 : 1)
      : 0;
    return { ...p, markPrice: mark, unrealizedPnlUsdt: unrealized, pnlPercent: pnlPct };
  });
}

// ──────────────────────────────────────
// AI Agent Consultation (Futures)
// ──────────────────────────────────────

export async function consultOpenRouterAgentFutures(
  candidate: {
    symbol: string;
    currentPrice: number;
    change24h: number;
    rsi15m: number;
    aiScore: number;
    fundingRate?: number;
    recentCandles?: any[];
  },
  config?: FuturesConfig
): Promise<AIAgentFuturesDecision | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config?.openrouterApiKey) headers['x-openrouter-key'] = config.openrouterApiKey;

    const res = await fetch('/api/agent', {
      method: 'POST',
      headers,
      body: JSON.stringify(candidate),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code === '00000' && json.data) return json.data;
    return null;
  } catch (err) {
    console.warn('consultOpenRouterAgentFutures failed:', err);
    return null;
  }
}

// ──────────────────────────────────────
// Edge Bot Integration
// ──────────────────────────────────────

export async function fetchEdgeBotStatus() {
  if (!EDGE_BOT_URL) return null;
  try {
    const res = await fetch(`${EDGE_BOT_URL}/api/status`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function triggerEdgeBotWake(reason = 'MANUAL_TRIGGER_FROM_DASHBOARD') {
  if (!EDGE_BOT_URL) return { success: true };
  try {
    const res = await fetch(`${EDGE_BOT_URL}/api/wake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
