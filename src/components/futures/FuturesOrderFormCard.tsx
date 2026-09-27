"use client"

import * as React from "react"
import { TrendingUp, TrendingDown, Zap, Shield, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FuturesConfig, FuturesTickerItem } from "@/services/bitgetFutures"
import { calculateContracts } from "@/services/bitgetFutures"

interface Props {
  symbol: string
  currentPrice: number
  config: FuturesConfig
  ticker?: FuturesTickerItem
  onOpenPosition: (positionSide: "long" | "short", usdtBudget: number) => Promise<void>
  disabled?: boolean
}

export function FuturesOrderFormCard({
  symbol,
  currentPrice,
  config,
  ticker,
  onOpenPosition,
  disabled,
}: Props) {
  const [usdtAmount, setUsdtAmount] = React.useState("10")
  const [loading, setLoading] = React.useState(false)

  const effectivePrice = currentPrice > 0 ? currentPrice : ticker?.lastPr || 0
  const budget = parseFloat(usdtAmount) || 10
  const leverage = config.leverage || 5
  const contracts = calculateContracts(budget, effectivePrice, leverage)
  const notional = contracts * effectivePrice

  // Estimated TP & SL
  const tpPct = config.takeProfitPercent || 3.5
  const slPct = config.cutLossPercent || 5.0
  const estLongTp = effectivePrice * (1 + tpPct / 100)
  const estLongSl = effectivePrice * (1 - slPct / 100)
  const estShortTp = effectivePrice * (1 - tpPct / 100)
  const estShortSl = effectivePrice * (1 + slPct / 100)

  const handleTrade = async (side: "long" | "short") => {
    if (budget < 5 || contracts <= 0 || loading || disabled || effectivePrice <= 0) return
    try {
      setLoading(true)
      await onOpenPosition(side, budget)
    } finally {
      setLoading(false)
    }
  }

  const isPaper = config.isPaperTrading ?? true

  return (
    <Card className="border border-border/50 bg-card rounded-xl shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 border-b border-border/30 bg-muted/20 rounded-t-xl">
        <div className="flex items-center gap-1.5 min-w-0">
          <Zap className="size-4 text-violet-400 shrink-0" />
          <CardTitle className="text-xs font-bold text-foreground truncate">
            คำสั่งเทรดทันที: {symbol}
          </CardTitle>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
            isPaper
              ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
          }`}
        >
          {isPaper ? "กระดานเปเป้อ (จำลอง)" : "กระดานจริง (Live Bitget)"}
        </span>
      </CardHeader>

      <CardContent className="p-3 flex flex-col gap-2.5">
        {/* Margin Input */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-medium">ทุนมาร์จิ้น (USDT):</span>
            <span className="text-muted-foreground">
              Leverage: <strong className="text-amber-400">{leverage}x Cross</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
            <Input
              type="number"
              value={usdtAmount}
              onChange={(e) => setUsdtAmount(e.target.value)}
              min={5}
              max={10000}
              className="h-8 text-xs font-mono bg-background flex-1 min-w-[70px]"
              placeholder="USDT"
            />
            <div className="flex items-center gap-1 shrink-0">
              {["10", "25", "50", "100"].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setUsdtAmount(val)}
                  className={`h-8 px-2 text-[10px] font-bold rounded-md border border-border/40 transition-colors ${
                    usdtAmount === val
                      ? "bg-violet-600 text-white border-violet-500 shadow-xs"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  ${val}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calculation Summary */}
        <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-muted/30 border border-border/30 text-[10px]">
          <div>
            <div className="text-muted-foreground text-[9px]">ขนาดสัญญา (Size)</div>
            <div className="font-mono font-bold text-foreground truncate">{contracts} ct</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[9px]">มูลค่าเต็ม (Notional)</div>
            <div className="font-mono font-bold text-foreground truncate">${notional.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[9px]">TP / SL เป้าหมาย</div>
            <div className="font-mono font-bold text-violet-400 truncate">
              +{tpPct}% / -{slPct}%
            </div>
          </div>
        </div>

        {/* Action Buttons: OPEN LONG / OPEN SHORT */}
        <div className="grid grid-cols-2 gap-2 pt-0.5 pb-1">
          <Button
            type="button"
            className="h-11 bg-emerald-600 hover:bg-emerald-500 text-white flex flex-col items-center justify-center p-1 text-xs font-bold shadow-md transition-all active:scale-[0.98] cursor-pointer"
            onClick={() => handleTrade("long")}
            disabled={loading || disabled || contracts <= 0}
          >
            <div className="flex items-center gap-1">
              <TrendingUp className="size-3.5" />
              <span>เปิด LONG (แทงขึ้น)</span>
            </div>
            <span className="text-[9px] font-normal text-emerald-100">
              TP: ${estLongTp > 0 ? estLongTp.toFixed(2) : "--"}
            </span>
          </Button>

          <Button
            type="button"
            className="h-11 bg-rose-600 hover:bg-rose-500 text-white flex flex-col items-center justify-center p-1 text-xs font-bold shadow-md transition-all active:scale-[0.98] cursor-pointer"
            onClick={() => handleTrade("short")}
            disabled={loading || disabled || contracts <= 0}
          >
            <div className="flex items-center gap-1">
              <TrendingDown className="size-3.5" />
              <span>เปิด SHORT (แทงลง)</span>
            </div>
            <span className="text-[9px] font-normal text-rose-100">
              TP: ${estShortTp > 0 ? estShortTp.toFixed(2) : "--"}
            </span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
