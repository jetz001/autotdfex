// Cloudflare Pages Function: Google OAuth — Callback Handler
// รับ Authorization Code จาก Google, แลก access_token, ดึง profile,
// ตรวจ allowlist, สร้าง session ใน AUTOTD_KV, set HttpOnly Cookie

const ALLOWED_EMAILS = ["jimwar02@gmail.com"];
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 วัน
const SESSION_KV_PREFIX = "autotdfex_session:";

interface Env {
  AUTOTD_KV?: KVNamespace;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

interface SessionData {
  email: string;
  name: string;
  avatar: string;
  googleId: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

function getRoleForEmail(email: string): string {
  return email === "jimwar02@gmail.com" ? "Lead Quant Operator" : "Quant Trader";
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");

  // Google ส่ง error กลับมา (user ยกเลิก ฯลฯ)
  if (errorParam) {
    return Response.redirect(`${baseUrl}/sign-in?error=google_cancelled`, 302);
  }

  if (!code) {
    return Response.redirect(`${baseUrl}/sign-in?error=no_code`, 302);
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return Response.redirect(`${baseUrl}/sign-in?error=server_config`, 302);
  }

  try {
    // 1. แลก Authorization Code เป็น Access Token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${baseUrl}/api/auth/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Token exchange failed:", errText);
      return Response.redirect(`${baseUrl}/sign-in?error=token_failed`, 302);
    }

    const tokens = (await tokenRes.json()) as { access_token: string };

    // 2. ดึง Google Profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileRes.ok) {
      return Response.redirect(`${baseUrl}/sign-in?error=profile_failed`, 302);
    }

    const profile = (await profileRes.json()) as {
      sub: string;
      email: string;
      name: string;
      picture: string;
      email_verified: boolean;
    };

    if (!profile.email_verified) {
      return Response.redirect(`${baseUrl}/sign-in?error=email_not_verified`, 302);
    }

    const email = profile.email.trim().toLowerCase();

    // 3. ตรวจสอบ Allowlist
    if (!ALLOWED_EMAILS.includes(email)) {
      const encodedEmail = encodeURIComponent(email);
      return Response.redirect(
        `${baseUrl}/sign-in?error=not_authorized&email=${encodedEmail}`,
        302
      );
    }

    // 4. สร้าง Session ID และเก็บใน AUTOTD_KV
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();

    const sessionData: SessionData = {
      email,
      name: profile.name,
      avatar: profile.picture,
      googleId: profile.sub,
      role: getRoleForEmail(email),
      createdAt: now.toISOString(),
      expiresAt,
    };

    if (env.AUTOTD_KV) {
      await env.AUTOTD_KV.put(
        `${SESSION_KV_PREFIX}${sessionId}`,
        JSON.stringify(sessionData),
        { expirationTtl: SESSION_TTL_SECONDS }
      );
    }

    // 5. Set HttpOnly Cookie (same domain — Pages Function = same origin)
    const isSecure = url.protocol === "https:";
    const cookieHeader = [
      `autotdfex_session=${sessionId}`,
      `Path=/`,
      `Max-Age=${SESSION_TTL_SECONDS}`,
      `SameSite=Lax`,
      `HttpOnly`,
      ...(isSecure ? ["Secure"] : []),
    ].join("; ");

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${baseUrl}/futures`,
        "Set-Cookie": cookieHeader,
      },
    });
  } catch (err: any) {
    console.error("Auth callback error:", err);
    return Response.redirect(`${baseUrl}/sign-in?error=server_error`, 302);
  }
};
