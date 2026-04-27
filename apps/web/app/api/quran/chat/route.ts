/**
 * POST /api/quran/chat — SSE streaming chat with provider routing.
 *
 * Two modes:
 *   - default (lesson): requires surahName/ayahText — builds an ayah-aware
 *     teacher prompt.
 *   - `mode: "guardian"`: Noor AI Scholar mode — general Islamic guidance.
 *
 * Body also carries identity overrides:
 *   provider: "openai" | "xai" (defaults to openai)
 *   model:    model id for that provider
 *   sect:     "sunni" | "shia" | "ibadi" | "general" | null
 *   madhhab, subSchool, userLevel, teacherPrompt
 *   history:  prior [{ role, content }] turns
 */

import { authErrorResponse, authFromRequest } from "@/lib/supabase/auth";
import {
  type ChatMessage,
  normaliseModel,
  normaliseProvider,
  streamCompletion,
} from "@/lib/ai/providers";
import {
  type LearningLevel,
  buildAyahContext,
  buildGuardianSystemPrompt,
  buildLessonSystemPrompt,
  normaliseSect,
} from "@/lib/ai/prompts";

export const runtime = "nodejs";
// Streaming responses shouldn't be cached
export const dynamic = "force-dynamic";

interface ChatRequestBody {
  message?: string;
  mode?: "guardian";
  surahName?: string;
  surahArabic?: string;
  ayahNumber?: number;
  ayahText?: string;
  ayahTranslation?: string;
  userLevel?: LearningLevel;
  teacherPrompt?: string;
  madhhab?: string | null;
  sect?: string | null;
  subSchool?: string | null;
  provider?: string;
  model?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  messages?: ChatMessage[];
}

export async function POST(req: Request) {
  // Chat requires auth — we don't want anonymous users burning through
  // OpenAI credits.
  const authed = await authFromRequest(req);
  if ("error" in authed) return authErrorResponse(authed);

  const body = (await req.json().catch(() => ({}))) as ChatRequestBody;
  const provider = normaliseProvider(body.provider);
  const model = normaliseModel(provider, body.model);
  const sect = normaliseSect(body.sect);

  // Build the message array for the LLM depending on mode.
  let messages: ChatMessage[];

  if (body.mode === "guardian" && body.message) {
    messages = [
      {
        role: "system",
        content: buildGuardianSystemPrompt({
          sect,
          madhhab: body.madhhab,
          subSchool: body.subSchool,
        }),
      },
      ...(body.history ?? []),
      { role: "user", content: body.message },
    ];
  } else if (body.messages && Array.isArray(body.messages)) {
    messages = body.messages;
  } else if (body.message && body.surahName) {
    const level: LearningLevel = body.userLevel ?? "Beginner";
    const system = `${buildLessonSystemPrompt({
      level,
      teacherPrompt: body.teacherPrompt,
      sect,
      madhhab: body.madhhab,
      subSchool: body.subSchool,
    })}\n\n${buildAyahContext({
      surahName: body.surahName,
      surahArabic: body.surahArabic,
      ayahNumber: body.ayahNumber ?? 1,
      ayahText: body.ayahText ?? "",
      ayahTranslation: body.ayahTranslation ?? "",
    })}`;
    messages = [
      { role: "system", content: system },
      ...(body.history ?? []),
      { role: "user", content: body.message },
    ];
  } else {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  // Stream via Web Streams API. The Expo client (expo/fetch) consumes
  // this as plain SSE text.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamCompletion({
          provider,
          model,
          messages,
          maxTokens: 1024,
        })) {
          if (chunk.done) break;
          if (chunk.content) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  choices: [{ delta: { content: chunk.content } }],
                })}\n\n`,
              ),
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const detail = err instanceof Error ? err.message : "AI error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: detail })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
