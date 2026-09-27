"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/context/AuthContext"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LogOutIcon, ShieldCheckIcon, Loader2Icon } from "lucide-react"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || !user.authenticated)) {
      router.replace("/sign-in")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
        <Loader2Icon className="size-6 animate-spin text-violet-500 mb-2" />
        <span className="text-xs text-muted-foreground font-mono">
          Authenticating terminal session...
        </span>
      </div>
    )
  }

  if (!user || !user.authenticated) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top utility bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-3 sm:px-4 bg-card/60 backdrop-blur-md border-violet-500/20">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-violet-500/20 text-violet-400 font-black text-[11px] border border-violet-500/30">
            F
          </div>
          <span className="text-xs font-bold tracking-tight text-foreground">
            autoTDFex Quant AI Desk
          </span>
          <span className="text-[10px] text-muted-foreground hidden md:inline">
            | USDT-M Perpetual Futures Terminal
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* User Profile Badge (AutoTD style) */}
          <div className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-full bg-muted/50 border border-border/80 text-xs">
            <Avatar className="size-6 border border-violet-500/40">
              <AvatarImage src={user.avatar || "/avatars/user.jpg"} alt={user.name} />
              <AvatarFallback className="text-[10px] bg-violet-600 text-white font-bold">
                JW
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex flex-col text-left">
              <div className="flex items-center gap-1 leading-tight">
                {user.provider === "google" && (
                  <Image
                    src="/logos/google-com.png"
                    alt="Google"
                    width={12}
                    height={12}
                    className="size-3"
                  />
                )}
                <span className="font-semibold text-[11px] text-foreground">
                  {user.name}
                </span>
                <ShieldCheckIcon className="size-3 text-emerald-500" />
              </div>
              <span className="text-[9px] text-muted-foreground font-mono">
                {user.email}
              </span>
            </div>

            {/* Logout button */}
            <Button
              variant="ghost"
              size="icon"
              className="size-6 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={logout}
              title="Sign out of autoTDFex"
            >
              <LogOutIcon className="size-3" />
            </Button>
          </div>

          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 w-full p-2 sm:p-4 pb-20 sm:pb-28 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
