import { NextResponse } from 'next/server';
import { supabaseAuth } from '../../../../../backend/auth';

export async function POST() {
  await supabaseAuth().auth.signOut();
  return NextResponse.json({ ok: true });
}
