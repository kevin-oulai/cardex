import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const origin = "https://kevin-oulai.github.io";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (req.headers.get("origin") !== origin) return json({ error: "Origin not allowed" }, 403);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json({ error: "Server configuration incomplete" }, 503);
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in required" }, 401);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identity, error: authError } = await admin.auth.getUser(token);
  if (authError || !identity.user?.id || !identity.user.email) return json({ error: "Session invalid" }, 401);
  let payload: unknown;
  try { payload = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  if (!payload || typeof payload !== "object") return json({ error: "Invalid request" }, 400);
  const { confirmation, password } = payload as { confirmation?: unknown; password?: unknown };
  if (confirmation !== "DELETE MY ACCOUNT" || typeof password !== "string" || password.length < 8 || password.length > 256)
    return json({ error: "Enter your password and exact confirmation phrase" }, 400);
  // Reauthenticate with the user's password. A stolen existing session alone is insufficient.
  const verifier = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verified, error: verifyError } = await verifier.auth.signInWithPassword({
    email: identity.user.email, password,
  });
  if (verifyError || verified.user?.id !== identity.user.id)
    return json({ error: "Password verification failed" }, 403);
  const { error: deleteError } = await admin.auth.admin.deleteUser(identity.user.id);
  if (deleteError) return json({ error: "Account deletion failed. Please contact support." }, 500);
  return json({ deleted: true });
});
