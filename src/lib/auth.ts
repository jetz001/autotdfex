export interface AuthUser {
  email: string
  name: string
  avatar: string
  provider: "google" | "credentials"
  role: string
  authenticated: boolean
  lastLogin?: string
}

export const OPERATOR_EMAIL = "jimwar02@gmail.com"

export const DEFAULT_OPERATOR_USER: AuthUser = {
  email: OPERATOR_EMAIL,
  name: "Jim War",
  avatar: "/avatars/user.jpg",
  provider: "google",
  role: "Lead Quant Operator",
  authenticated: true,
}

const STORAGE_KEY = "autotdfex_auth_session"

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthUser
    if (parsed && parsed.authenticated && parsed.email) {
      return parsed
    }
  } catch (e) {
    console.error("Failed to parse auth session", e)
  }
  return null
}

export function saveStoredUser(user: AuthUser): void {
  if (typeof window === "undefined") return
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...user,
      lastLogin: new Date().toISOString(),
    })
  )
}

export function clearStoredUser(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}
