"use client"

import * as React from "react"
import { Cpu, TrendingUp, TrendingDown, Clock } from "lucide-react"
import type { FuturesPosition, FuturesConfig } from "@/services/bitgetFutures"

type QuantLog = { id: string; time: string; action: string; symbol: string; note: string; color: string }

interface FuturesQuantBriefingProps {
  config: FuturesConfig
  positions: FuturesPosition[]
  paperBalance: number
  quantLogs: QuantLog[]
  totalUnrealizedPnl: number
  totalMarginUsed: number
}

export function FuturesQuantBriefing({
  config,
  positions,
  paperBalance,
  quantLogs,
  totalUnrealizedPnl,
  totalMarginUsed,
}: FuturesQuantBriefingProps) {
  const isPaper = config.isPaperTrading ?? true
  const longCount = positions.filter(p => p.positionSide === 'long').length
  const shortCount = positions.filter(p => p.positionSide === 'short').length
  const totalPositions = positions.length
  const pnlColor = totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
  const pnlSign = totalUnrealizedPnl >= 0 ? '+' : ''

  const statusText = React.useMemo(() => {
    if (totalPositions === 0) return 'สแกนตลาด Futures รอสัญญาณ Long/Short'
    if (totalUnrealizedPnl > 0) return `กำไรรวม ${pnlSign}$${totalUnrealizedPnl.toFixed(2)} USDT — เฝ้าระวัง TP`
    return `ขาดทุนรวม $${Math.abs(totalUnrealizedPnl).toFixed(2)} USDT — เฝ้าระวัง SL`
  }, [totalPositions, totalUnrealizedPnl, pnlSign])

  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-violet-500/5">
        <div className="flex items-center gap-2">
          <Cpu className="size-3.5 text-violet-400" />
          <span className="text-xs font-bold">Futures Quant Commander</span>
          {config.autoPilotEnabled && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-bold animate-pulse">
              ● AUTO-PILOT ON
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {isPaper ? 'PAPER' : '🔥 LIVE'} | {config.leverage}x Cross
        </span>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Status message */}
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
          {statusText}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/30 border border-border/30">
            <TrendingUp className="size-3.5 text-emerald-400 mb-1" />
            <div className="text-lg font-black text-foreground">{longCount}</div>
            <div className="text-[9px] text-muted-foreground">Long</div>
          </div>
          <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/30 border border-border/30">
            <TrendingDown className="size-3.5 text-rose-400 mb-1" />
            <div className="text-lg font-black text-foreground">{shortCount}</div>
            <div className="text-[9px] text-muted-foreground">Short</div>
          </div>
          <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/30 border border-border/30">
            <div className={`text-lg font-black ${pnlColor}`}>{pnlSign}{totalUnrealizedPnl.toFixed(0)}</div>
            <div className="text-[9px] text-muted-foreground">Unrealized $</div>
          </div>
          <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/30 border border-border/30">
            <div className="text-lg font-black text-foreground">${totalMarginUsed.toFixed(0)}</div>
            <div className="text-[9px] text-muted-foreground">Margin Used</div>
          </div>
        </div>

        {/* Risk parameters */}
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <span className="text-muted-foreground">Take Profit</span>
            <span className="font-bold text-emerald-400">+{config.takeProfitPercent}%</span>
          </div>
          <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-rose-500/5 border border-rose-500/20">
            <span className="text-muted-foreground">Cut Loss</span>
            <span className="font-bold text-rose-400">-{config.cutLossPercent}%</span>
          </div>
          <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-violet-500/5 border border-violet-500/20">
            <span className="text-muted-foreground">Balance</span>
            <span className="font-bold text-violet-400">${paperBalance.toFixed(0)}</span>
          </div>
        </div>

        {/* Recent logs */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
            <Clock className="size-3" />
            Recent Activity
          </div>
          <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
            {quantLogs.slice(0, 8).map(log => (
              <div
                key={log.id}
                className="flex items-start gap-2 text-[10px] px-2 py-1.5 rounded-lg bg-muted/20 border border-border/20"
              >
                <div className="size-1.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: log.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold" style={{ color: log.color }}>{log.action}</span>
                    <span className="text-violet-400 font-mono">{log.symbol}</span>
                    <span className="text-muted-foreground ml-auto">{log.time}</span>
                  </div>
                  <div className="text-muted-foreground mt-0.5 line-clamp-2">{log.note}</div>
                </div>
              </div>
            ))}

            {quantLogs.length === 0 && (
              <div className="text-center text-[10px] text-muted-foreground py-4">
                ยังไม่มีกิจกรรม — รอสัญญาณ Futures
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
