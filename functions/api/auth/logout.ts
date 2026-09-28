// Cloudflare Pages Function: Auth — Logout
// ลบ session จาก AUTOTD_KV และ clear cookie แล้ว redirect ไป sign-in

const SESSION_KV_PREFIX = "autotdfex_session:";

interface Env {
  AUTOTD_KV?: KVNamespace;
}

function parseCookieSessionId(cookieHeader: string): string | null {
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const found = cookies.find((c) => c.startsWith("autotdfex_session="));
  if (!found) return null;
  return found.split("=")[1]?.trim() || null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const cookieHeader = request.headers.get("Cookie") || "";
  const sessionId = parseCookieSessionId(cookieHeader);

  // ลบ session จาก KV
  if (sessionId && env.AUTOTD_KV) {
    try {
      await env.AUTOTD_KV.delete(`${SESSION_KV_PREFIX}${sessionId}`);
    } catch (err) {
      console.error("Session delete error:", err);
    }
  }

  // Clear cookie + redirect ไป sign-in
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${baseUrl}/sign-in`,
      "Set-Cookie": "autotdfex_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
    },
  });
};
