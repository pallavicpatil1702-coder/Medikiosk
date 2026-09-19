import { NextRequest, NextResponse } from 'next/server';
import { bhashiniClient } from '@/lib/bhashini/bhashiniClient';

export async function POST(req: NextRequest) {
  try {
    const { audioBase64, sourceLanguage } = await req.json();

    if (!audioBase64) {
      return NextResponse.json({ error: 'Missing audio data' }, { status: 400 });
    }

    if (!sourceLanguage) {
      return NextResponse.json({ error: 'Missing source language' }, { status: 400 });
    }

    // Process via Bhashini
    const result = await bhashiniClient.processVoice(audioBase64, sourceLanguage);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] Bhashini Process Voice Error:', error);
    
    // Check if it's the specific "not configured" error to allow graceful fallback
    if (error.message === 'BHASHINI_NOT_CONFIGURED') {
      return NextResponse.json({ error: 'BHASHINI_NOT_CONFIGURED' }, { status: 503 });
    }

    return NextResponse.json(
      { error: 'Internal Server Error processing voice' },
      { status: 500 }
    );
  }
}
