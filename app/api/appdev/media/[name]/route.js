import { NextResponse } from 'next/server';
import { contentTypeForName, readLocalMedia } from '@/lib/appdev-upload-store';

export const runtime = 'nodejs';

export async function GET(_request, { params }) {
  const { name } = await params;
  const file = await readLocalMedia(name);
  if (!file) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return new NextResponse(file.data, {
    headers: {
      'Content-Type': contentTypeForName(file.name),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
