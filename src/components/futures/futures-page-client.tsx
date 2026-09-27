"use client"

import * as React from "react"
import { Settings, Shield, Zap, RefreshCw, AlertCircle, Search, TrendingUp, TrendingDown, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FuturesSettingsModal } from "./FuturesSettingsModal"
import { FuturesPositionsCard } from "./FuturesPositionsCard"
import { FuturesScreenerCard } from "./FuturesScreenerCard"
import { FuturesQuantBriefing } from "./FuturesQuantBriefing"
import {
  loadFuturesConfig,
  saveFuturesConfig,
  loadFuturesPositions,
  saveFuturesPositions,
  fetchTopBitgetFuturesTickers,
  executeFuturesOpenPosition,
  executeFuturesClosePosition,
  updatePositionsWithLivePrices,
  getPaperFuturesBalance,
  setPaperFuturesBalance,
  fetchBatchRealRsi,
  fetchRealFuturesPositions,
  consultOpenRouterAgentFutures,
  syncFuturesConfigFromCloudflare,
  fetchFundingRate,
  calculateContracts,
  EDGE_BOT_URL,
  type FuturesConfig,
  type FuturesPosition,
  type FuturesTickerItem,
} from "@/services/bitgetFutures"
import { loadQuantLogs, saveQuantLogs } from "@/services/quantEngine"

type QuantLog = { id: string; time: string; action: string; symbol: string; note: string; color: string }

function addLog(logs: QuantLog[], entry: Omit<QuantLog, 'id' | 'time'>): QuantLog[] {
  const newLog: QuantLog = {
    id: Date.now().toString(),
    time: new Date().toLocaleTimeString('th-TH'),
    ...entry,
  }
  return [newLog, ...logs].slice(0, 30)
}

export function FuturesPageClient() {
  const [config, setConfig] = React.useState<FuturesConfig>(loadFuturesConfig)
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)
  const [selectedSymbol, setSelectedSymbol] = React.useState("BTCUSDT")
  const [tickers, setTickers] = React.useState<FuturesTickerItem[]>([])
  const [positions, setPositions] = React.useState<FuturesPosition[]>(() =>
    loadFuturesPositions(true)
  )
  const [isScanning, setIsScanning] = React.useState(false)
  const [actionAlert, setActionAlert] = React.useState<string | null>(null)
  const [paperBalance, setPaperBalanceState] = React.useState(getPaperFuturesBalance)
  const [quantLogs, setQuantLogs] = React.useState<QuantLog[]>(() => loadQuantLogs(true))

  // Sync config from Cloudflare on mount
  React.useEffect(() => {
    syncFuturesConfigFromCloudflare().then((synced) => {
      if (synced) {
        const merged: FuturesConfig = {
          ...config,
          ...synced,
          apiKey: synced.apiKey || config.apiKey,
          secretKey: synced.secretKey || config.secretKey,
          passphrase: synced.passphrase || config.passphrase,
          openrouterApiKey: synced.openrouterApiKey || config.openrouterApiKey,
          isPaperTrading: typeof synced.isPaperTrading === "boolean" ? synced.isPaperTrading : config.isPaperTrading,
          leverage: synced.leverage ?? config.leverage,
        } as FuturesConfig
        setConfig(merged)
        saveFuturesConfig(merged)

        // Load positions for the synced mode
        const isPaper = merged.isPaperTrading ?? true
        if (!isPaper && merged.apiKey) {
          fetchRealFuturesPositions(merged).then((realPositions) => {
            if (realPositions.length > 0) {
              setPositions(realPositions)
              saveFuturesPositions(realPositions, false)
            }
          })
        } else {
          setPositions(loadFuturesPositions(isPaper))
        }

        if (synced.paperBalance !== undefined) {
          setPaperFuturesBalance(synced.paperBalance)
          setPaperBalanceState(synced.paperBalance)
        }

        if (Array.isArray(synced.quantLogs) && synced.quantLogs.length > 0) {
          setQuantLogs(synced.quantLogs)
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Periodic refresh: tickers + live position prices every 30s
  React.useEffect(() => {
    let mounted = true
    const refresh = async () => {
      try {
        const newTickers = await fetchTopBitgetFuturesTickers()
        if (!mounted) return
        setTickers(newTickers)

        // Update live prices on positions
        const priceMap: Record<string, number> = {}
        for (const t of newTickers) priceMap[t.symbol] = t.lastPr
        setPositions(prev => updatePositionsWithLivePrices(prev, priceMap))

        // Fetch RSI batch
        const symbols = newTickers.map(t => t.symbol)
        const rsiMap = await fetchBatchRealRsi(symbols)
        if (!mounted) return
        setTickers(prev => prev.map(t => ({ ...t, rsi15m: rsiMap[t.symbol] ?? t.rsi15m ?? 50 })))
      } catch {}
    }

    refresh()
    const interval = setInterval(refresh, 30000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  // Auto-pilot: check TP/SL on positions every 15s
  React.useEffect(() => {
    if (!config.autoPilotEnabled) return
    const check = async () => {
      const isPaper = config.isPaperTrading ?? true
      const currentPositions = loadFuturesPositions(isPaper)
      if (currentPositions.length === 0) return

      const priceMap: Record<string, number> = {}
      for (const t of tickers) priceMap[t.symbol] = t.lastPr

      for (const pos of currentPositions) {
        const mark = priceMap[pos.symbol] || pos.markPrice
        if (!mark || mark <= 0) continue

        const pnlPct = pos.positionSide === 'long'
          ? ((mark - pos.avgOpenPrice) / pos.avgOpenPrice) * 100
          : ((pos.avgOpenPrice - mark) / pos.avgOpenPrice) * 100

        // Take Profit
        if (pnlPct >= config.takeProfitPercent) {
          const res = await executeFuturesClosePosition(pos.symbol, pos.positionSide, mark, false, config)
          if (res.success) {
            setPositions(res.updatedPositions)
            setPaperBalanceState(getPaperFuturesBalance())
            setActionAlert(res.message)
            setQuantLogs(prev => {
              const updated = addLog(prev, {
                action: `🎯 TAKE PROFIT ${pos.positionSide.toUpperCase()}`,
                symbol: pos.symbol,
                note: res.message,
                color: '#10b981',
              })
              saveQuantLogs(updated, isPaper)
              return updated
            })
          }
        }
        // Cut Loss
        else if (pnlPct <= -config.cutLossPercent) {
          const res = await executeFuturesClosePosition(pos.symbol, pos.positionSide, mark, true, config)
          if (res.success) {
            setPositions(res.updatedPositions)
            setPaperBalanceState(getPaperFuturesBalance())
            setActionAlert(res.message)
            setQuantLogs(prev => {
              const updated = addLog(prev, {
                action: `🚨 CUT LOSS ${pos.positionSide.toUpperCase()}`,
                symbol: pos.symbol,
                note: res.message,
                color: '#ef4444',
              })
              saveQuantLogs(updated, isPaper)
              return updated
            })
          }
        }
      }
    }

    const interval = setInterval(check, 15000)
    return () => clearInterval(interval)
  }, [config, tickers])

  // Clear action alert after 8s
  React.useEffect(() => {
    if (!actionAlert) return
    const t = setTimeout(() => setActionAlert(null), 8000)
    return () => clearTimeout(t)
  }, [actionAlert])

  const handleScanAndTrade = async () => {
    setIsScanning(true)
    try {
      const isPaper = config.isPaperTrading ?? true
      const currentPositions = loadFuturesPositions(isPaper)
      const currentTickers = tickers.length > 0 ? tickers : await fetchTopBitgetFuturesTickers()
      if (currentTickers.length === 0 && tickers.length === 0) {
        setActionAlert("⚠️ ไม่สามารถโหลดข้อมูลตลาด Futures ได้")
        return
      }

      const balance = isPaper ? getPaperFuturesBalance() : 0
      const reserveUsdt = (balance * (config.cashReservePercent || 30)) / 100
      const deployable = balance - reserveUsdt
      const longCount = currentPositions.filter(p => p.positionSide === 'long').length
      const shortCount = currentPositions.filter(p => p.positionSide === 'short').length

      let found = false
      const priceMap: Record<string, number> = {}
      for (const t of currentTickers) priceMap[t.symbol] = t.lastPr

      for (const ticker of currentTickers) {
        const rsi = ticker.rsi15m ?? 50
        const change = ticker.change24h
        const score = ticker.aiScore ?? 50

        // Long candidate: Dip in Uptrend RSI < 45
        if (longCount < config.maxCoins && rsi < 45 && change > 0 && deployable >= 10) {
          const trancheBudget = Math.min((deployable * config.tranchePercent) / 100, deployable)
          if (trancheBudget < 10) continue

          // Consult AI agent for confirmation
          const ai = await consultOpenRouterAgentFutures({
            symbol: ticker.symbol,
            currentPrice: ticker.lastPr,
            change24h: change,
            rsi15m: rsi,
            aiScore: score,
            fundingRate: ticker.fundingRate,
          }, config)

          if (ai?.action === 'LONG' && (ai?.confidence ?? 0) >= 70) {
            const res = await executeFuturesOpenPosition(ticker.symbol, 'long', ticker.lastPr, trancheBudget, config)
            if (res.success) {
              setPositions(res.updatedPositions)
              setPaperBalanceState(getPaperFuturesBalance())
              setActionAlert(res.message)
              setQuantLogs(prev => {
                const updated = addLog(prev, {
                  action: `🚀 OPEN LONG`,
                  symbol: ticker.symbol,
                  note: `${res.message} | AI: ${ai.reason}`,
                  color: '#10b981',
                })
                saveQuantLogs(updated, isPaper)
                return updated
              })
              found = true
              break
            }
          }
        }

        // Short candidate: Overbought RSI > 65
        if (shortCount < config.maxCoins && rsi > 65 && change > 5 && deployable >= 10) {
          const trancheBudget = Math.min((deployable * config.tranchePercent) / 100, deployable)
          if (trancheBudget < 10) continue

          const ai = await consultOpenRouterAgentFutures({
            symbol: ticker.symbol,
            currentPrice: ticker.lastPr,
            change24h: change,
            rsi15m: rsi,
            aiScore: score,
            fundingRate: ticker.fundingRate,
          }, config)

          if (ai?.action === 'SHORT' && (ai?.confidence ?? 0) >= 70) {
            const res = await executeFuturesOpenPosition(ticker.symbol, 'short', ticker.lastPr, trancheBudget, config)
            if (res.success) {
              setPositions(res.updatedPositions)
              setPaperBalanceState(getPaperFuturesBalance())
              setActionAlert(res.message)
              setQuantLogs(prev => {
                const updated = addLog(prev, {
                  action: `📉 OPEN SHORT`,
                  symbol: ticker.symbol,
                  note: `${res.message} | AI: ${ai.reason}`,
                  color: '#f59e0b',
                })
                saveQuantLogs(updated, isPaper)
                return updated
              })
              found = true
              break
            }
          }
        }
      }

      if (!found) {
        setActionAlert("🔍 สแกนเสร็จ — ไม่พบสัญญาณ Long/Short ที่ผ่าน Quant Filter ในขณะนี้")
        setQuantLogs(prev => addLog(prev, {
          action: '🔍 SCAN COMPLETE',
          symbol: 'MARKET',
          note: 'สแกนครบแล้ว — ไม่พบ opportunity ที่ตรงเงื่อนไข Quant',
          color: '#6b7280',
        }))
      }
    } finally {
      setIsScanning(false)
    }
  }

  const handleManualClose = async (pos: FuturesPosition, isCutLoss = false) => {
    const mark = pos.markPrice
    const res = await executeFuturesClosePosition(pos.symbol, pos.positionSide, mark, isCutLoss, config)
    setPositions(res.updatedPositions)
    setPaperBalanceState(getPaperFuturesBalance())
    setActionAlert(res.message)
    const isPaper = config.isPaperTrading ?? true
    setQuantLogs(prev => {
      const updated = addLog(prev, {
        action: isCutLoss ? `🚨 MANUAL CUT LOSS ${pos.positionSide.toUpperCase()}` : `🎯 MANUAL CLOSE ${pos.positionSide.toUpperCase()}`,
        symbol: pos.symbol,
        note: res.message,
        color: isCutLoss ? '#ef4444' : '#10b981',
      })
      saveQuantLogs(updated, isPaper)
      return updated
    })
  }

  const handleConfigSave = (newCfg: FuturesConfig) => {
    setConfig(newCfg)
    saveFuturesConfig(newCfg)
    const isPaper = newCfg.isPaperTrading ?? true
    setPositions(loadFuturesPositions(isPaper))
    setPaperBalanceState(getPaperFuturesBalance())
  }

  const isPaper = config.isPaperTrading ?? true
  const longPositions = positions.filter(p => p.positionSide === 'long')
  const shortPositions = positions.filter(p => p.positionSide === 'short')
  const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnlUsdt, 0)
  const totalMarginUsed = positions.reduce((sum, p) => sum + p.totalInvestedUsdt, 0)

  return (
    <div className="flex flex-col gap-3 w-full max-w-[1600px] mx-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/20">
            <Activity className="size-3.5 text-violet-400" />
            <span className="text-xs font-bold text-violet-400">
              {isPaper ? 'PAPER FUTURES' : '🔥 LIVE FUTURES'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-card border border-border/50">
            <span className="text-[10px] text-muted-foreground">Balance</span>
            <span className="text-xs font-bold text-foreground">
              ${paperBalance.toFixed(2)} USDT
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-card border border-border/50">
            <span className="text-[10px] text-muted-foreground">Unrealized PnL</span>
            <span className={`text-xs font-bold ${totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalUnrealizedPnl >= 0 ? '+' : ''}{totalUnrealizedPnl.toFixed(2)} USDT
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-card border border-border/50">
            <span className="text-[10px] text-muted-foreground">Leverage</span>
            <span className="text-xs font-bold text-amber-400">{config.leverage}x Cross</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs border-violet-500/30 hover:border-violet-500/60"
            onClick={handleScanAndTrade}
            disabled={isScanning}
          >
            {isScanning ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <Search className="size-3.5 text-violet-400" />
            )}
            {isScanning ? 'กำลังสแกน...' : 'Scan & Trade'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings className="size-3.5" />
            Settings
          </Button>
        </div>
      </div>

      {/* Action Alert */}
      {actionAlert && (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
          actionAlert.startsWith('🚨') || actionAlert.startsWith('⚠️')
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : actionAlert.startsWith('🎯')
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-violet-500/10 border-violet-500/20 text-violet-300'
        }`}>
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
          <span>{actionAlert}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Left: Screener */}
        <div className="xl:col-span-1">
          <FuturesScreenerCard
            tickers={tickers}
            config={config}
            positions={positions}
            onSelectSymbol={setSelectedSymbol}
            selectedSymbol={selectedSymbol}
          />
        </div>

        {/* Center + Right: Positions + Briefing */}
        <div className="xl:col-span-2 flex flex-col gap-3">
          {/* Quant Briefing */}
          <FuturesQuantBriefing
            config={config}
            positions={positions}
            paperBalance={paperBalance}
            quantLogs={quantLogs}
            totalUnrealizedPnl={totalUnrealizedPnl}
            totalMarginUsed={totalMarginUsed}
          />

          {/* Long Positions */}
          <FuturesPositionsCard
            title="Long Positions"
            positionSide="long"
            positions={longPositions}
            config={config}
            onClose={(pos) => handleManualClose(pos, false)}
            onCutLoss={(pos) => handleManualClose(pos, true)}
            icon={<TrendingUp className="size-4 text-emerald-400" />}
          />

          {/* Short Positions */}
          <FuturesPositionsCard
            title="Short Positions"
            positionSide="short"
            positions={shortPositions}
            config={config}
            onClose={(pos) => handleManualClose(pos, false)}
            onCutLoss={(pos) => handleManualClose(pos, true)}
            icon={<TrendingDown className="size-4 text-rose-400" />}
          />
        </div>
      </div>

      {/* Settings Modal */}
      <FuturesSettingsModal
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        config={config}
        onSave={handleConfigSave}
      />
    </div>
  )
}
