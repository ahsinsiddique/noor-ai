/**
 * GET  /api/sessions → { sessions: [...] } — all sessions for the caller
 * POST /api/sessions → { session }         — create a new session
 *
 * Backed by Supabase `public.sessions` with RLS scoping to the caller.
 */

import { authErrorResponse, authFromRequest, clientForRequest } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const authed = await authFromRequest(req);
  if ("error" in authed) return authErrorResponse(authed);

  const sb = clientForRequest(authed.token);
  const { data, error } = await sb
    .from("sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ sessions: data ?? [] });
}

export async function POST(req: Request) {
  const authed = await authFromRequest(req);
  if ("error" in authed) return authErrorResponse(authed);

  const body = (await req.json().catch(() => ({}))) as {
    surahName?: string;
    ayahNumber?: number;
  };

  const sb = clientForRequest(authed.token);
  const { data, error } = await sb
    .from("sessions")
    .insert({
      user_id: authed.userId,
      surah_name: body.surahName ?? "",
      ayah_number: body.ayahNumber ?? 1,
      summary: "",
    })
    .select("*")
    .single();

  if (error || !data) {
    return Response.json(
      { error: error?.message ?? "Failed to create session" },
      { status: 500 },
    );
  }
  return Response.json({ session: data }, { status: 201 });
}
