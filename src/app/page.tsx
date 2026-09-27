"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { Loader2Icon, TrendingUpIcon } from "lucide-react"

export default function RootPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      if (user && user.authenticated) {
        router.replace("/futures")
      } else {
        router.replace("/sign-in")
      }
    }
  }, [user, loading, router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xl shadow-violet-500/25 animate-pulse">
          <TrendingUpIcon className="size-7" />
        </div>
        <div className="flex flex-col items-center text-center">
          <h2 className="text-lg font-bold tracking-tight text-white">
            autoTDFex Quant AI
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Verifying operator session...
          </p>
        </div>
        <Loader2Icon className="size-5 animate-spin text-violet-400 mt-2" />
      </div>
    </div>
  )
}
