import { NextResponse } from 'next/server';
import { getOpsData } from '@/lib/data';

export async function GET(_request, { params }) {
  try {
    const { slug } = await params;
    const data = await getOpsData(slug);
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Not found';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
