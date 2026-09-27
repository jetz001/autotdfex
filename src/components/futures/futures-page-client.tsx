"use client"

import * as React from "react"
import { Settings, Shield, Zap, RefreshCw, AlertCircle, Search, TrendingUp, TrendingDown, Activity, Wallet, ShieldCheck, Flame } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FuturesSettingsModal } from "./FuturesSettingsModal"
import { FuturesPositionsCard } from "./FuturesPositionsCard"
import { FuturesScreenerCard } from "./FuturesScreenerCard"
import { FuturesQuantBriefing } from "./FuturesQuantBriefing"
import { FuturesTradingChart } from "./FuturesTradingChart"
import { FuturesWalletCard } from "./FuturesWalletCard"
import { FuturesOrderFormCard } from "./FuturesOrderFormCard"
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
  resetPaperFuturesBalance,
  fetchBatchRealRsi,
  fetchRealFuturesPositions,
  fetchRealFuturesAccount,
  consultOpenRouterAgentFutures,
  syncFuturesConfigFromCloudflare,
  type FuturesConfig,
  type FuturesPosition,
  type FuturesTickerItem,
  type RealFuturesAccount,
} from "@/services/bitgetFutures"
import { loadQuantLogs, saveQuantLogs } from "@/services/quantEngine"

type QuantLog = { id: string; time: string; action: string; symbol: string; note: string; color: string }

function addLog(logs: QuantLog[], entry: Omit<QuantLog, "id" | "time">): QuantLog[] {
  const newLog: QuantLog = {
    id: Date.now().toString(),
    time: new Date().toLocaleTimeString("th-TH"),
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
    loadFuturesPositions(config.isPaperTrading ?? true)
  )
  const [isScanning, setIsScanning] = React.useState(false)
  const [actionAlert, setActionAlert] = React.useState<string | null>(null)
  const [paperBalance, setPaperBalanceState] = React.useState(getPaperFuturesBalance)
  const [realAccount, setRealAccount] = React.useState<RealFuturesAccount | null>(null)
  const [loadingReal, setLoadingReal] = React.useState(false)
  const [quantLogs, setQuantLogs] = React.useState<QuantLog[]>(() => loadQuantLogs(config.isPaperTrading ?? true))

  // Refresh real Bitget account balance
  const refreshRealAccount = React.useCallback(async (cfg?: FuturesConfig) => {
    setLoadingReal(true)
    try {
      const acc = await fetchRealFuturesAccount(cfg || config)
      setRealAccount(acc)
    } finally {
      setLoadingReal(false)
    }
  }, [config])

  // Sync config from Cloudflare on mount
  React.useEffect(() => {
    syncFuturesConfigFromCloudflare().then(async (synced) => {
      if (synced) {
        const targetMode = typeof synced.isPaperTrading === "boolean" ? synced.isPaperTrading : config.isPaperTrading
        const merged: FuturesConfig = {
          ...config,
          ...synced,
          apiKey: synced.apiKey || config.apiKey,
          secretKey: synced.secretKey || config.secretKey,
          passphrase: synced.passphrase || config.passphrase,
          openrouterApiKey: synced.openrouterApiKey || config.openrouterApiKey,
          isPaperTrading: targetMode,
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
          refreshRealAccount(merged)
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
      } else {
        refreshRealAccount()
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Periodic refresh: tickers + live position prices every 20s
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
        setPositions((prev) => updatePositionsWithLivePrices(prev, priceMap))

        // Fetch RSI batch
        const symbols = newTickers.map((t) => t.symbol)
        const rsiMap = await fetchBatchRealRsi(symbols)
        if (!mounted) return
        setTickers((prev) => prev.map((t) => ({ ...t, rsi15m: rsiMap[t.symbol] ?? t.rsi15m ?? 50 })))
      } catch {}
    }

    refresh()
    const interval = setInterval(refresh, 20000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
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

        const pnlPct =
          pos.positionSide === "long"
            ? ((mark - pos.avgOpenPrice) / pos.avgOpenPrice) * 100
            : ((pos.avgOpenPrice - mark) / pos.avgOpenPrice) * 100

        // Take Profit
        if (pnlPct >= config.takeProfitPercent) {
          const res = await executeFuturesClosePosition(pos.symbol, pos.positionSide, mark, false, config)
          if (res.success) {
            setPositions(res.updatedPositions)
            setPaperBalanceState(getPaperFuturesBalance())
            if (!isPaper) refreshRealAccount()
            setActionAlert(res.message)
            setQuantLogs((prev) => {
              const updated = addLog(prev, {
                action: `🎯 TAKE PROFIT ${pos.positionSide.toUpperCase()}`,
                symbol: pos.symbol,
                note: res.message,
                color: "#10b981",
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
            if (!isPaper) refreshRealAccount()
            setActionAlert(res.message)
            setQuantLogs((prev) => {
              const updated = addLog(prev, {
                action: `🚨 CUT LOSS ${pos.positionSide.toUpperCase()}`,
                symbol: pos.symbol,
                note: res.message,
                color: "#ef4444",
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
  }, [config, tickers, refreshRealAccount])

  // Clear action alert after 8s
  React.useEffect(() => {
    if (!actionAlert) return
    const t = setTimeout(() => setActionAlert(null), 8000)
    return () => clearTimeout(t)
  }, [actionAlert])

  // Switch between Paper and Real mode
  const handleToggleMode = React.useCallback(
    async (targetMode: boolean) => {
      const newCfg: FuturesConfig = { ...config, isPaperTrading: targetMode }
      setConfig(newCfg)
      saveFuturesConfig(newCfg)

      const modePositions = loadFuturesPositions(targetMode)
      setPositions(modePositions)
      const modeLogs = loadQuantLogs(targetMode)
      setQuantLogs(modeLogs)

      if (targetMode) {
        // Switched to Paper Mode
        setPaperBalanceState(getPaperFuturesBalance())
        setActionAlert("🛡️ สลับเป็นโหมดกระดานเปเป้อ (Paper Trading) | ซ้อมเทรดปลอดภัย 100% ไม่เสียเงินจริง")
      } else {
        // Switched to Real Mode
        setActionAlert("🔥 สลับเป็นโหมดเทรดเงินจริง (Bitget USDT-M Futures) | กำลังซิงค์พอร์ตและกระเป๋าจริง...")
        await refreshRealAccount(newCfg)
        const realPos = await fetchRealFuturesPositions(newCfg)
        if (realPos.length > 0) {
          setPositions(realPos)
          saveFuturesPositions(realPos, false)
        }
      }
    },
    [config, refreshRealAccount]
  )

  // Paper Balance Top-up & Reset handlers
  const handleTopUpPaper = (amount: number) => {
    const cur = getPaperFuturesBalance()
    const next = cur + amount
    setPaperFuturesBalance(next)
    setPaperBalanceState(next)
    setActionAlert(`✓ เติมเงินจำลอง +$${amount.toLocaleString()} USDT เรียบร้อยแล้ว (ยอดรวม: $${next.toLocaleString()} USDT)`)
  }

  const handleResetPaper = () => {
    const reset = resetPaperFuturesBalance(10000)
    setPaperBalanceState(reset)
    setActionAlert("✓ รีเซ็ตกระเป๋าจำลองเป็น $10,000 USDT เรียบร้อยแล้ว")
  }

  // Scan & Trade loop
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

      const balance = isPaper ? getPaperFuturesBalance() : (realAccount?.availableUsdt ?? 0)
      const reserveUsdt = (balance * (config.cashReservePercent || 30)) / 100
      const deployable = balance - reserveUsdt
      const longCount = currentPositions.filter((p) => p.positionSide === "long").length
      const shortCount = currentPositions.filter((p) => p.positionSide === "short").length

      let found = false

      for (const ticker of currentTickers) {
        const rsi = ticker.rsi15m ?? 50
        const change = ticker.change24h
        const score = ticker.aiScore ?? 50

        // Long candidate: Dip in Uptrend RSI < 45
        if (longCount < config.maxCoins && rsi < 45 && change > 0 && deployable >= 10) {
          const trancheBudget = Math.min((deployable * config.tranchePercent) / 100, deployable)
          if (trancheBudget < 10) continue

          const ai = await consultOpenRouterAgentFutures(
            {
              symbol: ticker.symbol,
              currentPrice: ticker.lastPr,
              change24h: change,
              rsi15m: rsi,
              aiScore: score,
              fundingRate: ticker.fundingRate,
            },
            config
          )

          if (ai?.action === "LONG" && (ai?.confidence ?? 0) >= 70) {
            const res = await executeFuturesOpenPosition(ticker.symbol, "long", ticker.lastPr, trancheBudget, config)
            if (res.success) {
              setPositions(res.updatedPositions)
              setPaperBalanceState(getPaperFuturesBalance())
              if (!isPaper) refreshRealAccount()
              setActionAlert(res.message)
              setQuantLogs((prev) => {
                const updated = addLog(prev, {
                  action: `🚀 OPEN LONG`,
                  symbol: ticker.symbol,
                  note: `${res.message} | AI: ${ai.reason}`,
                  color: "#10b981",
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

          const ai = await consultOpenRouterAgentFutures(
            {
              symbol: ticker.symbol,
              currentPrice: ticker.lastPr,
              change24h: change,
              rsi15m: rsi,
              aiScore: score,
              fundingRate: ticker.fundingRate,
            },
            config
          )

          if (ai?.action === "SHORT" && (ai?.confidence ?? 0) >= 70) {
            const res = await executeFuturesOpenPosition(ticker.symbol, "short", ticker.lastPr, trancheBudget, config)
            if (res.success) {
              setPositions(res.updatedPositions)
              setPaperBalanceState(getPaperFuturesBalance())
              if (!isPaper) refreshRealAccount()
              setActionAlert(res.message)
              setQuantLogs((prev) => {
                const updated = addLog(prev, {
                  action: `📉 OPEN SHORT`,
                  symbol: ticker.symbol,
                  note: `${res.message} | AI: ${ai.reason}`,
                  color: "#f59e0b",
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
        setActionAlert("🔍 สแกนเสร็จ — ไม่พบสัญญาณ Long/Short ที่ผ่านเกณฑ์ Quant ในขณะนี้")
      }
    } finally {
      setIsScanning(false)
    }
  }

  // Manual Open Position
  const handleManualOpen = async (side: "long" | "short", budget: number) => {
    const ticker = tickers.find((t) => t.symbol === selectedSymbol)
    const price = ticker?.lastPr || 0
    if (price <= 0) {
      setActionAlert("⚠️ ราคาเหรียญยังไม่พร้อม โปรดรอสักครู่")
      return
    }

    const res = await executeFuturesOpenPosition(selectedSymbol, side, price, budget, config)
    if (res.success) {
      setPositions(res.updatedPositions)
      setPaperBalanceState(getPaperFuturesBalance())
      if (!config.isPaperTrading) refreshRealAccount()
      setActionAlert(res.message)
      const isPaper = config.isPaperTrading ?? true
      setQuantLogs((prev) => {
        const updated = addLog(prev, {
          action: side === "long" ? "🚀 MANUAL LONG" : "📉 MANUAL SHORT",
          symbol: selectedSymbol,
          note: res.message,
          color: side === "long" ? "#10b981" : "#f59e0b",
        })
        saveQuantLogs(updated, isPaper)
        return updated
      })
    } else {
      setActionAlert(`🚨 ${res.message}`)
    }
  }

  // Manual Close Position
  const handleManualClose = async (pos: FuturesPosition, isCutLoss = false) => {
    const mark = pos.markPrice
    const res = await executeFuturesClosePosition(pos.symbol, pos.positionSide, mark, isCutLoss, config)
    setPositions(res.updatedPositions)
    setPaperBalanceState(getPaperFuturesBalance())
    if (!config.isPaperTrading) refreshRealAccount()
    setActionAlert(res.message)
    const isPaper = config.isPaperTrading ?? true
    setQuantLogs((prev) => {
      const updated = addLog(prev, {
        action: isCutLoss
          ? `🚨 MANUAL CUT LOSS ${pos.positionSide.toUpperCase()}`
          : `🎯 MANUAL CLOSE ${pos.positionSide.toUpperCase()}`,
        symbol: pos.symbol,
        note: res.message,
        color: isCutLoss ? "#ef4444" : "#10b981",
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
    if (!isPaper) refreshRealAccount(newCfg)
  }

  const isPaper = config.isPaperTrading ?? true
  const longPositions = positions.filter((p) => p.positionSide === "long")
  const shortPositions = positions.filter((p) => p.positionSide === "short")
  const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnlUsdt, 0)
  const totalMarginUsed = positions.reduce((sum, p) => sum + p.totalInvestedUsdt, 0)

  const selectedTicker = tickers.find((t) => t.symbol === selectedSymbol)
  const selectedPrice = selectedTicker?.lastPr || 0
  const selectedPosition = positions.find((p) => p.symbol === selectedSymbol)

  return (
    <div className="flex flex-col gap-3 w-full max-w-[1600px] mx-auto">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${
              isPaper
                ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            }`}
          >
            {isPaper ? <ShieldCheck className="size-3.5" /> : <Flame className="size-3.5" />}
            <span>{isPaper ? "กระดานเปเป้อ (PAPER FUTURES)" : "🔥 กระดานเทรดจริง (LIVE BITGET)"}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border/50 text-xs">
            <span className="text-[10px] text-muted-foreground">Leverage</span>
            <span className="font-bold text-amber-400">{config.leverage}x Cross</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border/50 text-xs">
            <span className="text-[10px] text-muted-foreground">TP/SL</span>
            <span className="font-bold text-emerald-400">+{config.takeProfitPercent}%</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-bold text-rose-400">-{config.cutLossPercent}%</span>
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
            {isScanning ? "กำลังสแกนตลาด..." : "Scan & Trade"}
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

      {/* Action Alert Banner */}
      {actionAlert && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs transition-all ${
            actionAlert.startsWith("🚨") || actionAlert.startsWith("⚠️")
              ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
              : actionAlert.startsWith("🎯") || actionAlert.startsWith("✓")
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-violet-500/10 border-violet-500/20 text-violet-300"
          }`}
        >
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
          <span>{actionAlert}</span>
        </div>
      )}

      {/* Dedicated Wallet Card (Paper vs Real Balance Inspection) */}
      <FuturesWalletCard
        config={config}
        paperBalance={paperBalance}
        realAccount={realAccount}
        loadingReal={loadingReal}
        totalUnrealizedPnl={totalUnrealizedPnl}
        totalMarginUsed={totalMarginUsed}
        onToggleMode={handleToggleMode}
        onTopUpPaper={handleTopUpPaper}
        onResetPaper={handleResetPaper}
        onRefreshReal={() => refreshRealAccount()}
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Left Column: Screener + Manual Order Form */}
        <div className="xl:col-span-1 flex flex-col gap-3">
          <FuturesScreenerCard
            tickers={tickers}
            config={config}
            positions={positions}
            onSelectSymbol={setSelectedSymbol}
            selectedSymbol={selectedSymbol}
          />

          <FuturesOrderFormCard
            symbol={selectedSymbol}
            currentPrice={selectedPrice}
            config={config}
            ticker={selectedTicker}
            onOpenPosition={handleManualOpen}
          />
        </div>

        {/* Center + Right Column: Chart + Briefing + Positions */}
        <div className="xl:col-span-2 flex flex-col gap-3">
          {/* Interactive Trading Chart (Canvas + TradingView) */}
          <FuturesTradingChart
            symbol={selectedSymbol}
            currentPrice={selectedPrice}
            position={selectedPosition}
            ticker={selectedTicker}
          />

          {/* Quant Commander Briefing & Activity Logs */}
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
