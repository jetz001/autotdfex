// Cloudflare Pages Function: Auth — Get Current Session
// Frontend เรียก GET /api/auth/me เพื่อตรวจสอบว่า login อยู่หรือเปล่า
// อ่าน session จาก HttpOnly Cookie → lookup ใน AUTOTD_KV

const SESSION_KV_PREFIX = "autotdfex_session:";

interface Env {
  AUTOTD_KV?: KVNamespace;
}

const corsHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function parseCookieSessionId(cookieHeader: string): string | null {
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const found = cookies.find((c) => c.startsWith("autotdfex_session="));
  if (!found) return null;
  return found.split("=")[1]?.trim() || null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const cookieHeader = request.headers.get("Cookie") || "";
  const sessionId = parseCookieSessionId(cookieHeader);

  if (!sessionId) {
    return Response.json({ authenticated: false }, { headers: corsHeaders });
  }

  try {
    let session: any = null;

    if (env.AUTOTD_KV) {
      const raw = await env.AUTOTD_KV.get(`${SESSION_KV_PREFIX}${sessionId}`);
      if (raw) session = JSON.parse(raw);
    }

    if (!session) {
      return Response.json({ authenticated: false }, { headers: corsHeaders });
    }

    // ตรวจสอบ expiry (KV TTL จะลบให้อัตโนมัติ แต่ double-check ด้วย)
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return Response.json({ authenticated: false }, { headers: corsHeaders });
    }

    return Response.json(
      {
        authenticated: true,
        user: {
          email: session.email,
          name: session.name,
          avatar: session.avatar,
          googleId: session.googleId,
          provider: "google",
          role: session.role,
        },
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("Session lookup error:", err);
    return Response.json({ authenticated: false }, { headers: corsHeaders });
  }
};
