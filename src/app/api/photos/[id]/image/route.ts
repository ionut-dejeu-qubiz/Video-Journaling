import { NextRequest, NextResponse } from 'next/server';
import { getPhotoGcsPath, getFileForUser } from '@/lib/local-storage';
import { getSessionEmail } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const email = await getSessionEmail(request);
    const { id } = await params;
    const photoId = decodeURIComponent(id);
    const gcsPath = await getPhotoGcsPath(email, photoId);

    if (!gcsPath) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const { buffer, contentType } = await getFileForUser(email, gcsPath);

    const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('Photo image proxy error:', error);
    return NextResponse.json({ error: 'Failed to load photo' }, { status: 500 });
  }
}
