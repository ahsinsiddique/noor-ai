/**
 * Profile endpoint.
 *
 * GET   /api/profile  → { user: { id, email, name, level } }
 * PATCH /api/profile  → { user } — body { name?, level? }
 *
 * Signup and login no longer live on the backend — the mobile client talks
 * directly to Supabase Auth. We only expose profile read/update here because
 * profile fields (`name`, `level`) aren't part of the Supabase auth user;
 * they live in the `public.profiles` table.
 */

import { authErrorResponse, authFromRequest, clientForRequest } from "@/lib/supabase/auth";

export const runtime = "nodejs";

type ProfileRow = {
  id: string;
  email: string;
  name: string;
  level: "Beginner" | "Intermediate" | "Advanced";
};

export async function GET(req: Request) {
  const authed = await authFromRequest(req);
  if ("error" in authed) return authErrorResponse(authed);

  const sb = clientForRequest(authed.token);
  const { data, error } = await sb
    .from("profiles")
    .select("id, email, name, level")
    .eq("id", authed.userId)
    .single<ProfileRow>();

  if (error || !data) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }
  return Response.json({ user: data });
}

export async function PATCH(req: Request) {
  const authed = await authFromRequest(req);
  if ("error" in authed) return authErrorResponse(authed);

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    level?: string;
  };

  const updates: Record<string, string> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (body.level === "Beginner" || body.level === "Intermediate" || body.level === "Advanced") {
    updates.level = body.level;
  }
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const sb = clientForRequest(authed.token);
  const { data, error } = await sb
    .from("profiles")
    .update(updates)
    .eq("id", authed.userId)
    .select("id, email, name, level")
    .single<ProfileRow>();

  if (error || !data) {
    return Response.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }
  return Response.json({ user: data });
}
