import { experimental_evaluate as evaluate, gateway } from 'ai';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json({ error: 'Add AI_GATEWAY_API_KEY to .env.local and restart the dev server.' }, { status: 500 });
  }
  try {
    const body = await request.json();
    const { state, questions } = body;
    if (typeof state !== 'string' || !state.trim() || !questions || typeof questions !== 'object') {
      return NextResponse.json({ error: 'Add some state and at least one question.' }, { status: 400 });
    }
    const result = await evaluate({
      model: gateway.evaluationModel('typesafe-ai/jev'),
      state: state.slice(0, 12000),
      questions,
    });
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The evaluation failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
