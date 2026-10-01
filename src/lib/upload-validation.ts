import { NextRequest } from 'next/server';

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export function requestExceedsLimit(request: NextRequest, maxBytes: number): boolean {
  const contentLength = request.headers.get('content-length');
  return contentLength !== null && Number.isFinite(Number(contentLength)) && Number(contentLength) > maxBytes;
}

export function isAllowedVideo(file: File): boolean {
  return file.type === 'video/mp4' || file.type.startsWith('video/webm');
}

export function isAllowedImage(file: File): boolean {
  return file.type === 'image/jpeg' || file.type === 'image/png';
}