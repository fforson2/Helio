import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function transcribeWithGroq(audioBlob: Blob): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");

  const form = new FormData();
  form.append("file", audioBlob, "recording.webm");
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Groq STT error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { text: string };
  return data.text;
}

async function transcribeWithOpenAI(audioBlob: Blob): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const form = new FormData();
  form.append("file", audioBlob, "recording.webm");
  form.append("model", "whisper-1");
  form.append("response_format", "json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI STT error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { text: string };
  return data.text;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof Blob)) {
      return jsonError("Missing audio file in form data");
    }

    let transcript: string;
    try {
      transcript = await transcribeWithGroq(audioFile);
    } catch {
      transcript = await transcribeWithOpenAI(audioFile);
    }

    return NextResponse.json({ text: transcript.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    return jsonError(message, 500);
  }
}
