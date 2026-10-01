import { NextRequest, NextResponse } from 'next/server';
import { deletePhoto } from '@/lib/local-storage';
import { getSessionEmail } from '@/lib/auth';
import type { ApiResponse } from '@/lib/types';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const email = await getSessionEmail(request);
    const { id } = await params;
    const photoId = decodeURIComponent(id);
    const deleted = await deletePhoto(email, photoId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Photo not found' } satisfies ApiResponse,
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true } satisfies ApiResponse);
  } catch (error) {
    console.error('Delete photo error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete photo' } satisfies ApiResponse,
      { status: 500 },
    );
  }
}
