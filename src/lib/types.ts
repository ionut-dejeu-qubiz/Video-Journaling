export interface VideoEntry {
  id: string;
  title: string;
  slug: string;
  filename: string;
  thumbnailUrl: string | null;
  videoUrl?: string;
  date: string;         // ISO date string
  year: string;
  month: string;
  day: string;
  timestamp: number;
  durationSeconds?: number;
  sizeBytes?: number;
  contentType: string;
  hasTranscript: boolean;
  transcript?: string;
  tags?: string[];
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalRecordings: number;
  recordingDates: string[];   // ISO date strings, sorted descending
  calendarData: CalendarDay[];
}

export interface CalendarDay {
  date: string;       // YYYY-MM-DD
  count: number;
  hasRecording: boolean;
}

export interface PhotoEntry {
  id: string;
  title: string;
  slug: string;
  filename: string;
  imageUrl: string | null;
  date: string;
  year: string;
  month: string;
  day: string;
  timestamp: number;
  sizeBytes?: number;
}

export interface UploadResult {
  success: boolean;
  videoPath?: string;
  thumbnailPath?: string;
  photoPath?: string;
  error?: string;
}

export interface EyePositions {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  midpoint: { x: number; y: number };
  distance: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SignedUrlResult {
  url: string;
  expiresAt: number;
}
