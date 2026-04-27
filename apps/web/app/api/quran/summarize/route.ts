import { authErrorResponse, authFromRequest } from "@/lib/supabase/auth";
import {
  type ChatMessage,
  completion,
  normaliseModel,
  normaliseProvider,
} from "@/lib/ai/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authed = await authFromRequest(req);
  if ("error" in authed) return authErrorResponse(authed);

  const body = (await req.json().catch(() => ({}))) as {
    messages?: ChatMessage[];
    provider?: string;
    model?: string;
  };

  if (!Array.isArray(body.messages)) {
    return Response.json({ error: "messages array required" }, { status: 400 });
  }

  const provider = normaliseProvider(body.provider);
  const model = normaliseModel(provider, body.model);

  try {
    const conversation = body.messages
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role === "user" ? "Student" : "Teacher"}: ${m.content}`)
      .join("\n");

    const summary = await completion({
      provider,
      model,
      maxTokens: 256,
      messages: [
        {
          role: "user",
          content: `Summarize this Quran learning session in 1–2 sentences. Focus on topics discussed and insights gained:\n\n${conversation}`,
        },
      ],
    });

    return Response.json({ summary: summary || "Session completed." });
  } catch {
    return Response.json({ summary: "Session completed." });
  }
}
