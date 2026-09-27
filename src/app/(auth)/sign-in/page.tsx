"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import {
  TrendingUpIcon,
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  CheckIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ZapIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group"
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
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
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
  const { user, loginWithGoogle, loginWithCredentials } = useAuth()

  const [email, setEmail] = useState(OPERATOR_EMAIL)
  const [password, setPassword] = useState("••••••••••••")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
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
      }, 700)
    } catch (err) {
      console.error(err)
      setIsGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setStatusMsg("Verifying credentials...")
    try {
      await loginWithCredentials(email, password)
      setIsLoading(false)
      setIsSuccess(true)
      setStatusMsg("Welcome back, Operator!")
      setTimeout(() => {
        router.push("/futures")
      }, 700)
    } catch (err) {
      console.error(err)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh">
      {/* Left panel - 3D Globe (Exact AutoTD style) */}
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

      {/* Right panel - Auth Form */}
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
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to your autoTDFex trading account
            </p>
          </motion.div>

          {/* Quick Authorized Operator Card for jimwar02@gmail.com */}
          <motion.div
            className="mt-6 p-3.5 rounded-xl border border-violet-500/30 bg-violet-500/10 text-left"
            variants={itemVariants}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-300">
                  Authorized Operator
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded">
                Level 1 Desk
              </span>
            </div>
            <div className="text-xs font-medium text-foreground mb-2.5 flex items-center gap-1.5">
              <span className="truncate">{OPERATOR_EMAIL}</span>
            </div>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md gap-2"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isLoading || isSuccess}
            >
              {isGoogleLoading ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" />
                  <span>Verifying Google Auth...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckIcon className="size-3.5 text-emerald-300" />
                  <span>Verified! Entering Terminal...</span>
                </>
              ) : (
                <>
                  <ZapIcon className="size-3.5 text-amber-300 fill-amber-300" />
                  <span>1-Click Sign in as {OPERATOR_EMAIL}</span>
                </>
              )}
            </Button>
          </motion.div>

          {/* Social login buttons */}
          <motion.div
            className="mt-4 grid grid-cols-2 gap-3"
            variants={itemVariants}
          >
            <Button
              variant="outline"
              size="lg"
              className="gap-2 border-border/80 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isLoading || isSuccess}
            >
              <Image
                src="/logos/google-com.png"
                alt="Google"
                width={16}
                height={16}
                className="size-4"
              />
              <span className="text-sm font-medium">Google</span>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="gap-2 border-border/80 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all opacity-80"
              onClick={() => {
                setEmail(OPERATOR_EMAIL)
              }}
            >
              <Image
                src="/logos/apple-com.png"
                alt="Apple"
                width={16}
                height={16}
                className="size-4 dark:invert"
              />
              <span className="text-sm font-medium">Apple</span>
            </Button>
          </motion.div>

          {/* Divider */}
          <motion.div
            className="relative my-6 flex items-center"
            variants={itemVariants}
          >
            <div className="flex-1 border-t border-border" />
            <span className="mx-3 text-xs text-muted-foreground">
              or continue with email
            </span>
            <div className="flex-1 border-t border-border" />
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <motion.div variants={itemVariants}>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium"
              >
                Email
              </label>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <MailIcon className="size-4 text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                />
              </InputGroup>
            </motion.div>

            <motion.div variants={itemVariants}>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <span className="text-xs text-muted-foreground">
                  Default passkey active
                </span>
              </div>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <LockIcon className="size-4 text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    variant="ghost"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-3.5 text-muted-foreground" />
                    ) : (
                      <EyeIcon className="size-3.5 text-muted-foreground" />
                    )}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </motion.div>

            <motion.div variants={itemVariants} className="pt-1">
              <Button
                type="submit"
                size="lg"
                className="w-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/20"
                disabled={isLoading || isGoogleLoading || isSuccess}
              >
                {isLoading ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckIcon className="size-4" />
                    <span>Success!</span>
                  </>
                ) : (
                  <span>Sign in</span>
                )}
              </Button>
            </motion.div>
          </form>

          {statusMsg && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-center text-xs font-medium text-emerald-400"
            >
              {statusMsg}
            </motion.p>
          )}

          {/* Secured badge */}
          <motion.div
            className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60"
            variants={itemVariants}
          >
            <ShieldCheckIcon className="size-3.5 text-emerald-500" />
            <span>256-bit SSL encrypted • Bitget USDT-M Perpetual Gate</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
