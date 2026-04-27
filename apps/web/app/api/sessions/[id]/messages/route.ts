import { authErrorResponse, authFromRequest, clientForRequest } from "@/lib/supabase/auth";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  const authed = await authFromRequest(req);
  if ("error" in authed) return authErrorResponse(authed);

  const { id } = await params;
  const sb = clientForRequest(authed.token);

  // RLS on session_messages enforces ownership via the parent session — if the
  // user doesn't own the session they'll just get an empty array.
  const { data, error } = await sb
    .from("session_messages")
    .select("*")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ messages: data ?? [] });
}

export async function POST(req: Request, { params }: RouteParams) {
  const authed = await authFromRequest(req);
  if ("error" in authed) return authErrorResponse(authed);

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    role?: string;
    content?: string;
  };

  if (!body.role || !body.content) {
    return Response.json({ error: "role and content are required" }, { status: 400 });
  }
  if (body.role !== "user" && body.role !== "assistant" && body.role !== "system") {
    return Response.json({ error: "role must be user|assistant|system" }, { status: 400 });
  }

  const sb = clientForRequest(authed.token);
  const { data, error } = await sb
    .from("session_messages")
    .insert({ session_id: id, role: body.role, content: body.content })
    .select("*")
    .single();

  if (error || !data) {
    return Response.json(
      { error: error?.message ?? "Failed to save message" },
      { status: 500 },
    );
  }
  return Response.json({ message: data }, { status: 201 });
}
