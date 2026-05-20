import { useCallback, useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

type Props = {
  audioUrl: string;
  onDurationLoaded?: (seconds: number) => void;
  height?: number;
};

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const r = Math.floor(seconds % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M4 3.5v9l8-4.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x="4" y="3.5" width="3" height="9" fill="currentColor" />
      <rect x="9" y="3.5" width="3" height="9" fill="currentColor" />
    </svg>
  );
}

export function WaveformPlayer({ audioUrl, onDurationLoaded, height = 64 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const durationCbRef = useRef<typeof onDurationLoaded>(onDurationLoaded);
  durationCbRef.current = onDurationLoaded;

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setReady(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    const ws = WaveSurfer.create({
      container,
      url: audioUrl,
      height,
      waveColor: '#d4d4d4',
      progressColor: '#171717',
      cursorColor: '#171717',
      cursorWidth: 1,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
    });

    wsRef.current = ws;

    ws.on('ready', () => {
      const d = ws.getDuration();
      setReady(true);
      setDuration(d);
      if (durationCbRef.current) durationCbRef.current(d);
    });
    ws.on('audioprocess', (t: number) => setCurrentTime(t));
    ws.on('seeking', (t: number) => setCurrentTime(t));
    ws.on('play', () => setPlaying(true));
    ws.on('pause', () => setPlaying(false));
    ws.on('finish', () => setPlaying(false));

    return () => {
      wsRef.current = null;
      ws.destroy();
    };
  }, [audioUrl, height]);

  const toggle = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || !ready) return;
    ws.playPause();
  }, [ready]);

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="rounded-md bg-neutral-50 px-3 py-2" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={!ready}
          aria-label={playing ? 'Pause' : 'Play'}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            playing
              ? 'border-brand bg-brand text-white hover:bg-brand-dark'
              : 'border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50'
          }`}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <span className="font-mono text-xs text-neutral-600">
          {fmt(currentTime)} / {fmt(duration)}
        </span>
        {!ready && <span className="text-xs text-neutral-400">loading…</span>}
      </div>
    </div>
  );
}
