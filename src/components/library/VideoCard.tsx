'use client';

import { VideoEntry } from '@/lib/types';
import { formatDuration, formatRelativeDate, formatFileSize } from '@/lib/utils';

interface VideoCardProps {
  video: VideoEntry;
  onClick: () => void;
}

export default function VideoCard({ video, onClick }: VideoCardProps) {
  return (
    <button
      onClick={onClick}
      className="card-interactive w-full text-left group"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-surface-800 overflow-hidden">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
            <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Duration badge */}
        {video.durationSeconds && video.durationSeconds > 0 && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-xs font-mono text-white">
            {formatDuration(video.durationSeconds)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-1.5">
        <h3 className="font-medium text-sm truncate group-hover:text-accent transition-colors">
          {video.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <span>{formatRelativeDate(video.date)}</span>
          {video.sizeBytes && (
            <>
              <span className="text-surface-700">·</span>
              <span>{formatFileSize(video.sizeBytes)}</span>
            </>
          )}
        </div>
        {video.transcript && (
          <p className="text-xs text-surface-400 line-clamp-2 pt-1" title={video.transcript}>
            {video.transcript}
          </p>
        )}
        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {video.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-md bg-accent/10 text-accent-light text-[11px]">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
