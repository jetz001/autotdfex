// Cloudflare Pages Function: Google OAuth — Start Flow
// เปิด Popup → redirect ไป Google Authorization URL
// Session จะเก็บใน AUTOTD_KV (shared กับ bitget-ai-trader Worker)

interface Env {
  AUTOTD_KV?: KVNamespace;
  GOOGLE_CLIENT_ID?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  if (!env.GOOGLE_CLIENT_ID) {
    return new Response("GOOGLE_CLIENT_ID not configured. Add it via Cloudflare Pages dashboard → Settings → Environment Variables.", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${baseUrl}/api/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
  });

  return Response.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    302
  );
};
