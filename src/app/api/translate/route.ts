import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const { text } = await request.json();
  if (!text?.trim()) {
    return Response.json({ error: "No text to translate" }, { status: 400 });
  }

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ja|en`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const translated = data?.responseData?.translatedText;

    if (!translated) {
      return Response.json({ error: "Translation failed" }, { status: 502 });
    }

    return Response.json({ translated });
  } catch {
    return Response.json({ error: "Translation service unavailable" }, { status: 502 });
  }
}
