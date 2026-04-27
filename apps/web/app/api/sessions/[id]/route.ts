import { authErrorResponse, authFromRequest, clientForRequest } from "@/lib/supabase/auth";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const authed = await authFromRequest(req);
  if ("error" in authed) return authErrorResponse(authed);

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    summary?: string;
    score?: number;
  };

  const updates: Record<string, unknown> = {};
  if (typeof body.summary === "string") updates.summary = body.summary;
  if (typeof body.score === "number") updates.score = body.score;
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const sb = clientForRequest(authed.token);
  const { data, error } = await sb
    .from("sessions")
    .update(updates)
    .eq("id", id)
    // RLS already restricts to this user, but adding the explicit filter makes
    // the intent clear and avoids a round-trip if the id doesn't belong to us.
    .eq("user_id", authed.userId)
    .select("*")
    .single();

  if (error || !data) {
    return Response.json(
      { error: error?.message ?? "Session not found" },
      { status: 404 },
    );
  }
  return Response.json({ session: data });
}
