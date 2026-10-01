import { NextRequest, NextResponse } from 'next/server';
import { uploadPhoto, buildPhotoPath, slugify } from '@/lib/local-storage';
import { getSessionEmail } from '@/lib/auth';
import type { ApiResponse, UploadResult } from '@/lib/types';
import { MAX_PHOTO_BYTES, isAllowedImage, requestExceedsLimit } from '@/lib/upload-validation';

export async function POST(request: NextRequest) {
  try {
    const email = await getSessionEmail(request);

    if (requestExceedsLimit(request, MAX_PHOTO_BYTES + 64 * 1024)) {
      return NextResponse.json(
        { success: false, error: 'Photo upload is too large' } satisfies ApiResponse,
        { status: 413 },
      );
    }

    const formData = await request.formData();
    const photoFile = formData.get('photo') as File | null;
    const title = (formData.get('title') as string) || 'Selfie';

    if (!photoFile || !isAllowedImage(photoFile) || photoFile.size > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Invalid or oversized photo file' } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const now = new Date();
    const slug = slugify(title);
    const photoPath = buildPhotoPath(email, now, slug);

    const buffer = Buffer.from(await photoFile.arrayBuffer());
    await uploadPhoto(buffer, photoPath, { title });

    return NextResponse.json({
      success: true,
      data: { success: true, photoPath },
    } satisfies ApiResponse<UploadResult>);
  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Upload failed' } satisfies ApiResponse,
      { status: 500 },
    );
  }
}
