'use client';

import { useState, useEffect, useMemo } from 'react';
import { VideoEntry } from '@/lib/types';
import VideoCard from './VideoCard';
import VideoPlayerModal from './VideoPlayerModal';

export default function LibraryGrid() {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<VideoEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [tagFilter, setTagFilter] = useState('');

  useEffect(() => {
    fetchVideos();
  }, []);

  async function fetchVideos() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/videos');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load videos');
      setVideos(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }

  const filteredVideos = useMemo(() => {
    let result = videos;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((v) => v.title.toLowerCase().includes(q));
    }

    if (tagFilter) {
      result = result.filter((v) => v.tags?.includes(tagFilter));
    }

    if (sortBy === 'oldest') {
      result = [...result].reverse();
    }

    return result;
  }, [videos, searchQuery, sortBy, tagFilter]);

  const availableTags = useMemo(
    () => Array.from(new Set(videos.flatMap((video) => video.tags || []))).sort((a, b) => a.localeCompare(b)),
    [videos],
  );

  const groupedVideos = useMemo(() => {
    const groups: { label: string; videos: VideoEntry[] }[] = [];
    let currentLabel = '';

    for (const video of filteredVideos) {
      const d = new Date(video.date);
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (label !== currentLabel) {
        groups.push({ label, videos: [] });
        currentLabel = label;
      }
      groups[groups.length - 1].videos.push(video);
    }

    return groups;
  }, [filteredVideos]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="aspect-video bg-surface-800" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-surface-800 rounded w-3/4" />
                <div className="h-3 bg-surface-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <svg className="w-16 h-16 text-surface-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        <p className="text-surface-400">{error}</p>
        <button onClick={fetchVideos} className="btn-secondary">Try Again</button>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
        <div className="w-24 h-24 rounded-full bg-surface-900 border border-white/[0.06] flex items-center justify-center">
          <svg className="w-12 h-12 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-surface-300 font-medium text-lg">No recordings yet</p>
          <p className="text-surface-500 text-sm mt-1">Head over to Record to capture your first video</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search, tag filter & sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recordings…"
            className="input-field pl-10"
          />
        </div>
        <select
          aria-label="Filter by tag"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="input-field w-auto min-w-[140px] cursor-pointer"
        >
          <option value="">All tags</option>
          {availableTags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
          className="input-field w-auto min-w-[140px] cursor-pointer"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-sm text-surface-500">
        {filteredVideos.length} recording{filteredVideos.length !== 1 ? 's' : ''}
        {searchQuery && ` matching "${searchQuery}"`}
        {tagFilter && ` tagged "${tagFilter}"`}
      </p>

      {/* Grouped grid */}
      {groupedVideos.map((group) => (
        <div key={group.label}>
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-4">
            {group.label}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onClick={() => setSelectedVideo(video)}
              />
            ))}
          </div>
        </div>
      ))}

      {filteredVideos.length === 0 && (searchQuery || tagFilter) && (
        <div className="text-center py-12">
          <p className="text-surface-400">No recordings match your filters</p>
        </div>
      )}

      {/* Player modal */}
      {selectedVideo && (
        <VideoPlayerModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onDeleted={() => { setSelectedVideo(null); fetchVideos(); }}
        />
      )}
    </div>
  );
}
