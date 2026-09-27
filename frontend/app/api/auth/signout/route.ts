import { NextResponse } from 'next/server';
import { supabaseAuth } from '../../../../../backend/auth';

export async function POST() {
  await (await supabaseAuth()).auth.signOut();
  return NextResponse.json({ ok: true });
}
