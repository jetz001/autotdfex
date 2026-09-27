"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import {
  TrendingUpIcon,
  Loader2Icon,
  CheckIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ZapIcon,
  ArrowRightIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"
import { useAuth } from "@/context/AuthContext"
import { OPERATOR_EMAIL } from "@/lib/auth"

const GlobeDemo = dynamic(() => import("@/components/globe-demo"), {
  ssr: false,
})

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
}

export default function SignInPage() {
  const router = useRouter()
  const { user, loginWithGoogle } = useAuth()

  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [statusMsg, setStatusMsg] = useState("")

  // Auto-redirect if already logged in
  useEffect(() => {
    if (user && user.authenticated) {
      router.replace("/futures")
    }
  }, [user, router])

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    setStatusMsg("Authenticating with Google OAuth...")
    try {
      await loginWithGoogle(OPERATOR_EMAIL)
      setIsSuccess(true)
      setStatusMsg("Google Auth Verified: " + OPERATOR_EMAIL)
      setTimeout(() => {
        router.push("/futures")
      }, 600)
    } catch (err) {
      console.error(err)
      setIsGoogleLoading(false)
      setStatusMsg("Failed to authenticate with Google")
    }
  }

  return (
    <div className="flex min-h-svh">
      {/* Left panel - 3D Globe (AutoTD style) */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-zinc-950 lg:flex overflow-hidden border-r border-violet-900/20">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 left-10 w-72 h-72 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <Link
          href="/futures"
          className="relative z-20 flex items-center gap-2.5 p-8"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
            <TrendingUpIcon className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              autoTDFex
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                Futures AI
              </span>
            </span>
            <span className="text-[11px] text-zinc-400">
              Perpetual Quant Desk & Terminal
            </span>
          </div>
        </Link>

        {/* Globe 3D Animation */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <GlobeDemo />
        </div>

        {/* Quote overlay — pinned to bottom */}
        <div className="relative z-20 mt-auto p-8">
          <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-2 mb-2 text-violet-400">
              <SparklesIcon className="size-4" />
              <span className="text-xs font-semibold tracking-wider uppercase">
                System One Quant Protocol
              </span>
            </div>
            <blockquote className="text-sm leading-relaxed text-white/90">
              &ldquo;The best time to start investing was yesterday. The second
              best time is now.&rdquo;
            </blockquote>
            <div className="mt-3 flex items-center justify-between text-xs text-white/50">
              <span>&mdash; Financial Wisdom</span>
              <span className="font-mono text-[11px] text-violet-400/80">
                Bitget USDT-M Perpetual
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - Google Auth Only */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-40 right-0 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          className="w-full max-w-sm"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Logo (mobile only) */}
          <motion.div
            className="mb-8 flex flex-col items-center lg:hidden"
            variants={itemVariants}
          >
            <div className="flex size-12 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-500/20">
              <TrendingUpIcon className="size-6" />
            </div>
            <span className="mt-2 text-base font-bold tracking-tight">
              autoTDFex Quant AI
            </span>
          </motion.div>

          {/* Heading */}
          <motion.div className="text-center" variants={itemVariants}>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome to autoTDFex
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in with your authorized Google account to enter the Bitget Futures desk
            </p>
          </motion.div>

          {/* Operator Profile Preview */}
          <motion.div
            className="mt-8 p-4 rounded-xl border border-violet-500/30 bg-violet-500/10 text-left relative overflow-hidden"
            variants={itemVariants}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-300">
                  Authorized Operator
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground bg-background/60 px-2 py-0.5 rounded border border-border/40">
                Single Sign-On
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative size-10 rounded-full overflow-hidden border border-violet-500/40 shrink-0">
                <Image
                  src="/avatars/user.jpg"
                  alt="Jim War"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground flex items-center gap-1">
                  <span>Jim War</span>
                  <ShieldCheckIcon className="size-3.5 text-emerald-400" />
                </div>
                <div className="text-xs text-muted-foreground truncate font-mono">
                  {OPERATOR_EMAIL}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Google Auth Action Button */}
          <motion.div className="mt-5" variants={itemVariants}>
            <Button
              type="button"
              size="lg"
              className="w-full h-12 bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-200 shadow-md font-semibold text-sm gap-3 transition-all active:scale-[0.99] cursor-pointer"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isSuccess}
            >
              {isGoogleLoading ? (
                <>
                  <Loader2Icon className="size-4 animate-spin text-zinc-900" />
                  <span>Connecting Google Auth...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckIcon className="size-4 text-emerald-600 font-bold" />
                  <span className="text-emerald-700">Verified! Entering Terminal...</span>
                </>
              ) : (
                <>
                  <Image
                    src="/logos/google-com.png"
                    alt="Google"
                    width={18}
                    height={18}
                    className="size-4.5"
                  />
                  <span>Sign in with Google</span>
                  <ArrowRightIcon className="size-4 ml-auto text-zinc-400" />
                </>
              )}
            </Button>
          </motion.div>

          {/* Status notification */}
          {statusMsg && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-center text-xs font-medium text-emerald-400"
            >
              {statusMsg}
            </motion.p>
          )}

          {/* Security & Access footnote */}
          <motion.div
            className="mt-10 pt-6 border-t border-border/40 text-center space-y-2"
            variants={itemVariants}
          >
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70">
              <ShieldCheckIcon className="size-3.5 text-emerald-500" />
              <span>Restricted Access: {OPERATOR_EMAIL}</span>
            </div>
            <p className="text-[11px] text-muted-foreground/50">
              Protected by 256-bit SSL • Cloudflare Edge Guard • Bitget USDT-M
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
