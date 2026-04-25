import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type TTSRequest = {
  text: string;
  voiceId?: string;
  modelId?: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenKey) return jsonError("Missing ELEVENLABS_API_KEY", 500);

  let body: TTSRequest;
  try {
    body = (await req.json()) as TTSRequest;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const text = (body.text ?? "").trim();
  if (!text) return jsonError("Missing text");

  const voiceId = (body.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? "").trim();
  if (!voiceId) {
    return jsonError(
      "Missing voiceId (send in request or set ELEVENLABS_VOICE_ID)",
      400
    );
  }

  const modelId = (body.modelId ?? process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2").trim();

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "xi-api-key": elevenKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
        },
      }),
    }
  );

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    return jsonError(
      `ElevenLabs error (${upstream.status}): ${errText || upstream.statusText}`,
      502
    );
  }

  const audio = await upstream.arrayBuffer();
  return new NextResponse(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      // Cache on the client; server response varies by text anyway.
      "Cache-Control": "no-store",
    },
  });
}

