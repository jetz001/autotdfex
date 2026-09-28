"use client"

import * as React from "react"
import { X, Eye, EyeOff, Save, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { FuturesConfig } from "@/services/bitgetFutures"

interface FuturesSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: FuturesConfig
  onSave: (config: FuturesConfig) => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, type = "text", placeholder = "" }: {
  value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
    />
  )
}

export function FuturesSettingsModal({ open, onOpenChange, config, onSave }: FuturesSettingsModalProps) {
  const [form, setForm] = React.useState(config)
  const [showSecret, setShowSecret] = React.useState(false)
  const [showPass, setShowPass] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => { setForm(config) }, [config])

  if (!open) return null

  const handleSave = () => {
    onSave(form)
    setSaved(true)
    setTimeout(() => { setSaved(false); onOpenChange(false) }, 1200)
  }

  const set = (key: keyof FuturesConfig) => (v: string) =>
    setForm(prev => ({ ...prev, [key]: v }))

  const setNum = (key: keyof FuturesConfig) => (v: string) =>
    setForm(prev => ({ ...prev, [key]: parseFloat(v) || 0 }))

  const setBool = (key: keyof FuturesConfig) => (v: boolean) =>
    setForm(prev => ({ ...prev, [key]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-card border border-violet-500/20 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-violet-400" />
            <span className="text-sm font-bold">autoTDFex Futures Settings</span>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Mode Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/40">
            <div>
              <div className="text-xs font-bold">{form.isPaperTrading ? '📝 Paper Trading Mode' : '🔥 Live Futures Mode'}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {form.isPaperTrading ? 'ทดสอบด้วยเงินจำลอง $10,000 USDT' : 'เชื่อมต่อ Bitget USDT-M Futures จริง'}
              </div>
            </div>
            <button
              onClick={() => setBool('isPaperTrading')(!form.isPaperTrading)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isPaperTrading ? 'bg-muted' : 'bg-violet-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isPaperTrading ? 'translate-x-1' : 'translate-x-6'}`} />
            </button>
          </div>

          {/* Auto-Pilot */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/40">
            <div>
              <div className="text-xs font-bold">{form.autoPilotEnabled ? '🤖 Auto-Pilot ON' : '⏸ Auto-Pilot OFF'}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">TP/SL อัตโนมัติทุก 15 วินาที</div>
            </div>
            <button
              onClick={() => setBool('autoPilotEnabled')(!form.autoPilotEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.autoPilotEnabled ? 'bg-violet-600' : 'bg-muted'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.autoPilotEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Bitget API Keys */}
          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bitget API Keys</div>
            <Field label="API Key">
              <Input value={form.apiKey} onChange={set('apiKey')} placeholder="Bitget API Key" />
            </Field>
            <Field label="Secret Key">
              <div className="relative">
                <Input value={form.secretKey} onChange={set('secretKey')} type={showSecret ? 'text' : 'password'} placeholder="Secret Key" />
                <button onClick={() => setShowSecret(!showSecret)} className="absolute right-2 top-1.5 text-muted-foreground">
                  {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <Field label="Passphrase">
              <div className="relative">
                <Input value={form.passphrase} onChange={set('passphrase')} type={showPass ? 'text' : 'password'} placeholder="Passphrase" />
                <button onClick={() => setShowPass(!showPass)} className="absolute right-2 top-1.5 text-muted-foreground">
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
          </div>

          {/* AI Agent Keys */}
          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>AI Agent Brain (High-Speed LPU Inference)</span>
              <span className="text-[9px] text-emerald-400 font-semibold">⚡ Tier 1: Groq (แนะนำ)</span>
            </div>
            <Field label="Groq API Key (แนะนำหลัก — คำนวณเร็วระดับเสี้ยววินาที ฟรี)">
              <Input value={form.groqApiKey || ''} onChange={set('groqApiKey')} placeholder="gsk_..." />
            </Field>
            <Field label="OpenRouter API Key (Tier 2 สำรอง)">
              <Input value={form.openrouterApiKey || ''} onChange={set('openrouterApiKey')} placeholder="sk-or-..." />
            </Field>
          </div>

          {/* Futures Parameters */}
          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Futures Parameters</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label={`Leverage (${form.leverage}x)`}>
                <input type="range" min={1} max={20} step={1} value={form.leverage}
                  onChange={e => setNum('leverage')(e.target.value)}
                  className="w-full accent-violet-500" />
              </Field>
              <Field label="Mode">
                <div className="h-8 flex items-center px-3 rounded-md border border-input bg-muted/30 text-xs text-muted-foreground">
                  Hedge + Cross USDT-M
                </div>
              </Field>
            </div>
          </div>

          {/* Risk Parameters */}
          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Risk Management</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label={`Take Profit (${form.takeProfitPercent}%)`}>
                <input type="range" min={0.5} max={20} step={0.5} value={form.takeProfitPercent}
                  onChange={e => setNum('takeProfitPercent')(e.target.value)}
                  className="w-full accent-emerald-500" />
              </Field>
              <Field label={`Cut Loss (${form.cutLossPercent}%)`}>
                <input type="range" min={0.5} max={20} step={0.5} value={form.cutLossPercent}
                  onChange={e => setNum('cutLossPercent')(e.target.value)}
                  className="w-full accent-rose-500" />
              </Field>
              <Field label={`Max Coins (${form.maxCoins})`}>
                <input type="range" min={1} max={10} step={1} value={form.maxCoins}
                  onChange={e => setNum('maxCoins')(e.target.value)}
                  className="w-full accent-violet-500" />
              </Field>
              <Field label={`Max Tranches (${form.maxTranches})`}>
                <input type="range" min={1} max={8} step={1} value={form.maxTranches}
                  onChange={e => setNum('maxTranches')(e.target.value)}
                  className="w-full accent-violet-500" />
              </Field>
              <Field label={`Budget per Tranche (${form.tranchePercent}%)`}>
                <input type="range" min={5} max={50} step={5} value={form.tranchePercent}
                  onChange={e => setNum('tranchePercent')(e.target.value)}
                  className="w-full accent-amber-500" />
              </Field>
              <Field label={`Cash Reserve (${form.cashReservePercent}%)`}>
                <input type="range" min={10} max={60} step={5} value={form.cashReservePercent}
                  onChange={e => setNum('cashReservePercent')(e.target.value)}
                  className="w-full accent-sky-500" />
              </Field>
            </div>
          </div>

          {/* Save Button */}
          <Button
            className="w-full h-9 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold"
            onClick={handleSave}
          >
            <Save className="size-4 mr-2" />
            {saved ? '✓ บันทึกสำเร็จ!' : 'บันทึกการตั้งค่า'}
          </Button>
        </div>
      </div>
    </div>
  )
}
