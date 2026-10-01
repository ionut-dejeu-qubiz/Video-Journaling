import { NextRequest, NextResponse } from 'next/server';
import { deleteVideo } from '@/lib/local-storage';
import { getSessionEmail } from '@/lib/auth';
import type { ApiResponse } from '@/lib/types';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const email = await getSessionEmail(request);
    const { id } = await params;
    const videoId = decodeURIComponent(id);
    const deleted = await deleteVideo(email, videoId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Video not found' } satisfies ApiResponse,
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true } satisfies ApiResponse);
  } catch (error) {
    console.error('Delete video error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete video' } satisfies ApiResponse,
      { status: 500 },
    );
  }
}
