"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { AuthUser } from "@/lib/auth"

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  authError: string | null
  loginWithGoogle: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  authError: null,
  loginWithGoogle: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  // ─── โหลด session จาก Cloudflare Pages Function ───
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data: any) => {
        if (data.authenticated && data.user) {
          setUser({ ...data.user, authenticated: true })
        }
      })
      .catch((err) => console.error("Auth check failed:", err))
      .finally(() => setLoading(false))
  }, [])

  // ─── รับ error param จาก callback redirect ───
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const error = params.get("error")
    if (!error) return

    const errorMessages: Record<string, string> = {
      google_cancelled: "การ Login ถูกยกเลิก กรุณาลองใหม่",
      no_code: "Google OAuth ไม่ส่ง Authorization Code กลับมา",
      token_failed: "แลก Token กับ Google ไม่สำเร็จ",
      profile_failed: "ดึงข้อมูล Google Profile ไม่สำเร็จ",
      email_not_verified: "อีเมล Google ยังไม่ได้ยืนยัน",
      not_authorized: `Access Denied: ${params.get("email") || "อีเมลนี้"} ไม่ได้รับอนุญาต`,
      server_config: "Server ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID",
      server_error: "เกิด Server Error ระหว่าง Authentication",
    }

    setAuthError(errorMessages[error] ?? `Authentication Error: ${error}`)

    // ลบ error params ออกจาก URL
    const cleanUrl = window.location.pathname
    window.history.replaceState({}, "", cleanUrl)
  }, [])

  // ─── Redirect ไป /api/auth/google (Pages Function) ───
  const loginWithGoogle = () => {
    setAuthError(null)
    window.location.href = "/api/auth/google"
  }

  // ─── Logout ผ่าน /api/auth/logout (ลบ session + clear cookie) ───
  const logout = () => {
    setUser(null)
    window.location.href = "/api/auth/logout"
  }

  return (
    <AuthContext.Provider value={{ user, loading, authError, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
