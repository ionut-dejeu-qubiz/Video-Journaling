# Video Journal

Personal video journaling app. Record in the browser, save files locally, and browse them from a library — no database.

## Features

- **Record** — capture video/audio directly in the browser with live preview, pause/resume, and post-recording review
- **Library** — browse all recordings in a searchable, sortable grid grouped by month, with thumbnail posters and lazy video loading
- **Photos** — take selfies with an eye-alignment guide, browse in a gallery, and generate a "You Through Time" video
- **You Through Time** — uses face-api.js to detect eyes in each photo, aligns them to a fixed point, and stitches everything into a video where your eyes stay locked while everything else changes
- **Streak** — track your recording consistency with current/longest streak stats and a 90-day activity calendar
- **Auth** — single-admin login via env-based credentials with secure JWT session cookies
- **No database** — all data lives in local files, paths, and sidecar metadata

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Storage | Local filesystem |
| Auth | JWT sessions via `jose` |
| Recording | MediaRecorder API |

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url> && cd video-journaling
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description |
|----------|-------------|
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |
| `ADMIN_EMAIL` | Admin email — used as the top-level storage folder to isolate user data |
| `AUTH_SECRET` | Random secret for JWT signing (`openssl rand -base64 32`) |
| `LOCAL_STORAGE_DIR` | Local storage directory; defaults to `./storage` |

### 3. Set up local storage

The application creates the directory automatically. Keep `storage/` backed up separately; it is ignored by git.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in.

## Architecture

### No-Database Design

All data is derived from local files:

| Data | Source |
|------|--------|
| Video list | Recursive listing under `{email}/videos/` — scoped per user, path encodes date and slug |
| Titles | Sidecar metadata (`.meta.json`) next to each media file |
| Duration | Sidecar metadata (`durationSeconds`) |
| File size | Local file size |
| Thumbnails | Matching objects under `{email}/thumbnails/` with same date path and slug |
| Transcripts | Matching objects under `{email}/transcripts/` (future) |
| Streak | Computed from unique date prefixes in `{email}/videos/` listing |

### Local Storage Structure

All files are scoped under the user's email as the top-level folder. This keeps each user's data isolated.

```
{email}/
  videos/
    YYYY/MM/DD/{timestamp}_{slug}.webm
  thumbnails/
    YYYY/MM/DD/{timestamp}_{slug}.jpg
  photos/
    YYYY/MM/DD/{timestamp}_{slug}.jpg
  transcripts/
    YYYY/MM/DD/{timestamp}_{slug}.json    ← reserved for future use
```

For example, if the admin email is `alice@example.com`:

```
alice@example.com/videos/2026/04/17/1713350400000_morning-practice.webm
alice@example.com/thumbnails/2026/04/17/1713350400000_morning-practice.jpg
```

The timestamp is epoch milliseconds and the slug is derived from the user-provided title. Together they form a unique, sortable, human-readable ID.

### Streaming / Lazy Loading

- **Library** shows only thumbnail poster images (small JPEGs from `thumbnails/`)
- Full video is **never preloaded** — it only streams when the user clicks play
- On click, an authenticated local media URL is generated server-side
- Media is served through the app's `/api/storage` endpoint

### Thumbnail Generation

Thumbnails are extracted **client-side** before upload:
1. The recorded blob is loaded into a hidden `<video>` element
2. Once loaded, it seeks to 0.1s and draws the frame onto a `<canvas>`
3. The canvas is exported as a JPEG blob and uploaded alongside the video

### Auth Flow

1. Login form POSTs credentials to `/api/auth/login`
2. Server validates against `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars
3. On success, a JWT containing `{ role, email }` (signed with `AUTH_SECRET`) is set as an HTTP-only, secure cookie
4. API routes extract `email` from the JWT to scope all local storage operations to that user's folder
5. Next.js middleware checks the cookie on every protected route
6. Invalid/expired sessions redirect to `/login`

### Route Protection

The middleware at `src/middleware.ts` intercepts all routes except `/login`, `/api/auth/login`, and static assets. It verifies the JWT session cookie and redirects unauthenticated requests to the login page.

## Transcription

Not included yet — none of the free-tier speech-to-text options (Web Speech API, Whisper, Google STT) work well enough without a paid account. The `transcripts/` prefix is reserved and `buildTranscriptPath()` exists, so plugging one in later is straightforward.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Tailwind + custom styles
│   ├── page.tsx                    # Root redirect
│   ├── login/page.tsx              # Login page
│   ├── (app)/
│   │   ├── layout.tsx              # App shell with sidebar
│   │   ├── record/page.tsx         # Record tab
│   │   ├── library/page.tsx        # Library tab
│   │   ├── photos/page.tsx         # Photos (capture / gallery / time lapse)
│   │   └── streak/page.tsx         # Streak tab
│   └── api/
│       ├── auth/{login,logout}/    # Auth endpoints
│       ├── videos/                 # List, upload, signed-url
│       ├── photos/                 # List, upload, signed-url
│       └── streak/route.ts         # Streak data
├── components/
│   ├── layout/Sidebar.tsx
│   ├── record/
│   │   ├── Recorder.tsx
│   │   ├── RecordingTimer.tsx
│   │   └── UploadProgress.tsx
│   ├── library/
│   │   ├── LibraryGrid.tsx
│   │   ├── VideoCard.tsx
│   │   └── VideoPlayerModal.tsx
│   ├── photos/
│   │   ├── PhotoCapture.tsx        # Camera with eye-alignment guide
│   │   ├── PhotoGallery.tsx        # Photo grid
│   │   ├── PhotoCard.tsx
│   │   ├── PhotoViewerModal.tsx
│   │   └── TimeLapseGenerator.tsx  # Face detection + video stitching
│   └── streak/
│       ├── StreakDashboard.tsx
│       └── ActivityCalendar.tsx
├── lib/
│   ├── types.ts                    # Shared TypeScript types
│   ├── auth.ts                     # JWT session utilities
│   ├── local-storage.ts            # Local filesystem storage
│   ├── streak.ts                   # Streak computation
│   └── utils.ts                    # Formatting helpers
└── middleware.ts                   # Route protection
```

## Production Deployment

For Docker or a self-hosted server:

1. Set all env vars in the deployment platform
2. Set `LOCAL_STORAGE_DIR` if storage should live outside the project directory
3. Mount a persistent volume at `/app/storage` when using the Docker image
4. Back up the storage directory separately from the application

## Next Steps

### Multi-user support

Right now there's a single admin user via env vars. To support multiple users:

1. Add a real auth provider (NextAuth.js with Google/GitHub OAuth, or Firebase Auth)
2. Store the authenticated user's email the same way `ADMIN_EMAIL` is used today — it already scopes all local paths under `{email}/`, so each user's data is isolated
3. Drop the `ADMIN_*` env vars and the password login route
4. The rest of the app (storage paths, library, streak) works as-is with no changes

### Transcription

The `transcripts/` prefix and `buildTranscriptPath()` are already in place. To wire it up:

1. After upload, send the video to a speech-to-text API (Whisper, Google STT, Deepgram)
2. Save the result as JSON to `{email}/transcripts/YYYY/MM/DD/{ts}_{slug}.json`
3. `VideoEntry.hasTranscript` is already computed from the local listing — just add a UI to display it

### Other ideas

- Tags and notes per recording (store in sidecar JSON metadata)
- Video trimming / editing before upload
- Screen + camera recording (picture-in-picture)
- Export / download recordings
- Shareable signed links with expiry
- Search across transcripts
- Resumable / chunked local uploads for large files
- Move uploads to resumable / chunked for large files
