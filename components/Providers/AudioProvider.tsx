"use client";

/**
 * Background music: one persistent <audio> element streaming the albums in
 * lib/discography.ts from Cloudflare R2, playing the whole collection on a loop
 * (or repeating one album). See docs/audio-play.md for the reasoning.
 *
 *  - Streaming, not decoding: an HTMLAudioElement fetches 206 byte ranges, so a
 *    60 MB album never sits in memory (decodeAudioData would use ~70 MB of RAM).
 *  - No `crossOrigin`: the R2 bucket sends no CORS headers, and a CORS-mode
 *    request would make every track fail. We never read the samples, so a
 *    plain (no-cors) media request is all we need.
 *  - Doesn't compete with the preload screen: only metadata loads while it's
 *    up; buffering starts when it lifts.
 *  - Autoplay rules: a tap during the preload screen unlocks the element
 *    silently (muted play → pause), so music can fade in the moment the app
 *    appears. Without that tap, music starts with a fade on the first tap
 *    anywhere afterwards (the player button pulses until then).
 *  - Follows the header sound switch, keeps playing in a background tab on
 *    desktop but pauses while the app is in the background on phones, and
 *    never auto-starts with Data Saver on or after the person paused it.
 *  - Remembers the album / repeat mode only with "Preferences" consent.
 *  - iOS: audioSession "playback" while music plays (plays through the silent
 *    switch, like a music app), back to "auto" when paused. iOS ignores
 *    `audio.volume`, so fades are instant there.
 */

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DISCOGRAPHY, HAS_MUSIC, type Album, type Track } from "@/lib/discography";
import { hasPreferenceConsent, onConsentChange } from "@/lib/consent";
import { introActive, onIntroDone } from "@/components/Intro/Intro";
import { useSound } from "./SoundProvider";

const STORAGE_KEY = "lw:music";

/**
 * Albums in release order (oldest first): for the list and for next/previous.
 * Sorted here so new albums can be added to lib/discography.ts in any order.
 * Albums without a year go last; equal years keep their original order.
 */
const ALBUMS: Album[] = [...DISCOGRAPHY].sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity));

/** Save the position at most this often while playing (plus on pause / leaving). */
const SAVE_EVERY_MS = 5000;
/** A saved position this close to the end restarts the file instead. */
const RESUME_END_MARGIN = 10;
const TARGET_VOLUME = 0.6; // under the UI sound effects
const FADE_IN_MS = 2000;
const FADE_OUT_MS = 500;
/** Start fetching the next file's header this close to the end (seconds). */
const PRELOAD_BEFORE_END = 90;
/** Desktop = mouse/trackpad is the primary pointer (music keeps playing in background tabs). */
const DESKTOP_POINTER = "(hover: hover) and (pointer: fine)";
/** Taps on these never auto-start music (they control sound themselves). */
const NO_AUTOSTART = "[data-music], [data-sound-toggle]";

type Pos = readonly [album: number, track: number];

export type MusicValue = {
  albums: Album[];
  album: Album;
  track: Track;
  albumIndex: number;
  trackIndex: number;
  /** Something is audible right now. */
  isPlaying: boolean;
  /** Loading/buffering the current file while it should be playing. */
  isLoading: boolean;
  /** Music has played at least once this visit (the button stops pulsing). */
  hasStarted: boolean;
  /** Every file failed to load (offline, bad URL, …). */
  hasError: boolean;
  loopAlbum: boolean;
  setLoopAlbum: (loop: boolean) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  selectAlbum: (albumIndex: number, trackIndex?: number) => void;
  /** The element itself, for progress/seek UI (read-only use). */
  getAudio: () => HTMLAudioElement | null;
};

const MusicContext = createContext<MusicValue | null>(null);

/**
 * Remembered between visits (only with "Preferences" consent):
 * album + track ids (stable even if the list order changes), the second
 * reached, repeat mode, and when it was saved.
 */
type Saved = { album?: string; track?: string; t?: number; loop?: boolean; at?: string };

function readSaved(): Saved {
  if (!hasPreferenceConsent()) return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Saved;
  } catch {
    return {};
  }
}

function save([albumIdx, trackIdx]: Pos, loop: boolean, seconds: number) {
  if (!hasPreferenceConsent()) return;
  const album = ALBUMS[albumIdx];
  const rec: Saved = {
    album: album?.id,
    track: album?.tracks[trackIdx]?.id,
    t: Math.max(0, Math.floor(seconds)), // to the second
    loop,
    at: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
  } catch {
    /* storage unavailable */
  }
}

function setAudioSession(type: "playback" | "auto") {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  try {
    if (nav.audioSession) nav.audioSession.type = type;
  } catch {
    /* unsupported */
  }
}

const saveData = () =>
  Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

function nextPos([a, t]: Pos, loopAlbum: boolean): Pos {
  if (t + 1 < ALBUMS[a].tracks.length) return [a, t + 1];
  if (loopAlbum) return [a, 0];
  return [(a + 1) % ALBUMS.length, 0];
}

function prevPos([a, t]: Pos, loopAlbum: boolean): Pos {
  if (t > 0) return [a, t - 1];
  const pa = loopAlbum ? a : (a - 1 + ALBUMS.length) % ALBUMS.length;
  return [pa, ALBUMS[pa].tracks.length - 1];
}

export function AudioProvider({ children }: { children: ReactNode }) {
  if (!HAS_MUSIC || ALBUMS.length === 0) return children;
  return <MusicEngine>{children}</MusicEngine>;
}

function MusicEngine({ children }: { children: ReactNode }) {
  const { enabled: soundOn } = useSound();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const [pos, setPos] = useState<Pos>([0, 0]);
  const posRef = useRef<Pos>([0, 0]);
  const [loopAlbum, setLoopAlbumState] = useState(false);
  const loopRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Intent flags (refs: read inside event handlers).
  const unlocked = useRef(false); // the element has been played from a gesture
  const introDone = useRef(false);
  const userPaused = useRef(false); // the person paused: never auto-start again
  const pausedBy = useRef<"hidden" | "sound" | null>(null);
  const soundOnRef = useRef(soundOn);
  const failures = useRef(0);
  const preloadedFor = useRef<string | null>(null);
  /** Second to seek to once the restored file's metadata is in (null = none pending). */
  const resumeAt = useRef<number | null>(null);
  const lastSave = useRef(0);

  /** Remember album, track and the current second (no-op without consent). */
  const persist = useCallback(() => {
    if (resumeAt.current !== null) return; // restored position not applied yet: keep it
    lastSave.current = Date.now();
    save(posRef.current, loopRef.current, audioRef.current?.currentTime ?? 0);
  }, []);

  // --- Volume fades -----------------------------------------------------------
  const fadeTo = useCallback((to: number, ms: number, done?: () => void) => {
    const audio = audioRef.current;
    clearInterval(fadeRef.current);
    if (!audio) return;
    const from = audio.volume;
    const steps = Math.max(1, Math.round(ms / 40));
    let i = 0;
    fadeRef.current = setInterval(() => {
      i++;
      const v = from + ((to - from) * i) / steps;
      audio.volume = Math.min(1, Math.max(0, v));
      if (i >= steps) {
        clearInterval(fadeRef.current);
        done?.();
      }
    }, 40);
  }, []);

  /** Play the current source, fading in. Resolves false if the browser blocked it. */
  const play = useCallback(
    async (fadeMs = FADE_IN_MS) => {
      const audio = audioRef.current;
      if (!audio) return false;
      clearInterval(fadeRef.current);
      audio.muted = false;
      audio.volume = 0;
      audio.preload = "auto";
      setAudioSession("playback");
      try {
        await audio.play();
      } catch {
        setAudioSession("auto");
        return false; // NotAllowedError (no gesture yet) or AbortError (source changed)
      }
      unlocked.current = true;
      pausedBy.current = null;
      setHasStarted(true);
      fadeTo(TARGET_VOLUME, fadeMs);
      return true;
    },
    [fadeTo],
  );

  const pause = useCallback(
    (why: "user" | "hidden" | "sound", fadeMs = FADE_OUT_MS) => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;
      if (why === "user") userPaused.current = true;
      else pausedBy.current = why;
      const stop = () => {
        audio.pause();
        setAudioSession("auto");
      };
      if (fadeMs > 0) fadeTo(0, fadeMs, stop);
      else {
        clearInterval(fadeRef.current);
        stop();
      }
    },
    [fadeTo],
  );

  /** May music start on its own right now? */
  const mayAutoStart = () =>
    introDone.current && soundOnRef.current && !userPaused.current && !saveData() && !document.hidden;

  // --- Switch file --------------------------------------------------------------
  const load = useCallback(
    (p: Pos, autoplay: boolean) => {
      const audio = audioRef.current;
      const track = ALBUMS[p[0]]?.tracks[p[1]];
      if (!audio || !track) return;
      posRef.current = p;
      setPos(p);
      resumeAt.current = null;
      save(p, loopRef.current, 0); // a new file starts from the top
      lastSave.current = Date.now();
      preloadedFor.current = null;
      audio.src = track.url;
      audio.load();
      updateMediaSession(ALBUMS[p[0]], track);
      if (autoplay) void play(600);
    },
    [play],
  );

  // --- Create the element once ------------------------------------------------
  useEffect(() => {
    const saved = readSaved();
    let a = ALBUMS.findIndex((al) => al.id === saved.album);
    let tr = a < 0 ? -1 : ALBUMS[a].tracks.findIndex((x) => x.id === saved.track);
    if (a >= 0 && tr >= 0 && saved.t && saved.t > 0) resumeAt.current = saved.t; // pick up where they stopped
    if (tr < 0) tr = 0;
    // No remembered album: start somewhere different each visit.
    if (a < 0) a = Math.floor(Math.random() * ALBUMS.length);
    loopRef.current = Boolean(saved.loop);
    posRef.current = [a, tr];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore from storage / random pick
    setPos([a, tr]);
    setLoopAlbumState(loopRef.current);

    const audio = new Audio();
    audio.preload = introActive() ? "metadata" : "auto"; // don't compete with the preload screen
    audio.src = ALBUMS[a].tracks[tr].url;
    audioRef.current = audio;
    updateMediaSession(ALBUMS[a], ALBUMS[a].tracks[tr]);

    // Seek to the remembered second as soon as the file's length is known
    // (only the header is fetched for that; playback then streams from there).
    const onMeta = () => {
      const at = resumeAt.current;
      if (at === null) return;
      resumeAt.current = null;
      if (Number.isFinite(audio.duration) && at < audio.duration - RESUME_END_MARGIN) audio.currentTime = at;
    };
    audio.addEventListener("loadedmetadata", onMeta);
    // A jump with the seek bar is saved right away, not at the next 5 s tick.
    const onSeeked = () => persist();
    audio.addEventListener("seeked", onSeeked);

    const onPlaying = () => {
      failures.current = 0;
      setHasError(false);
      setIsPlaying(true);
      setIsLoading(false);
    };
    const onPause = () => {
      setIsPlaying(false);
      setIsLoading(false);
      persist();
    };
    const onWaiting = () => setIsLoading(true);
    const onEnded = () => load(nextPos(posRef.current, loopRef.current), true);
    const onError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      failures.current++;
      // Skip a broken file, but stop once every file has failed (offline).
      if (failures.current >= ALBUMS.reduce((n, al) => n + al.tracks.length, 0)) {
        setHasError(true);
        setAudioSession("auto");
        return;
      }
      if (unlocked.current && !userPaused.current) {
        setTimeout(() => load(nextPos(posRef.current, loopRef.current), true), 1200);
      }
    };
    // Fetch the next file's header shortly before this one ends (not the whole
    // file: albums are ~60 MB each).
    const onTime = () => {
      if (!audio.paused && Date.now() - lastSave.current > SAVE_EVERY_MS) persist();
      if (!audio.duration || audio.duration - audio.currentTime > PRELOAD_BEFORE_END) return;
      const [na, nt] = nextPos(posRef.current, loopRef.current);
      const url = ALBUMS[na].tracks[nt].url;
      if (preloadedFor.current === url || url === audio.currentSrc) return;
      preloadedFor.current = url;
      const pre = (preloadRef.current ??= new Audio());
      pre.preload = "metadata";
      pre.src = url;
    };
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("timeupdate", onTime);

    // Unlock / start on a real tap (programmatic timers are not user gestures).
    const onGesture = (e: PointerEvent) => {
      if (unlocked.current || !e.isTrusted) return;
      if ((e.target as Element | null)?.closest?.(NO_AUTOSTART)) return;
      if (introDone.current) {
        if (mayAutoStart()) void play();
        return;
      }
      // Still on the preload screen: silent unlock, so music can start the
      // moment it lifts (muted, not volume 0 — iOS ignores volume).
      audio.muted = true;
      const startedAt = audio.currentTime;
      audio
        .play()
        .then(() => {
          // Paused before the curtain lifted → hold until it does.
          if (!introDone.current) {
            audio.pause();
            // Back to where it was (the restored second, if one is still pending).
            audio.currentTime = resumeAt.current ?? startedAt;
          }
          unlocked.current = true;
          audio.muted = false;
          if (introDone.current && mayAutoStart()) void play();
        })
        .catch(() => {
          audio.muted = false;
        });
    };
    window.addEventListener("pointerdown", onGesture, { capture: true, passive: true });

    const cancelIntro = onIntroDone(() => {
      introDone.current = true;
      audio.preload = "auto";
      // A tap before our listener existed (page still loading) still counts in
      // Chrome/Android ("sticky" user activation), so try then too. Safari
      // rejects it and the next tap starts the music instead.
      const activated = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
        ?.hasBeenActive;
      if ((unlocked.current || activated) && mayAutoStart()) void play();
    });

    // Phones/tablets: pause while the app is in the background (switching
    // apps shouldn't leave music playing), resume on return. Desktop (mouse /
    // trackpad as the main pointer): keep playing in a background tab or
    // behind other windows, like a music player.
    const onVisibility = () => {
      if (document.hidden) {
        persist(); // phones may discard a background tab without another event
        if (!window.matchMedia(DESKTOP_POINTER).matches) pause("hidden", 0);
      } else if (pausedBy.current === "hidden" && soundOnRef.current) {
        void play(800);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    // Closing / reloading / navigating away: save the exact second.
    const onLeave = () => persist();
    window.addEventListener("pagehide", onLeave);

    // Consent withdrawn → forget; given → remember the current choice.
    const offConsent = onConsentChange((rec) => {
      if (rec.preferences) persist();
    });

    return () => {
      clearInterval(fadeRef.current);
      cancelIntro();
      offConsent();
      window.removeEventListener("pointerdown", onGesture, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("seeked", onSeeked);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("timeupdate", onTime);
      audio.pause();
      audio.removeAttribute("src");
      audio.load(); // abort the download
      preloadRef.current?.removeAttribute("src");
      audioRef.current = null;
      setAudioSession("auto");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create once
  }, []);

  // --- Header sound switch ------------------------------------------------------
  useEffect(() => {
    soundOnRef.current = soundOn;
    if (!soundOn) pause("sound");
    else if (pausedBy.current === "sound") void play(800);
  }, [soundOn, pause, play]);

  // --- Public actions -------------------------------------------------------------
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      pause("user");
      return;
    }
    userPaused.current = false;
    if (hasError) {
      failures.current = 0;
      setHasError(false);
      load(posRef.current, true);
      return;
    }
    void play(800);
  }, [hasError, load, pause, play]);

  const next = useCallback(() => {
    userPaused.current = false;
    load(nextPos(posRef.current, loopRef.current), true);
  }, [load]);

  const prev = useCallback(() => {
    userPaused.current = false;
    const audio = audioRef.current;
    // Like music apps: "previous" restarts the current file if past 5 s.
    if (audio && audio.currentTime > 5) {
      audio.currentTime = 0;
      if (audio.paused) void play(600);
      return;
    }
    load(prevPos(posRef.current, loopRef.current), true);
  }, [load, play]);

  const selectAlbum = useCallback(
    (albumIndex: number, trackIndex = 0) => {
      userPaused.current = false;
      const [a, t] = posRef.current;
      if (a === albumIndex && t === trackIndex && audioRef.current && !audioRef.current.paused) return;
      load([albumIndex, trackIndex], true);
    },
    [load],
  );

  const setLoopAlbum = useCallback((loop: boolean) => {
    loopRef.current = loop;
    setLoopAlbumState(loop);
    preloadedFor.current = null;
    save(posRef.current, loop, audioRef.current?.currentTime ?? 0);
  }, []);

  // Lock screen / notification controls.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (action: MediaSessionAction, h: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, h);
      } catch {
        /* unsupported action */
      }
    };
    set("play", () => {
      userPaused.current = false;
      void play(400);
    });
    set("pause", () => pause("user", 0));
    set("nexttrack", next);
    set("previoustrack", prev);
    return () => {
      for (const a of ["play", "pause", "nexttrack", "previoustrack"] as const) set(a, null);
    };
  }, [next, prev, pause, play]);

  const [albumIndex, trackIndex] = pos;
  const album = ALBUMS[albumIndex] ?? ALBUMS[0];
  const track = album.tracks[trackIndex] ?? album.tracks[0];
  const getAudio = useCallback(() => audioRef.current, []);

  const value = useMemo<MusicValue>(
    () => ({
      albums: ALBUMS,
      album,
      track,
      albumIndex,
      trackIndex,
      isPlaying,
      isLoading,
      hasStarted,
      hasError,
      loopAlbum,
      setLoopAlbum,
      togglePlay,
      next,
      prev,
      selectAlbum,
      getAudio,
    }),
    [album, track, albumIndex, trackIndex, isPlaying, isLoading, hasStarted, hasError, loopAlbum, setLoopAlbum, togglePlay, next, prev, selectAlbum, getAudio],
  );

  return <MusicContext value={value}>{children}</MusicContext>;
}

function updateMediaSession(album: Album, track: Track) {
  if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: album.artist,
    album: album.title,
    artwork: [{ src: album.coverUrl, sizes: "512x512", type: "image/webp" }],
  });
}

/** Null when music isn't configured (no R2 URL). */
export function useMusic() {
  return use(MusicContext);
}
