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
    const whisperBase = process.env.WHISPER_BASE_URL;
    let text = "";

    if (whisperBase) {
      // Local whisper instance (custom FastAPI or similar) that expects `/transcribe` and `file` field
      const whisperUrl = `${whisperBase.replace(/\/+$/, "")}/transcribe`;
      const uploadForm = new FormData();
      uploadForm.append("file", file as Blob, "audio.webm");

      const response = await fetch(whisperUrl, {
        method: "POST",
        body: uploadForm,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Whisper server error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      text = data.text || data.transcription || (typeof data === "string" ? data : JSON.stringify(data));
    } else {
      // Fallback to standard OpenAI transcription client if no custom whisper server is provided
      const openai = transcriptionClient();
      const model = process.env.WHISPER_MODEL ?? "whisper-1";
      const transcription = await openai.audio.transcriptions.create({
        file: file as File,
        model,
        response_format: "json",
      });
      text = transcription.text ?? "";
    }

    return Response.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "Transcription failed", detail: message }, { status: 500 });
  }
}
