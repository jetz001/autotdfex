"use client"

import * as React from "react"
import {
  Wallet,
  ShieldCheck,
  Flame,
  RefreshCw,
  PlusCircle,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Layers,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { FuturesConfig, RealFuturesAccount } from "@/services/bitgetFutures"

interface Props {
  config: FuturesConfig
  paperBalance: number
  realAccount: RealFuturesAccount | null
  loadingReal: boolean
  totalUnrealizedPnl: number
  totalMarginUsed: number
  onToggleMode: (isPaper: boolean) => void
  onTopUpPaper: (amount: number) => void
  onResetPaper: () => void
  onRefreshReal: () => void
}

export function FuturesWalletCard({
  config,
  paperBalance,
  realAccount,
  loadingReal,
  totalUnrealizedPnl,
  totalMarginUsed,
  onToggleMode,
  onTopUpPaper,
  onResetPaper,
  onRefreshReal,
}: Props) {
  const isPaper = config.isPaperTrading ?? true

  return (
    <Card className="border-border/40 bg-card overflow-hidden">
      {/* Header with Mode Toggle */}
      <CardHeader className="flex flex-row items-center justify-between py-2.5 px-3 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-violet-400" />
          <CardTitle className="text-xs font-bold text-foreground">
            {isPaper ? "กระเป๋าจำลอง (Paper Trading Wallet)" : "กระเป๋าเงินจริง (Bitget Live Futures Wallet)"}
          </CardTitle>
        </div>

        {/* Quick Mode Switcher */}
        <div className="flex items-center gap-1 bg-background/60 p-0.5 rounded-lg border border-border/40">
          <button
            onClick={() => onToggleMode(true)}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
              isPaper
                ? "bg-violet-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="size-3" />
            โหมดจำลอง (Paper)
          </button>

          <button
            onClick={() => onToggleMode(false)}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
              !isPaper
                ? "bg-amber-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Flame className="size-3" />
            โหมดเงินจริง (Live)
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-3 flex flex-col gap-3">
        {/* MODE BANNER */}
        {isPaper ? (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs">
            <ShieldCheck className="size-4 text-violet-400 mt-0.5 shrink-0" />
            <div className="flex-1 leading-snug">
              <span className="font-bold">โหมดกระดานเปเป้อ (Paper Trading Simulation): </span>
              ใช้เงินจำลองสำหรับฝึกซ้อมอัลกอริทึม Long/Short 5x ปลอดภัย 100% ไม่เสียเงินจริง
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs">
            <Flame className="size-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 leading-snug">
              <span className="font-bold">โหมดเทรดเงินจริง (Bitget USDT-M Futures): </span>
              ส่งคำสั่งเปิด/ปิดสัญญาเข้ากระดาน Bitget จริงตามยอดเงินในบัญชีของคุณ
            </div>
          </div>
        )}

        {/* BALANCE GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* 1. Main Usable USDT */}
          <div className="flex flex-col p-2.5 rounded-lg bg-muted/30 border border-border/40">
            <span className="text-[10px] text-muted-foreground font-medium">
              {isPaper ? "ยอดเงินจำลองคงเหลือ" : "USDT พร้อมเทรดจริง"}
            </span>
            <div className="text-base sm:text-lg font-black font-mono text-foreground mt-0.5">
              ${isPaper ? paperBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : (realAccount?.availableUsdt ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">USDT</span>
            </div>
            <span className="text-[9px] text-muted-foreground mt-1">
              {isPaper ? "โควต้าสำหรับเปิด Position จำลอง" : "Available in USDT-M Futures"}
            </span>
          </div>

          {/* 2. Total Equity */}
          <div className="flex flex-col p-2.5 rounded-lg bg-muted/30 border border-border/40">
            <span className="text-[10px] text-muted-foreground font-medium">
              {isPaper ? "มูลค่าพอร์ตรวมจำลอง" : "มูลค่าพอร์ตรวมจริง (Equity)"}
            </span>
            <div className="text-base sm:text-lg font-black font-mono text-foreground mt-0.5">
              ${isPaper ? (paperBalance + totalMarginUsed + totalUnrealizedPnl).toLocaleString(undefined, { minimumFractionDigits: 2 }) : (realAccount?.equityUsdt ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">USDT</span>
            </div>
            <span className="text-[9px] text-muted-foreground mt-1">ยอดเงินคงเหลือ + มาร์จิ้น + PnL</span>
          </div>

          {/* 3. Margin Locked */}
          <div className="flex flex-col p-2.5 rounded-lg bg-muted/30 border border-border/40">
            <span className="text-[10px] text-muted-foreground font-medium">ทุนค้ำประกันที่ใช้ (Margin)</span>
            <div className="text-base sm:text-lg font-black font-mono text-foreground mt-0.5">
              ${isPaper ? totalMarginUsed.toLocaleString(undefined, { minimumFractionDigits: 2 }) : (realAccount?.lockedUsdt ?? totalMarginUsed).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">USDT</span>
            </div>
            <span className="text-[9px] text-muted-foreground mt-1">5x Cross Margin Leverage</span>
          </div>

          {/* 4. Unrealized PnL */}
          <div className="flex flex-col p-2.5 rounded-lg bg-muted/30 border border-border/40">
            <span className="text-[10px] text-muted-foreground font-medium">กำไร/ขาดทุนสะสม (PnL)</span>
            <div className={`text-base sm:text-lg font-black font-mono mt-0.5 ${totalUnrealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {totalUnrealizedPnl >= 0 ? "+" : ""}${totalUnrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">USDT</span>
            </div>
            <span className="text-[9px] text-muted-foreground mt-1">Unrealized Positions</span>
          </div>
        </div>

        {/* FOOTER ACTIONS / STATUS */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-border/30 text-xs">
          {isPaper ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-medium">จัดการกระดานจำลอง:</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1 border-violet-500/30 text-violet-400 hover:border-violet-500/60"
                onClick={() => onTopUpPaper(1000)}
              >
                <PlusCircle className="size-3" />
                +$1,000 USDT
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1 border-violet-500/30 text-violet-400 hover:border-violet-500/60"
                onClick={() => onTopUpPaper(5000)}
              >
                <PlusCircle className="size-3" />
                +$5,000 USDT
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1 border-border/50 text-muted-foreground hover:text-foreground"
                onClick={onResetPaper}
              >
                <RotateCcw className="size-3" />
                รีเซ็ต $10,000
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {realAccount?.connected ? (
                <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold">
                  <CheckCircle2 className="size-3.5" />
                  <span>{realAccount.message || "เชื่อมต่อกระเป๋า Bitget USDT-M Futures สำเร็จ (API Valid)"}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-rose-400 text-[11px]">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{realAccount?.message || "ไม่สามารถเชื่อมต่อกระเป๋าจริงได้ — โปรดตรวจสอบ API Key ใน Settings"}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {!isPaper && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1 border-border/50"
                onClick={onRefreshReal}
                disabled={loadingReal}
              >
                <RefreshCw className={`size-3 ${loadingReal ? "animate-spin text-amber-400" : ""}`} />
                {loadingReal ? "กำลังซิงค์กระเป๋า..." : "รีเฟรชกระเป๋าจริง"}
              </Button>
            )}
            <span className="text-[10px] text-muted-foreground font-mono">
              Margin Coin: <strong className="text-foreground">USDT</strong> (Hedge)
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
