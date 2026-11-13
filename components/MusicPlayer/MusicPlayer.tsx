"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/Providers/I18nProvider";
import { useSound } from "@/components/Providers/SoundProvider";
import { useMusic, type MusicValue } from "@/components/Providers/AudioProvider";
import { onIntroDone } from "@/components/Intro/Intro";
import { NextIcon, PauseIcon, PlayIcon, PrevIcon, RepeatAllIcon, RepeatOneIcon } from "@/components/Icons/Icons";
import styles from "./MusicPlayer.module.css";

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return "--:--";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/**
 * Floating background-music player: a pill with the spinning cover (opens the
 * album drawer) and play/pause; on wide screens also the title and "next".
 * Shown only once the preload screen is gone, so its cover image doesn't
 * compete with the wheel's photos.
 */
export function MusicPlayer() {
  const music = useMusic();
  const [visible, setVisible] = useState(false);
  useEffect(() => onIntroDone(() => setVisible(true)), []);
  if (!music || !visible) return null;
  return <Player music={music} />;
}

function Player({ music }: { music: MusicValue }) {
  const { dict } = useI18n();
  const { sound } = useSound();
  const t = dict.music;
  const { album, track, isPlaying, isLoading, hasStarted, hasError, togglePlay, next } = music;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the drawer on outside tap / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const status = hasError ? t.error : isLoading ? t.loading : !hasStarted ? t.tapToStart : isPlaying ? t.playing : t.paused;

  return (
    <div ref={rootRef} className={styles.root} data-music data-open={open}>
      {open && <Drawer music={music} onClose={() => setOpen(false)} />}

      <div className={styles.pill} data-hint={!hasStarted && !hasError}>
        <button
          type="button"
          className={styles.disc}
          data-spin={isPlaying}
          onClick={() => {
            sound.click();
            setOpen((o) => !o);
          }}
          aria-expanded={open}
          aria-controls="music-drawer"
          aria-label={open ? t.close : t.open}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- remote R2 cover, no optimizer */}
          <img src={album.coverUrl} alt="" width={40} height={40} decoding="async" />
        </button>

        <span className={styles.meta} aria-hidden>
          <span className={styles.title}>{album.title}</span>
          <span className={styles.sub} data-error={hasError}>
            {status}
          </span>
        </span>

        <button
          type="button"
          className={styles.play}
          onClick={togglePlay}
          aria-label={isPlaying ? t.pause : t.play}
          aria-pressed={isPlaying}
          data-loading={isLoading}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button type="button" className={styles.next} onClick={next} aria-label={t.next}>
          <NextIcon />
        </button>
      </div>
      <span className="visually-hidden" aria-live="polite">
        {isPlaying ? `${t.playing}: ${track.title} — ${album.artist}` : ""}
      </span>
    </div>
  );
}

function Drawer({ music, onClose }: { music: MusicValue; onClose: () => void }) {
  const { dict } = useI18n();
  const t = dict.music;
  const { albums, album, albumIndex, trackIndex, isPlaying, loopAlbum, setLoopAlbum, togglePlay, next, prev, selectAlbum, getAudio } =
    music;
  const rangeRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const seeking = useRef(false);

  // Progress: written straight to the DOM on `timeupdate` (~4×/s) — no React renders.
  useEffect(() => {
    const audio = getAudio();
    if (!audio) return;
    const paint = () => {
      const d = audio.duration;
      if (rangeRef.current && !seeking.current) {
        rangeRef.current.max = String(Number.isFinite(d) ? Math.floor(d) : 0);
        rangeRef.current.value = String(Math.floor(audio.currentTime));
        rangeRef.current.style.setProperty("--p", Number.isFinite(d) && d > 0 ? String(audio.currentTime / d) : "0");
      }
      if (timeRef.current) timeRef.current.textContent = `${fmt(audio.currentTime)} / ${fmt(d)}`;
    };
    paint();
    audio.addEventListener("timeupdate", paint);
    audio.addEventListener("durationchange", paint);
    audio.addEventListener("emptied", paint);
    return () => {
      audio.removeEventListener("timeupdate", paint);
      audio.removeEventListener("durationchange", paint);
      audio.removeEventListener("emptied", paint);
    };
  }, [getAudio, albumIndex, trackIndex]);

  return (
    <div id="music-drawer" className={styles.drawer} role="region" aria-label={t.title}>
      <div className={styles.drawerHead}>
        <span className={styles.kicker}>
          <span className={styles.dot} /> {t.title}
        </span>
        <button type="button" className={styles.x} onClick={onClose} aria-label={t.close}>
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
            <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className={styles.now}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.cover} src={album.coverUrl} alt="" width={64} height={64} decoding="async" />
        <div className={styles.nowText}>
          <p className={styles.nowTitle}>{album.title}</p>
          <p className={styles.nowSub}>
            {album.artist}
            {album.year ? ` · ${album.year}` : ""}
          </p>
        </div>
      </div>

      <div className={styles.progress}>
        <input
          ref={rangeRef}
          className={styles.range}
          type="range"
          min={0}
          max={0}
          step={1}
          defaultValue={0}
          aria-label={t.seek}
          onPointerDown={() => (seeking.current = true)}
          onChange={(e) => {
            const v = Number(e.currentTarget.value);
            const audio = getAudio();
            e.currentTarget.style.setProperty("--p", audio?.duration ? String(v / audio.duration) : "0");
            if (timeRef.current && audio) timeRef.current.textContent = `${fmt(v)} / ${fmt(audio.duration)}`;
            if (!seeking.current && audio) audio.currentTime = v; // keyboard
          }}
          onPointerUp={(e) => {
            seeking.current = false;
            const audio = getAudio();
            if (audio) audio.currentTime = Number(e.currentTarget.value);
          }}
        />
        <span ref={timeRef} className={styles.time}>
          --:-- / --:--
        </span>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.ctrl}
          onClick={() => setLoopAlbum(!loopAlbum)}
          aria-pressed={loopAlbum}
          aria-label={loopAlbum ? t.loopOne : t.loopAll}
          title={loopAlbum ? t.loopOne : t.loopAll}
        >
          {loopAlbum ? <RepeatOneIcon /> : <RepeatAllIcon />}
        </button>
        <button type="button" className={styles.ctrl} onClick={prev} aria-label={t.prev}>
          <PrevIcon />
        </button>
        <button type="button" className={styles.bigPlay} onClick={togglePlay} aria-label={isPlaying ? t.pause : t.play}>
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" className={styles.ctrl} onClick={next} aria-label={t.next}>
          <NextIcon />
        </button>
        <span className={styles.loopLabel}>{loopAlbum ? t.loopOne : t.loopAll}</span>
      </div>

      <p className={styles.listHead}>{t.albums}</p>
      <ul className={styles.list}>
        {albums.map((al, i) => {
          const active = i === albumIndex;
          return (
            <li key={al.id}>
              <button
                type="button"
                className={styles.albumBtn}
                data-active={active}
                aria-current={active ? "true" : undefined}
                onClick={() => selectAlbum(i, 0)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={al.coverUrl} alt="" width={36} height={36} loading="lazy" decoding="async" />
                <span className={styles.albumText}>
                  <span className={styles.albumTitle}>{al.title}</span>
                  <span className={styles.albumYear}>{al.year ?? al.artist}</span>
                </span>
                {active && (
                  <span className={styles.eq} data-on={isPlaying} aria-hidden>
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </button>
              {active && al.tracks.length > 1 && (
                <ol className={styles.tracks}>
                  {al.tracks.map((tr, ti) => (
                    <li key={tr.id}>
                      <button
                        type="button"
                        className={styles.trackBtn}
                        data-active={ti === trackIndex}
                        onClick={() => selectAlbum(i, ti)}
                      >
                        {String(ti + 1).padStart(2, "0")}. {tr.title}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
