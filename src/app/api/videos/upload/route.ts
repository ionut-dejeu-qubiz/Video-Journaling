import { NextRequest, NextResponse } from 'next/server';
import { uploadVideo, uploadThumbnail, buildVideoPath, buildThumbnailPath, slugify } from '@/lib/local-storage';
import { getSessionEmail } from '@/lib/auth';
import type { ApiResponse, UploadResult } from '@/lib/types';
import {
  MAX_THUMBNAIL_BYTES,
  MAX_VIDEO_BYTES,
  isAllowedImage,
  isAllowedVideo,
  requestExceedsLimit,
} from '@/lib/upload-validation';

const MAX_VIDEO_REQUEST_BYTES = MAX_VIDEO_BYTES + MAX_THUMBNAIL_BYTES + 64 * 1024;

export async function POST(request: NextRequest) {
  try {
    const email = await getSessionEmail(request);

    if (requestExceedsLimit(request, MAX_VIDEO_REQUEST_BYTES)) {
      return NextResponse.json(
        { success: false, error: 'Video upload is too large' } satisfies ApiResponse,
        { status: 413 },
      );
    }

    const formData = await request.formData();
    const videoFile = formData.get('video') as File | null;
    const thumbnailFile = formData.get('thumbnail') as File | null;
    const title = (formData.get('title') as string) || 'Untitled';
    const durationStr = formData.get('duration') as string | null;
    const transcript = (formData.get('transcript') as string | null)?.trim().slice(0, 100_000);
    const tags = Array.from(new Set(
      ((formData.get('tags') as string | null) || '')
        .split(',')
        .map((tag) => tag.trim().toLowerCase().slice(0, 40))
        .filter(Boolean),
    )).slice(0, 20);

    if (!videoFile || !isAllowedVideo(videoFile) || videoFile.size > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Invalid or oversized video file' } satisfies ApiResponse,
        { status: 400 },
      );
    }

    if (thumbnailFile && (!isAllowedImage(thumbnailFile) || thumbnailFile.size > MAX_THUMBNAIL_BYTES)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or oversized thumbnail file' } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const now = new Date();
    const slug = slugify(title);
    const videoPath = buildVideoPath(email, now, slug);

    const metadata: Record<string, string> = { title };
    if (durationStr) metadata.durationSeconds = durationStr;
    if (transcript) metadata.transcript = transcript;
    if (tags.length > 0) metadata.tags = JSON.stringify(tags);

    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    await uploadVideo(videoBuffer, videoPath, videoFile.type.startsWith('video/mp4') ? 'video/mp4' : 'video/webm', metadata);

    let thumbnailPath: string | undefined;
    if (thumbnailFile) {
      thumbnailPath = buildThumbnailPath(email, now, slug);
      const thumbBuffer = Buffer.from(await thumbnailFile.arrayBuffer());
      await uploadThumbnail(thumbBuffer, thumbnailPath);
    }

    return NextResponse.json({
      success: true,
      data: { success: true, videoPath, thumbnailPath },
    } satisfies ApiResponse<UploadResult>);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Upload failed' } satisfies ApiResponse,
      { status: 500 },
    );
  }
}
