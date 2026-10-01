import { NextRequest, NextResponse } from 'next/server';
import { listVideos, getSignedUrl } from '@/lib/local-storage';
import { getSessionEmail } from '@/lib/auth';
import type { ApiResponse, VideoEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const email = await getSessionEmail(request);
    const videos = await listVideos(email);

    const withThumbnails = await Promise.all(
      videos.map(async (v) => {
        if (v.thumbnailUrl) {
          try {
            const { url } = await getSignedUrl(v.thumbnailUrl, 120);
            return { ...v, thumbnailUrl: url };
          } catch {
            return { ...v, thumbnailUrl: null };
          }
        }
        return v;
      }),
    );

    return NextResponse.json({
      success: true,
      data: withThumbnails,
    } satisfies ApiResponse<VideoEntry[]>);
  } catch (error) {
    console.error('Failed to list videos:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load videos' } satisfies ApiResponse,
      { status: 500 },
    );
  }
}
