import { NextRequest, NextResponse } from 'next/server';
import { listPhotos, getSignedUrl } from '@/lib/local-storage';
import { getSessionEmail } from '@/lib/auth';
import type { ApiResponse, PhotoEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const email = await getSessionEmail(request);
    const photos = await listPhotos(email);

    const withUrls = await Promise.all(
      photos.map(async (p) => {
        if (p.imageUrl) {
          try {
            const { url } = await getSignedUrl(p.imageUrl, 120);
            return { ...p, imageUrl: url };
          } catch {
            return { ...p, imageUrl: null };
          }
        }
        return p;
      }),
    );

    return NextResponse.json({
      success: true,
      data: withUrls,
    } satisfies ApiResponse<PhotoEntry[]>);
  } catch (error) {
    console.error('Failed to list photos:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load photos' } satisfies ApiResponse,
      { status: 500 },
    );
  }
}
