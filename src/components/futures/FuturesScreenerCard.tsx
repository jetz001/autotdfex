"use client"

import * as React from "react"
import { Search, TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { FuturesTickerItem, FuturesPosition, FuturesConfig } from "@/services/bitgetFutures"

interface FuturesScreenerCardProps {
  tickers: FuturesTickerItem[]
  config: FuturesConfig
  positions: FuturesPosition[]
  onSelectSymbol: (symbol: string) => void
  selectedSymbol: string
}

export function FuturesScreenerCard({
  tickers,
  config,
  positions,
  onSelectSymbol,
  selectedSymbol,
}: FuturesScreenerCardProps) {
  const heldSymbols = new Set(positions.map(p => p.symbol))

  const scoredTickers = React.useMemo(() => {
    return tickers.map(t => {
      const rsi = t.rsi15m ?? 50
      const change = t.change24h
      const vol = t.usdtVolume
      const high = t.high24h
      const low = t.low24h
      const range = high - low
      const pos24h = range > 0 ? (t.lastPr - low) / range : 0.5

      // Long score: Dip in Uptrend
      let longScore = 10
      if (change >= 1 && change <= 6) longScore += 35
      else if (change > 0) longScore += 15
      if (pos24h >= 0.35 && pos24h <= 0.55) longScore += 35
      else if (pos24h >= 0.25) longScore += 20
      if (vol > 20000000) longScore += 25
      else if (vol > 5000000) longScore += 15
      if (rsi < 40) longScore += 15
      else if (rsi < 45) longScore += 8

      // Short score: Overbought
      let shortScore = 10
      if (change > 8) shortScore += 35
      else if (change > 5) shortScore += 20
      if (pos24h > 0.85) shortScore += 35
      else if (pos24h > 0.75) shortScore += 20
      if (vol > 20000000) shortScore += 20
      if (rsi > 70) shortScore += 15
      else if (rsi > 65) shortScore += 8

      const bestScore = Math.max(longScore, shortScore)
      const signal = bestScore >= 80 ? (longScore >= shortScore ? 'LONG' : 'SHORT') : 'WATCH'

      return {
        ...t,
        longScore: Math.min(99, longScore),
        shortScore: Math.min(99, shortScore),
        aiScore: bestScore,
        signal: heldSymbols.has(t.symbol) ? 'WATCH' : signal,
      }
    }).sort((a, b) => b.aiScore - a.aiScore)
  }, [tickers, heldSymbols])

  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-violet-500/5">
        <div className="flex items-center gap-2">
          <Search className="size-3.5 text-violet-400" />
          <span className="text-xs font-bold">Futures AI Screener</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{scoredTickers.length} pairs</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-6 gap-1 px-3 py-1.5 text-[10px] text-muted-foreground font-medium border-b border-border/30">
        <div className="col-span-2">Symbol</div>
        <div className="text-center font-semibold text-violet-400">Score</div>
        <div className="text-right">RSI</div>
        <div className="text-right">24h</div>
        <div className="text-right">Signal</div>
      </div>

      {/* Ticker list with responsive scrollable height */}
      <div className="overflow-y-auto max-h-[280px] divide-y divide-border/20">
        {scoredTickers.map(t => {
          const isSelected = t.symbol === selectedSymbol
          const isHeld = heldSymbols.has(t.symbol)
          const rsi = t.rsi15m ?? 50
          const rsiColor = rsi < 40 ? 'text-emerald-400' : rsi > 65 ? 'text-rose-400' : 'text-muted-foreground'
          const changeColor = t.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'

          return (
            <div
              key={t.symbol}
              className={`grid grid-cols-6 gap-1 px-3 py-2 text-[11px] cursor-pointer transition-colors ${
                isSelected ? 'bg-violet-500/10' : 'hover:bg-muted/40'
              }`}
              onClick={() => onSelectSymbol(t.symbol)}
            >
              <div className="col-span-2 flex items-center gap-1.5">
                {isHeld && <div className="size-1.5 rounded-full bg-violet-400 shrink-0" />}
                <div>
                  <div className="font-bold">{t.baseCoin}</div>
                  <div className="text-[9px] text-muted-foreground">${t.lastPr.toLocaleString()}</div>
                </div>
              </div>

              {/* AI Quant Score Column */}
              <div className="flex items-center justify-center">
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    t.aiScore >= 85
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                      : t.aiScore >= 70
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  title={`AI Multi-Factor Score: ${t.aiScore}/100`}
                >
                  {t.aiScore}
                </span>
              </div>

              <div className={`text-right font-mono ${rsiColor}`}>{rsi.toFixed(0)}</div>
              <div className={`text-right font-mono ${changeColor}`}>
                {t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(2)}%
              </div>
              <div className="text-right">
                {t.signal === 'LONG' ? (
                  <span className="inline-flex items-center gap-0.5 text-emerald-400 font-bold">
                    <TrendingUp className="size-3" />L
                  </span>
                ) : t.signal === 'SHORT' ? (
                  <span className="inline-flex items-center gap-0.5 text-rose-400 font-bold">
                    <TrendingDown className="size-3" />S
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    <Minus className="size-3 inline" />
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {scoredTickers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <Search className="size-8 opacity-20" />
            <span className="text-xs">กำลังโหลดข้อมูล Futures...</span>
          </div>
        )}
      </div>
    </div>
  )
}
