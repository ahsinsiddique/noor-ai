import { authErrorResponse, authFromRequest } from "@/lib/supabase/auth";
import {
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
    question?: string;
    correctAnswer?: string;
    surahName?: string;
    provider?: string;
    model?: string;
  };

  if (!body.question || !body.correctAnswer) {
    return Response.json(
      { error: "question and correctAnswer required" },
      { status: 400 },
    );
  }

  const provider = normaliseProvider(body.provider);
  const model = normaliseModel(provider, body.model);

  try {
    const text = await completion({
      provider,
      model,
      maxTokens: 128,
      messages: [
        {
          role: "user",
          content: `In the context of Surah ${body.surahName ?? ""}, briefly explain why "${body.correctAnswer}" is the correct answer to: "${body.question}". Keep it to 2 sentences.`,
        },
      ],
    });
    return Response.json({ explanation: text });
  } catch {
    return Response.json({ explanation: "" });
  }
}
