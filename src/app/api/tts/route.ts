import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LANG_MAP: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi',
  mr: 'mr',
  bn: 'bn',
  ta: 'ta',
  te: 'te',
  gu: 'gu',
  kn: 'kn',
  ml: 'ml',
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text');
    const lang = searchParams.get('lang') || 'en';

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Text parameter is required' }, { status: 400 });
    }

    const ttsLang = LANG_MAP[lang] || lang || 'en-IN';
    // Google TTS endpoint supports up to ~200 chars per query safely
    const cleanText = text.trim().slice(0, 250);
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(ttsLang)}&q=${encodeURIComponent(cleanText)}`;

    const response = await fetch(googleTtsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch speech audio from TTS upstream' }, { status: response.status });
    }

    const audioArrayBuffer = await response.arrayBuffer();

    return new Response(audioArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error: any) {
    console.error('TTS API error:', error);
    return NextResponse.json({ error: error.message || 'Internal TTS error' }, { status: 500 });
  }
}
