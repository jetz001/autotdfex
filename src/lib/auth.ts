// Types สำหรับ Auth System ของ autoTDFex
// Session จัดการบน Server (Cloudflare Pages Function + AUTOTD_KV)
// Frontend รับข้อมูลผ่าน GET /api/auth/me

export interface AuthUser {
  email: string;
  name: string;
  avatar: string;
  provider: "google";
  role: string;
  authenticated: boolean;
  googleId?: string;
}

// Authorized operators — mirror กับ ALLOWED_EMAILS ใน functions/api/auth/callback.ts
export const OPERATOR_EMAIL = "jimwar02@gmail.com";
export const ALLOWED_EMAILS: string[] = [OPERATOR_EMAIL];
