/**
 * POST /api/quran/transcribe — multipart form upload (field: "audio").
 * Returns { text } transcribed by OpenAI Whisper.
 *
 * Grok doesn't offer transcription, so this route always uses OpenAI
 * regardless of which chat provider the user has selected.
 */

import { authErrorResponse, authFromRequest } from "@/lib/supabase/auth";
import { transcriptionClient } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Bump the default body size limit for audio uploads (up to 25 MB — Whisper's limit)
export const maxDuration = 60;

export async function POST(req: Request) {
  const authed = await authFromRequest(req);
  if ("error" in authed) return authErrorResponse(authed);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const file = formData.get("audio");
  if (!file || typeof file === "string") {
    return Response.json({ error: "No audio file uploaded" }, { status: 400 });
  }

  try {
    const openai = transcriptionClient();
    const model = process.env.WHISPER_MODEL ?? "gpt-4o-mini-transcribe";
    const transcription = await openai.audio.transcriptions.create({
      file: file as File,
      model,
      response_format: "json",
    });
    return Response.json({ text: transcription.text ?? "" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "Transcription failed", detail: message }, { status: 500 });
  }
}
