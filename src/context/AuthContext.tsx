"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  AuthUser,
  DEFAULT_OPERATOR_USER,
  OPERATOR_EMAIL,
  clearStoredUser,
  getStoredUser,
  saveStoredUser,
} from "@/lib/auth"

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  loginWithGoogle: (emailOverride?: string) => Promise<boolean>
  loginWithCredentials: (email: string, pass: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginWithGoogle: async () => false,
  loginWithCredentials: async () => false,
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const existing = getStoredUser()
    if (existing) {
      setUser(existing)
    }
    setLoading(false)
  }, [])

  const loginWithGoogle = async (emailOverride?: string): Promise<boolean> => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 600)) // smooth simulated oauth handshake

    const targetEmail = (emailOverride || OPERATOR_EMAIL).trim().toLowerCase()
    const authedUser: AuthUser = {
      ...DEFAULT_OPERATOR_USER,
      email: targetEmail,
      name: targetEmail === OPERATOR_EMAIL ? "Jim War" : targetEmail.split("@")[0],
      provider: "google",
      authenticated: true,
    }

    saveStoredUser(authedUser)
    setUser(authedUser)
    setLoading(false)
    return true
  }

  const loginWithCredentials = async (
    email: string,
    pass: string
  ): Promise<boolean> => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 600))

    const cleanEmail = email.trim().toLowerCase()
    const authedUser: AuthUser = {
      email: cleanEmail,
      name: cleanEmail === OPERATOR_EMAIL ? "Jim War" : cleanEmail.split("@")[0],
      avatar: "/avatars/user.jpg",
      provider: "credentials",
      role: cleanEmail === OPERATOR_EMAIL ? "Lead Quant Operator" : "Trader",
      authenticated: true,
    }

    saveStoredUser(authedUser)
    setUser(authedUser)
    setLoading(false)
    return true
  }

  const logout = () => {
    clearStoredUser()
    setUser(null)
    router.push("/sign-in")
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle,
        loginWithCredentials,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
