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
    <Card className="border-border/40 bg-card overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between py-2.5 px-3 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-violet-400" />
          <CardTitle className="text-xs font-bold text-foreground">
            คำสั่งเทรดทันที: {symbol}
          </CardTitle>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPaper ? "bg-violet-500/20 text-violet-400" : "bg-amber-500/20 text-amber-400"}`}>
          {isPaper ? "กระดานเปเป้อ (จำลอง)" : "กระดานจริง (Live Bitget)"}
        </span>
      </CardHeader>

      <CardContent className="p-3 flex flex-col gap-3">
        {/* Margin Input */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-medium">ทุนมาร์จิ้น (USDT):</span>
            <span className="text-muted-foreground">Leverage: <strong className="text-amber-400">{leverage}x Cross</strong></span>
          </div>

          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              value={usdtAmount}
              onChange={(e) => setUsdtAmount(e.target.value)}
              min={5}
              max={10000}
              className="h-8 text-xs font-mono bg-background"
              placeholder="จำนวนเงิน USDT"
            />
            {["10", "25", "50", "100"].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setUsdtAmount(val)}
                className={`h-8 px-2 text-[10px] font-bold rounded-md border border-border/40 transition-colors ${
                  usdtAmount === val ? "bg-violet-600 text-white" : "bg-muted/40 hover:bg-muted text-muted-foreground"
                }`}
              >
                ${val}
              </button>
            ))}
          </div>
        </div>

        {/* Calculation Summary */}
        <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-muted/30 border border-border/30 text-[10px]">
          <div>
            <div className="text-muted-foreground">ขนาดสัญญา (Size)</div>
            <div className="font-mono font-bold text-foreground">{contracts} contracts</div>
          </div>
          <div>
            <div className="text-muted-foreground">มูลค่าเต็ม (Notional)</div>
            <div className="font-mono font-bold text-foreground">${notional.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">TP / SL เป้าหมาย</div>
            <div className="font-mono font-bold text-violet-400">+{tpPct}% / -{slPct}%</div>
          </div>
        </div>

        {/* Action Buttons: OPEN LONG / OPEN SHORT */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white flex flex-col items-center justify-center p-1 text-xs font-bold shadow-xs"
            onClick={() => handleTrade("long")}
            disabled={loading || disabled || contracts <= 0}
          >
            <div className="flex items-center gap-1">
              <TrendingUp className="size-3.5" />
              <span>เปิด LONG (แทงขึ้น)</span>
            </div>
            <span className="text-[9px] font-normal opacity-80">TP: ${estLongTp.toFixed(2)}</span>
          </Button>

          <Button
            className="h-10 bg-rose-600 hover:bg-rose-700 text-white flex flex-col items-center justify-center p-1 text-xs font-bold shadow-xs"
            onClick={() => handleTrade("short")}
            disabled={loading || disabled || contracts <= 0}
          >
            <div className="flex items-center gap-1">
              <TrendingDown className="size-3.5" />
              <span>เปิด SHORT (แทงลง)</span>
            </div>
            <span className="text-[9px] font-normal opacity-80">TP: ${estShortTp.toFixed(2)}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
