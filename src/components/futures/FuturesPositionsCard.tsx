"use client"

import * as React from "react"
import { TrendingUp, TrendingDown, X, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { FuturesPosition, FuturesConfig } from "@/services/bitgetFutures"

interface FuturesPositionsCardProps {
  title: string
  positionSide: 'long' | 'short'
  positions: FuturesPosition[]
  config: FuturesConfig
  onClose: (pos: FuturesPosition) => void
  onCutLoss: (pos: FuturesPosition) => void
  icon: React.ReactNode
}

export function FuturesPositionsCard({
  title,
  positionSide,
  positions,
  config,
  onClose,
  onCutLoss,
  icon,
}: FuturesPositionsCardProps) {
  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
      {/* Card Header */}
      <div className={`flex items-center justify-between px-3 py-2 border-b border-border/40 ${
        positionSide === 'long' ? 'bg-emerald-500/5' : 'bg-rose-500/5'
      }`}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-bold">{title}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
            positionSide === 'long'
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-rose-500/15 text-rose-400'
          }`}>
            {positions.length} / {config.maxCoins}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">{config.leverage}x Cross</span>
      </div>

      {/* Empty State */}
      {positions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
          {positionSide === 'long' ? (
            <TrendingUp className="size-8 opacity-20" />
          ) : (
            <TrendingDown className="size-8 opacity-20" />
          )}
          <span className="text-xs">ยังไม่มี {positionSide === 'long' ? 'Long' : 'Short'} positions</span>
        </div>
      )}

      {/* Position List */}
      {positions.length > 0 && (
        <div className="divide-y divide-border/30">
          {positions.map((pos, i) => {
            const pnlColor = pos.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
            const pnlSign = pos.pnlPercent >= 0 ? '+' : ''
            const isNearTP = positionSide === 'long'
              ? pos.markPrice >= pos.takeProfitPrice * 0.97
              : pos.markPrice <= pos.takeProfitPrice * 1.03
            const isNearSL = positionSide === 'long'
              ? pos.markPrice <= pos.cutLossPrice * 1.03
              : pos.markPrice >= pos.cutLossPrice * 0.97

            return (
              <div key={`${pos.symbol}-${pos.positionSide}-${i}`} className="p-3 flex flex-col gap-2">
                {/* Top row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      positionSide === 'long'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {positionSide.toUpperCase()}
                    </span>
                    <span className="text-sm font-bold">{pos.baseCoin}</span>
                    <span className="text-xs text-muted-foreground">{pos.contracts}c</span>
                    {pos.tranchesCount > 1 && (
                      <span className="text-[10px] text-violet-400">[{pos.tranchesCount}/{config.maxTranches}]</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(isNearTP || isNearSL) && (
                      <AlertTriangle className={`size-3 ${isNearTP ? 'text-amber-400' : 'text-rose-400'}`} />
                    )}
                    <span className={`text-sm font-bold ${pnlColor}`}>
                      {pnlSign}{pos.pnlPercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Price info */}
                <div className="grid grid-cols-4 gap-2 text-[10px]">
                  <div>
                    <div className="text-muted-foreground">Avg Open</div>
                    <div className="font-mono font-bold">${pos.avgOpenPrice.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Mark</div>
                    <div className="font-mono font-bold">${pos.markPrice.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-emerald-400">TP</div>
                    <div className="font-mono">${pos.takeProfitPrice.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-rose-400">SL</div>
                    <div className="font-mono">${pos.cutLossPrice.toLocaleString()}</div>
                  </div>
                </div>

                {/* PnL bar */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">
                    Margin: ${pos.totalInvestedUsdt.toFixed(2)} | Notional: ${pos.notionalUsdt.toFixed(2)}
                  </span>
                  <span className={`font-bold ${pnlColor}`}>
                    {pnlSign}${pos.unrealizedPnlUsdt.toFixed(2)} USDT
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] flex-1 border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400"
                    onClick={() => onClose(pos)}
                  >
                    Close @ Market
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] flex-1 border-rose-500/30 hover:border-rose-500/60 text-rose-400"
                    onClick={() => onCutLoss(pos)}
                  >
                    Cut Loss
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
