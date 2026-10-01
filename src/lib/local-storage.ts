import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PhotoEntry, SignedUrlResult, VideoEntry } from './types';

type LocalMetadata = Record<string, string>;

function storageRoot(): string {
  return path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR || 'storage');
}

function userRoot(userEmail: string): string {
  if (!userEmail || userEmail.includes('/') || userEmail.includes('\\')) {
    throw new Error('Invalid storage user');
  }
  return path.join(storageRoot(), userEmail);
}

function filePathForUser(userEmail: string, storagePath: string): string {
  const root = userRoot(userEmail);
  const normalized = storagePath.replace(/\\/g, '/');
  const resolved = path.resolve(storageRoot(), normalized);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Storage path is outside the user directory');
  }
  return resolved;
}

function metadataPath(filePath: string): string {
  return `${filePath}.meta.json`;
}

async function readMetadata(filePath: string): Promise<LocalMetadata> {
  try {
    return JSON.parse(await readFile(metadataPath(filePath), 'utf8')) as LocalMetadata;
  } catch {
    return {};
  }
}

async function writeMetadata(filePath: string, metadata: LocalMetadata): Promise<void> {
  await writeFile(metadataPath(filePath), JSON.stringify(metadata), 'utf8');
}

async function listFiles(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) files.push(...await listFiles(entryPath));
      else if (entry.isFile() && !entry.name.endsWith('.meta.json')) files.push(entryPath);
    }
    return files;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

function relativeStoragePath(filePath: string): string {
  return path.relative(storageRoot(), filePath).replace(/\\/g, '/');
}

function userPrefix(userEmail: string, category: string): string {
  return `${userEmail}/${category}/`;
}

export function buildVideoPath(userEmail: string, date: Date, slug: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${userEmail}/videos/${y}/${m}/${d}/${date.getTime()}_${slug}.webm`;
}

export function buildThumbnailPath(userEmail: string, date: Date, slug: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${userEmail}/thumbnails/${y}/${m}/${d}/${date.getTime()}_${slug}.jpg`;
}

export function buildPhotoPath(userEmail: string, date: Date, slug: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${userEmail}/photos/${y}/${m}/${d}/${date.getTime()}_${slug}.jpg`;
}

export function buildTranscriptPath(userEmail: string, date: Date, slug: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${userEmail}/transcripts/${y}/${m}/${d}/${date.getTime()}_${slug}.json`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';
}

async function saveFile(storagePath: string, buffer: Buffer, metadata: LocalMetadata): Promise<void> {
  const filePath = filePathForUser(storagePath.split('/')[0], storagePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
  await writeMetadata(filePath, metadata);
}

export function uploadVideo(buffer: Buffer, storagePath: string, contentType: string, metadata: LocalMetadata): Promise<void> {
  return saveFile(storagePath, buffer, { ...metadata, contentType });
}

export function uploadThumbnail(buffer: Buffer, storagePath: string): Promise<void> {
  return saveFile(storagePath, buffer, { contentType: 'image/jpeg' });
}

export function uploadPhoto(buffer: Buffer, storagePath: string, metadata: LocalMetadata): Promise<void> {
  return saveFile(storagePath, buffer, { ...metadata, contentType: 'image/jpeg' });
}

export function getSignedUrl(storagePath: string, expiresInMinutes = 60): SignedUrlResult {
  return {
    url: `/api/storage?path=${encodeURIComponent(storagePath)}`,
    expiresAt: Date.now() + expiresInMinutes * 60 * 1000,
  };
}

export async function getFileForUser(userEmail: string, storagePath: string): Promise<{ buffer: Buffer; contentType: string }> {
  const filePath = filePathForUser(userEmail, storagePath);
  const [buffer, metadata] = await Promise.all([readFile(filePath), readMetadata(filePath)]);
  return { buffer, contentType: metadata.contentType || contentTypeForPath(filePath) };
}

function contentTypeForPath(filePath: string): string {
  if (filePath.endsWith('.webm')) return 'video/webm';
  if (filePath.endsWith('.mp4')) return 'video/mp4';
  if (filePath.endsWith('.json')) return 'application/json';
  return 'image/jpeg';
}

function parseVideoPath(name: string): Omit<VideoEntry, 'thumbnailUrl' | 'videoUrl'> | null {
  const match = name.match(/^[^/]+\/videos\/(\d{4})\/(\d{2})\/(\d{2})\/(\d+)_(.+)\.(webm|mp4)$/);
  if (!match) return null;
  const [, year, month, day, tsStr, slug, ext] = match;
  const timestamp = parseInt(tsStr, 10);
  return {
    id: `${timestamp}_${slug}`,
    title: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    slug,
    filename: `${timestamp}_${slug}.${ext}`,
    date: new Date(timestamp).toISOString(),
    year,
    month,
    day,
    timestamp,
    contentType: ext === 'mp4' ? 'video/mp4' : 'video/webm',
    hasTranscript: false,
  };
}

export async function listVideos(userEmail: string): Promise<VideoEntry[]> {
  const files = await listFiles(path.join(userRoot(userEmail), 'videos'));
  const thumbnails = new Set((await listFiles(path.join(userRoot(userEmail), 'thumbnails'))).map(relativeStoragePath));
  const transcripts = new Set((await listFiles(path.join(userRoot(userEmail), 'transcripts'))).map(relativeStoragePath));
  const entries: VideoEntry[] = [];

  for (const filePath of files) {
    const storagePath = relativeStoragePath(filePath);
    const entry = parseVideoPath(storagePath);
    if (!entry) continue;
    const metadata = await readMetadata(filePath);
    if (metadata.title) entry.title = metadata.title;
    if (metadata.durationSeconds) entry.durationSeconds = parseFloat(metadata.durationSeconds);
    if (metadata.transcript) {
      entry.transcript = metadata.transcript;
      entry.hasTranscript = true;
    }
    if (metadata.tags) {
      try {
        const tags = JSON.parse(metadata.tags);
        if (Array.isArray(tags)) entry.tags = tags.filter((tag): tag is string => typeof tag === 'string');
      } catch {
        // Ignore malformed metadata from older or manually edited sidecars.
      }
    }
    entry.sizeBytes = (await stat(filePath)).size;
    const thumbPath = storagePath.replace('/videos/', '/thumbnails/').replace(/\.(webm|mp4)$/, '.jpg');
    entry.hasTranscript = entry.hasTranscript || transcripts.has(
      storagePath.replace('/videos/', '/transcripts/').replace(/\.(webm|mp4)$/, '.json'),
    );
    entries.push({ ...entry, thumbnailUrl: thumbnails.has(thumbPath) ? thumbPath : null });
  }
  return entries.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getVideoGcsPath(userEmail: string, id: string): Promise<string | null> {
  const files = await listFiles(path.join(userRoot(userEmail), 'videos'));
  return files.map(relativeStoragePath).find((file) => file.match(/(\d+_.+)\.(webm|mp4)$/)?.[1] === id) || null;
}

export async function getPhotoGcsPath(userEmail: string, id: string): Promise<string | null> {
  const files = await listFiles(path.join(userRoot(userEmail), 'photos'));
  return files.map(relativeStoragePath).find((file) => file.match(/(\d+_.+)\.jpg$/)?.[1] === id) || null;
}

export async function listPhotos(userEmail: string): Promise<PhotoEntry[]> {
  const files = await listFiles(path.join(userRoot(userEmail), 'photos'));
  const entries: PhotoEntry[] = [];
  for (const filePath of files) {
    const name = relativeStoragePath(filePath);
    const match = name.match(/^[^/]+\/photos\/(\d{4})\/(\d{2})\/(\d{2})\/(\d+)_(.+)\.jpg$/);
    if (!match) continue;
    const [, year, month, day, tsStr, slug] = match;
    const timestamp = parseInt(tsStr, 10);
    const metadata = await readMetadata(filePath);
    entries.push({
      id: `${timestamp}_${slug}`,
      title: metadata.title || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      slug,
      filename: `${timestamp}_${slug}.jpg`,
      imageUrl: name,
      date: new Date(timestamp).toISOString(),
      year,
      month,
      day,
      timestamp,
      sizeBytes: (await stat(filePath)).size,
    });
  }
  return entries.sort((a, b) => b.timestamp - a.timestamp);
}

async function deleteStorageFile(userEmail: string, storagePath: string): Promise<void> {
  const filePath = filePathForUser(userEmail, storagePath);
  await unlink(filePath).catch(() => {});
  await unlink(metadataPath(filePath)).catch(() => {});
}

export async function deleteVideo(userEmail: string, id: string): Promise<boolean> {
  const videoPath = await getVideoGcsPath(userEmail, id);
  if (!videoPath) return false;
  await deleteStorageFile(userEmail, videoPath);
  await deleteStorageFile(userEmail, videoPath.replace('/videos/', '/thumbnails/').replace(/\.(webm|mp4)$/, '.jpg'));
  await deleteStorageFile(userEmail, videoPath.replace('/videos/', '/transcripts/').replace(/\.(webm|mp4)$/, '.json'));
  return true;
}

export async function deletePhoto(userEmail: string, id: string): Promise<boolean> {
  const photoPath = await getPhotoGcsPath(userEmail, id);
  if (!photoPath) return false;
  await deleteStorageFile(userEmail, photoPath);
  return true;
}

export async function getUploadDates(userEmail: string): Promise<string[]> {
  const files = await listFiles(path.join(userRoot(userEmail), 'videos'));
  const dates = new Set<string>();
  for (const filePath of files) {
    const match = relativeStoragePath(filePath).match(/\/videos\/(\d{4})\/(\d{2})\/(\d{2})\//);
    if (match) dates.add(`${match[1]}-${match[2]}-${match[3]}`);
  }
  return Array.from(dates).sort().reverse();
}