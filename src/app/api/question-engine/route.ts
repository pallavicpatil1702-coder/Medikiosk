import { NextResponse } from 'next/server';
import { processQuestionEngine } from '@/lib/server/questionEngine';
import { PatientSession } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const session: PatientSession = body.session;

    if (!session || !session.chiefComplaint) {
      return NextResponse.json({ error: 'Session with chief complaint is required' }, { status: 400 });
    }

    const result = await processQuestionEngine(session);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Question engine error:', error);
    return NextResponse.json(
      { error: 'Failed to process question engine' },
      { status: 500 }
    );
  }
}
