import { NextRequest, NextResponse } from 'next/server';
import { getVideoGcsPath, getSignedUrl } from '@/lib/local-storage';
import { getSessionEmail } from '@/lib/auth';
import type { ApiResponse, SignedUrlResult } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const email = await getSessionEmail(request);
    const { id } = await params;
    const videoId = decodeURIComponent(id);
    const gcsPath = await getVideoGcsPath(email, videoId);

    if (!gcsPath) {
      return NextResponse.json(
        { success: false, error: 'Video not found' } satisfies ApiResponse,
        { status: 404 },
      );
    }

    const result = await getSignedUrl(gcsPath, 120);

    return NextResponse.json({
      success: true,
      data: result,
    } satisfies ApiResponse<SignedUrlResult>);
  } catch (error) {
    console.error('Signed URL error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate signed URL' } satisfies ApiResponse,
      { status: 500 },
    );
  }
}
