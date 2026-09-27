"use client"

import * as React from "react"
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  LineStyle,
} from "lightweight-charts"
import type { IChartApi, ISeriesApi } from "lightweight-charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { fetchBitgetFuturesCandles, type FuturesPosition, type FuturesTickerItem } from "@/services/bitgetFutures"
import { BarChart3, Globe, RefreshCw, TrendingUp, TrendingDown, Layers } from "lucide-react"

interface Props {
  symbol: string
  currentPrice: number
  position?: FuturesPosition
  ticker?: FuturesTickerItem
}

const TIMEFRAMES = [
  { label: "1m", bitget: "1min", tv: "1" },
  { label: "5m", bitget: "5min", tv: "5" },
  { label: "15m", bitget: "15min", tv: "15" },
  { label: "1H", bitget: "1h", tv: "60" },
  { label: "4H", bitget: "4h", tv: "240" },
  { label: "1D", bitget: "1day", tv: "D" },
]

export function FuturesTradingChart({ symbol, currentPrice, position, ticker }: Props) {
  const cleanSymbol = symbol.replace("/", "").toUpperCase()
  const [activeTfIdx, setActiveTfIdx] = React.useState(2) // 15m default
  const [viewMode, setViewMode] = React.useState<"canvas" | "tradingview">("canvas")
  const [loading, setLoading] = React.useState(false)

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const chartRef = React.useRef<IChartApi | null>(null)
  const candleSeriesRef = React.useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeSeriesRef = React.useRef<ISeriesApi<"Histogram"> | null>(null)

  const selectedTf = TIMEFRAMES[activeTfIdx]

  // Fetch Bitget Futures Candles
  const loadCandles = React.useCallback(async () => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return
    try {
      setLoading(true)
      const candles = await fetchBitgetFuturesCandles(cleanSymbol, selectedTf.bitget, 120)
      if (candles.length === 0) return

      candleSeriesRef.current.setData(
        candles.map((c) => ({
          time: c.time as any,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      )

      volumeSeriesRef.current.setData(
        candles.map((c) => ({
          time: c.time as any,
          value: c.volume,
          color: c.close >= c.open ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
        }))
      )
    } catch (e) {
      console.warn("Candle fetch error:", e)
    } finally {
      setLoading(false)
    }
  }, [cleanSymbol, selectedTf])

  // Initialize Canvas Chart
  React.useEffect(() => {
    if (viewMode !== "canvas" || !containerRef.current) return

    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const container = containerRef.current
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#090d16" },
        textColor: "#64748b",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(30, 45, 74, 0.35)" },
        horzLines: { color: "rgba(30, 45, 74, 0.35)" },
      },
      crosshair: { mode: 1 },
      rightPriceScale: {
        borderColor: "#1e2d4a",
        scaleMargins: { top: 0.1, bottom: 0.22 },
      },
      timeScale: {
        borderColor: "#1e2d4a",
        timeVisible: true,
        secondsVisible: false,
      },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    })

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    loadCandles()

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [viewMode, cleanSymbol, selectedTf, loadCandles])

  // Draw Price Lines for Active Position (Avg Open, TP, SL, Liq)
  React.useEffect(() => {
    if (viewMode !== "canvas" || !candleSeriesRef.current || !position) return

    const lines: any[] = []

    // 1. Avg Open Price Line
    if (position.avgOpenPrice > 0) {
      lines.push(
        candleSeriesRef.current.createPriceLine({
          price: position.avgOpenPrice,
          color: position.positionSide === "long" ? "#38bdf8" : "#f59e0b",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `${position.positionSide.toUpperCase()} Open $${position.avgOpenPrice.toFixed(2)}`,
        })
      )
    }

    // 2. Take Profit Line
    if (position.takeProfitPrice > 0) {
      lines.push(
        candleSeriesRef.current.createPriceLine({
          price: position.takeProfitPrice,
          color: "#10b981",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `TP $${position.takeProfitPrice.toFixed(2)}`,
        })
      )
    }

    // 3. Cut Loss Line
    if (position.cutLossPrice > 0) {
      lines.push(
        candleSeriesRef.current.createPriceLine({
          price: position.cutLossPrice,
          color: "#ef4444",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `SL $${position.cutLossPrice.toFixed(2)}`,
        })
      )
    }

    // 4. Liquidation Line
    if (position.liquidationPrice > 0) {
      lines.push(
        candleSeriesRef.current.createPriceLine({
          price: position.liquidationPrice,
          color: "#a855f7",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `Liq $${position.liquidationPrice.toFixed(2)}`,
        })
      )
    }

    return () => {
      lines.forEach((line) => {
        try {
          candleSeriesRef.current?.removePriceLine(line)
        } catch {}
      })
    }
  }, [position, viewMode])

  const change24h = ticker?.change24h ?? 0
  const isPos = change24h >= 0

  return (
    <Card className="border-border/40 bg-card overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between py-2.5 px-3 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-foreground">{cleanSymbol}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">
              Perpetual Futures
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono font-bold text-foreground">
              ${(currentPrice || ticker?.lastPr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className={`text-[10px] font-bold ${isPos ? "text-emerald-400" : "text-rose-400"}`}>
              {isPos ? "+" : ""}{change24h.toFixed(2)}%
            </span>
          </div>

          {ticker?.fundingRate !== undefined && (
            <div className="text-[10px] text-muted-foreground hidden sm:inline">
              Funding: <span className="font-mono font-bold text-amber-400">{(ticker.fundingRate * 100).toFixed(4)}%</span>
            </div>
          )}
        </div>

        {/* View Mode & Timeframe Controls */}
        <div className="flex items-center gap-1">
          <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/40">
            {TIMEFRAMES.map((tf, idx) => (
              <button
                key={tf.label}
                onClick={() => setActiveTfIdx(idx)}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                  activeTfIdx === idx
                    ? "bg-violet-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={loadCandles}
            disabled={loading}
          >
            <RefreshCw className={`size-3 ${loading ? "animate-spin text-violet-400" : ""}`} />
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-6 px-1.5 text-[10px] gap-1 border-violet-500/30 text-violet-400 hover:border-violet-500/60"
            onClick={() => setViewMode(viewMode === "canvas" ? "tradingview" : "canvas")}
          >
            {viewMode === "canvas" ? <Globe className="size-3" /> : <BarChart3 className="size-3" />}
            {viewMode === "canvas" ? "TradingView" : "Canvas"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0 h-[380px] w-full relative">
        {viewMode === "canvas" ? (
          <div ref={containerRef} className="w-full h-full" />
        ) : (
          <iframe
            src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=BITGET%3A${cleanSymbol}.P&interval=${selectedTf.tv}&theme=dark&style=1&timezone=Asia%2FBangkok&studies=[]&locale=en`}
            className="w-full h-full border-0"
            title={`TradingView ${cleanSymbol}`}
          />
        )}

        {position && (
          <div className="absolute top-2 left-2 z-10 bg-black/75 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-border/50 text-[10px] flex items-center gap-3">
            <div className="flex items-center gap-1 font-bold">
              {position.positionSide === "long" ? (
                <TrendingUp className="size-3 text-emerald-400" />
              ) : (
                <TrendingDown className="size-3 text-rose-400" />
              )}
              <span className={position.positionSide === "long" ? "text-emerald-400" : "text-rose-400"}>
                {position.positionSide.toUpperCase()} ({position.contracts}c)
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Avg: </span>
              <span className="font-mono font-bold">${position.avgOpenPrice.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">PnL: </span>
              <span className={`font-mono font-bold ${position.pnlPercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {position.pnlPercent >= 0 ? "+" : ""}{position.pnlPercent.toFixed(2)}% (${position.unrealizedPnlUsdt.toFixed(2)})
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
