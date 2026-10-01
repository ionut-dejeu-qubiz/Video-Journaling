'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import RecordingTimer from './RecordingTimer';
import UploadProgress from './UploadProgress';
import { getRandomJokeExcluding } from '@/lib/jokes';
import { loadFaceDetection } from '@/lib/face-detection';

type RecordingState = 'idle' | 'previewing' | 'recording' | 'paused' | 'review' | 'photo-review';
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';
type Mood = 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral' | 'fearful' | 'disgusted' | null;
type TranscriptionStatus = 'inactive' | 'listening' | 'unavailable';

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

const MOOD_EMOJI: Record<NonNullable<Mood>, string> = {
  happy: '😄', sad: '😢', angry: '😠', surprised: '😲',
  neutral: '😐', fearful: '😨', disgusted: '🤢',
};

const MOOD_LABEL: Record<NonNullable<Mood>, string> = {
  happy: 'Happy', sad: 'Sad', angry: 'Angry', surprised: 'Surprised',
  neutral: 'Neutral', fearful: 'Fearful', disgusted: 'Disgusted',
};

export default function Recorder() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reviewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const detectionLoopRef = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceapiRef = useRef<any>(null);
  const lastJokeRef = useRef('');
  const jokeShownAtRef = useRef(0);
  const wasSadRef = useRef(false);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechShouldRunRef = useRef(false);
  const finalTranscriptRef = useRef('');

  const [state, setState] = useState<RecordingState>('idle');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mirrored, setMirrored] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [mood, setMood] = useState<Mood>(null);
  const [joke, setJoke] = useState<string | null>(null);
  const [jokeVisible, setJokeVisible] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionStatus>('inactive');

  const isLive = state === 'previewing' || state === 'recording' || state === 'paused';

  const JOKE_MIN_MS = 2000;
  const JOKE_MAX_MS = 5000;

  const startDetectionLoop = useCallback(async () => {
    try {
      const faceapi = await loadFaceDetection();
      faceapiRef.current = faceapi;
      setModelsLoaded(true);
    } catch (err) {
      console.error('Mood detection unavailable:', err);
      return;
    }

    if (!videoRef.current) return;
    const faceapi = faceapiRef.current;

    const detect = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
      try {
        const result = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
          .withFaceExpressions();
        if (result) {
          const sorted = Object.entries(result.expressions).sort(
            (a: [string, unknown], b: [string, unknown]) => (b[1] as number) - (a[1] as number),
          );
          const mapped = sorted[0][0] as Mood;
          setMood(mapped);

          const now = Date.now();
          const jokeAge = now - jokeShownAtRef.current;

          if (jokeAge >= JOKE_MAX_MS) {
            setJokeVisible(false);
            wasSadRef.current = false;
          }

          const triggersJoke = mapped === 'sad' || mapped === 'neutral';

          if (triggersJoke) {
            if (!wasSadRef.current) {
              const j = getRandomJokeExcluding(lastJokeRef.current);
              lastJokeRef.current = j;
              setJoke(j);
              setJokeVisible(true);
              jokeShownAtRef.current = now;
            }
            wasSadRef.current = true;
          } else {
            if (wasSadRef.current && jokeAge >= JOKE_MIN_MS) {
              setJokeVisible(false);
            }
            wasSadRef.current = false;
          }
        } else {
          setMood(null);
          const jokeAge = Date.now() - jokeShownAtRef.current;
          if (jokeAge >= JOKE_MIN_MS) {
            setJokeVisible(false);
          }
          wasSadRef.current = false;
        }
      } catch { /* retry next cycle */ }
      detectionLoopRef.current = window.setTimeout(detect, 800);
    };
    detectionLoopRef.current = window.setTimeout(detect, 1500);
  }, []);

  const stopDetectionLoop = useCallback(() => {
    if (detectionLoopRef.current) { clearTimeout(detectionLoopRef.current); detectionLoopRef.current = null; }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setState('previewing');
      setMood(null);
      setJokeVisible(false);
    } catch {
      setCameraError('Could not access camera/microphone. Please grant permission and try again.');
    }
  }, []);

  useEffect(() => {
    if (isLive) startDetectionLoop();
    return () => stopDetectionLoop();
  }, [isLive, startDetectionLoop, stopDetectionLoop]);

  const stopCamera = useCallback(() => {
    stopDetectionLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setMood(null);
    setJokeVisible(false);
  }, [stopDetectionLoop]);

  const stopTranscription = useCallback(() => {
    speechShouldRunRef.current = false;
    const recognition = speechRecognitionRef.current;
    speechRecognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      try { recognition.stop(); } catch { /* recognition may already be stopped */ }
    }
    setTranscriptionStatus('inactive');
  }, []);

  const startTranscription = useCallback(() => {
    const speechWindow = window as SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setTranscriptionStatus('unavailable');
      return;
    }

    finalTranscriptRef.current = finalTranscriptRef.current.trim();
    speechShouldRunRef.current = true;
    const recognition = new Recognition();
    speechRecognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalTranscriptRef.current += `${result[0].transcript.trim()} `;
        else interim += result[0].transcript;
      }
      setTranscript(`${finalTranscriptRef.current}${interim}`.trim());
    };
    recognition.onerror = () => {
      if (speechShouldRunRef.current) setTranscriptionStatus('unavailable');
    };
    recognition.onend = () => {
      if (!speechShouldRunRef.current || speechRecognitionRef.current !== recognition) return;
      try { recognition.start(); } catch { /* browser may be between recognition sessions */ }
    };
    try {
      recognition.start();
      setTranscriptionStatus('listening');
    } catch {
      setTranscriptionStatus('unavailable');
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    finalTranscriptRef.current = '';
    setTranscript('');
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;
    recordingStartRef.current = Date.now();
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      setRecordingDuration(Math.round((Date.now() - recordingStartRef.current) / 1000));
      stopTranscription();
      stopCamera();
      setState('review');
    };
    recorder.start(1000);
    startTranscription();
    setState('recording');
  }, [startTranscription, stopCamera, stopTranscription]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      stopTranscription();
      setState('paused');
    }
  }, [stopTranscription]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      startTranscription();
      setState('recording');
    }
  }, [startTranscription]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      stopTranscription();
      mediaRecorderRef.current.stop();
    }
  }, [stopTranscription]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (mirrored) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setPhotoBlob(blob);
      setPhotoUrl(URL.createObjectURL(blob));
      stopCamera();
      setState('photo-review');
    }, 'image/jpeg', 0.92);
  }, [mirrored, stopCamera]);

  const discard = useCallback(() => {
    stopTranscription();
    setRecordedBlob(null);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoBlob(null);
    setPhotoUrl(null);
    setTitle('');
    setTags('');
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadError('');
    setTranscript('');
    finalTranscriptRef.current = '';
    setState('idle');
  }, [photoUrl, stopTranscription]);

  const extractThumbnail = useCallback(async (blob: Blob): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.muted = true; video.playsInline = true; video.preload = 'auto';
      video.onloadeddata = () => { video.currentTime = 0.1; };
      video.onseeked = () => {
        const c = document.createElement('canvas');
        c.width = video.videoWidth; c.height = video.videoHeight;
        const ctx = c.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(video, 0, 0);
        c.toBlob((b) => { URL.revokeObjectURL(video.src); resolve(b); }, 'image/jpeg', 0.85);
      };
      video.onerror = () => { URL.revokeObjectURL(video.src); resolve(null); };
      video.src = URL.createObjectURL(blob);
    });
  }, []);

  const handleUpload = useCallback(async () => {
    const isPhoto = state === 'photo-review';
    const blob = isPhoto ? photoBlob : recordedBlob;
    if (!blob) return;

    setUploadStatus('uploading');
    setUploadProgress(0);
    setUploadError('');

    try {
      if (isPhoto) {
        setUploadProgress(40);
        const fd = new FormData();
        fd.append('photo', blob, 'photo.jpg');
        fd.append('title', title || 'Selfie');
        const res = await fetch('/api/photos/upload', { method: 'POST', body: fd });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Upload failed'); }
        setUploadProgress(100);
        setUploadStatus('success');
      } else {
        setUploadProgress(10);
        const thumbnail = await extractThumbnail(blob);
        setUploadProgress(20);
        const fd = new FormData();
        fd.append('video', blob, 'recording.webm');
        fd.append('title', title || 'Untitled');
        fd.append('duration', String(recordingDuration));
        if (transcript.trim()) fd.append('transcript', transcript.trim());
        if (tags.trim()) fd.append('tags', tags.trim());
        if (thumbnail) fd.append('thumbnail', thumbnail, 'thumbnail.jpg');
        const interval = setInterval(() => setUploadProgress((p) => Math.min(p + 5, 85)), 500);
        const res = await fetch('/api/videos/upload', { method: 'POST', body: fd });
        clearInterval(interval);
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Upload failed'); }
        setUploadProgress(100);
        setUploadStatus('success');
      }
    } catch (err) {
      setUploadStatus('error');
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    }
  }, [state, photoBlob, recordedBlob, title, tags, recordingDuration, transcript, extractThumbnail]);

  useEffect(() => {
    if (recordedBlob && reviewVideoRef.current) reviewVideoRef.current.src = URL.createObjectURL(recordedBlob);
  }, [recordedBlob]);

  useEffect(() => {
    return () => { stopCamera(); if (photoUrl) URL.revokeObjectURL(photoUrl); };
  }, [stopCamera, stopTranscription, photoUrl]);

  const isReview = state === 'review' || state === 'photo-review';

  return (
    <div className="space-y-6">
      {/* Viewport */}
      <div className="relative aspect-video bg-surface-900 rounded-2xl overflow-hidden border border-white/[0.06]">
        {/* Idle */}
        {state === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-surface-300 font-medium">Ready to record or capture</p>
              <p className="text-surface-500 text-sm mt-1">Open the camera, then record a video or take a photo</p>
            </div>
            {cameraError && (
              <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-2 max-w-md text-center">{cameraError}</p>
            )}
          </div>
        )}

        {/* Live feed — always mounted */}
        <video
          ref={videoRef}
          autoPlay playsInline muted
          className={`w-full h-full object-cover transition-transform duration-200 ${isLive ? 'block' : 'hidden'} ${mirrored ? '-scale-x-100' : ''}`}
        />

        {/* Recording timer */}
        {(state === 'recording' || state === 'paused') && (
          <div className="absolute top-4 left-4">
            <RecordingTimer isRecording={state === 'recording' || state === 'paused'} isPaused={state === 'paused'} />
          </div>
        )}

        {/* Eye alignment guide */}
        {isLive && showGuide && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-0 right-0 border-t-2 border-dashed border-accent/50" style={{ top: '38%' }} />
            <div className="absolute flex gap-[22%] justify-center w-full" style={{ top: 'calc(38% - 8px)' }}>
              <div className="w-4 h-4 rounded-full border-2 border-accent/60" />
              <div className="w-4 h-4 rounded-full border-2 border-accent/60" />
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-accent/70 font-medium tracking-wider uppercase" style={{ top: 'calc(38% + 6px)' }}>
              align eyes
            </div>
          </div>
        )}

        {/* Mood badge — centered */}
        {isLive && mood && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center animate-fade-in">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-sm">
              <span className="text-base">{MOOD_EMOJI[mood]}</span>
              <span className="text-white/80 font-medium">{MOOD_LABEL[mood]}</span>
            </div>
          </div>
        )}

        {/* Joke toast — centered */}
        {isLive && jokeVisible && joke && (
          <div className="absolute bottom-16 left-0 right-0 flex justify-center px-4 animate-slide-up">
            <div className="relative max-w-md w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-md border border-amber-400/20 text-center">
              <button onClick={() => { setJokeVisible(false); jokeShownAtRef.current = 0; }} className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white/80">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
              <p className="text-sm text-white/90 leading-relaxed"><span className="text-base mr-1.5">😄</span>{joke}</p>
            </div>
          </div>
        )}

        {/* Toolbar */}
        {isLive && (
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={() => setShowGuide((g) => !g)}
              title={showGuide ? 'Hide eye guide' : 'Show eye guide'}
              className={`p-2.5 rounded-xl backdrop-blur-sm border transition-all ${showGuide ? 'bg-accent/20 border-accent/30 text-accent' : 'bg-black/40 border-white/10 text-white/80 hover:text-white'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
            <button
              onClick={() => setMirrored((m) => !m)}
              title={mirrored ? 'Disable mirror' : 'Enable mirror'}
              className="relative p-2.5 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              {mirrored && <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent border-2 border-surface-900" />}
            </button>
          </div>
        )}

        {/* Models loading */}
        {isLive && !modelsLoaded && (
          <div className="absolute top-4 left-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-xs text-white/60">
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Loading mood detection…
            </div>
          </div>
        )}

        {/* Video review */}
        {state === 'review' && (
          <video ref={reviewVideoRef} controls playsInline className="w-full h-full object-contain bg-black" />
        )}

        {/* Photo review */}
        {state === 'photo-review' && photoUrl && (
          <img src={photoUrl} alt="Captured" className="w-full h-full object-contain bg-black" />
        )}
      </div>

      {(state === 'recording' || state === 'paused' || (state === 'review' && transcript)) && (
        <div className="rounded-2xl border border-white/[0.06] bg-surface-900/70 p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="text-sm font-medium text-surface-300">Transcript</h2>
            {state !== 'review' && (
              <span className={`text-xs ${transcriptionStatus === 'listening' ? 'text-success' : 'text-warning'}`}>
                {transcriptionStatus === 'listening' ? 'Listening' : 'Speech recognition unavailable'}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-surface-200 whitespace-pre-wrap max-h-32 overflow-y-auto">
            {transcript || 'Start speaking and your words will appear here.'}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col items-center gap-4">
        {state === 'idle' && (
          <button onClick={startCamera} className="btn-primary px-8 py-3 text-base">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            Open Camera
          </button>
        )}

        {state === 'previewing' && (
          <div className="flex items-center gap-3">
            <button onClick={() => { stopCamera(); setState('idle'); }} className="btn-secondary">Cancel</button>
            <button onClick={capturePhoto} className="btn-secondary px-5 py-2.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
              </svg>
              Take Photo
            </button>
            <button onClick={startRecording} className="btn-primary px-8 py-3 text-base group">
              <span className="w-4 h-4 rounded-full bg-danger group-hover:scale-110 transition-transform" />
              Record Video
            </button>
          </div>
        )}

        {(state === 'recording' || state === 'paused') && (
          <div className="flex items-center gap-3">
            {state === 'recording' ? (
              <button onClick={pauseRecording} className="btn-secondary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" /></svg>
                Pause
              </button>
            ) : (
              <button onClick={resumeRecording} className="btn-secondary">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                Resume
              </button>
            )}
            <button onClick={stopRecording} className="btn-danger px-6 py-2.5">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              Stop
            </button>
          </div>
        )}

        {isReview && (
          <div className="w-full max-w-lg space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-surface-300 mb-2">Title (optional)</label>
              <input
                id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                className="input-field" placeholder={state === 'photo-review' ? 'e.g. Day 1, Morning selfie…' : 'Give your recording a title…'}
              />
            </div>
            {state === 'review' && (
              <div>
                <label htmlFor="tags" className="block text-sm font-medium text-surface-300 mb-2">Tags</label>
                <input
                  id="tags" type="text" value={tags} onChange={(e) => setTags(e.target.value)}
                  className="input-field" placeholder="e.g. practice, ideas, morning"
                />
                <p className="text-xs text-surface-500 mt-1.5">Separate tags with commas.</p>
              </div>
            )}
            <UploadProgress progress={uploadProgress} status={uploadStatus} error={uploadError} />
            <div className="flex items-center gap-3">
              <button onClick={discard} className="btn-secondary flex-1" disabled={uploadStatus === 'uploading'}>
                {uploadStatus === 'success' ? 'Capture Again' : 'Discard'}
              </button>
              {uploadStatus !== 'success' && (
                <button onClick={handleUpload} className="btn-primary flex-1 py-3" disabled={uploadStatus === 'uploading'}>
                  {uploadStatus === 'uploading' ? (
                    <><svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Uploading…</>
                  ) : (
                    <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
                    {state === 'photo-review' ? 'Save Photo' : 'Upload Video'}</>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
