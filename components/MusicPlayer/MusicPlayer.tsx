"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/Providers/I18nProvider";
import { useSound } from "@/components/Providers/SoundProvider";
import { useMusic, type MusicValue } from "@/components/Providers/AudioProvider";
import { onIntroDone } from "@/components/Intro/Intro";
import { ListIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, RepeatAllIcon, RepeatOneIcon } from "@/components/Icons/Icons";
import styles from "./MusicPlayer.module.css";

/** Flags the list's hidden-content edges for the CSS fades (no React state per scroll). */
function markEdges(list: HTMLElement) {
  const above = list.scrollTop > 2;
  const below = list.scrollTop + list.clientHeight < list.scrollHeight - 2;
  if (list.dataset.moreAbove !== String(above)) list.dataset.moreAbove = String(above);
  if (list.dataset.moreBelow !== String(below)) list.dataset.moreBelow = String(below);
}

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

/** Mouse/trackpad: hovering the player peeks the song list. */
const HOVER = "(hover: hover) and (pointer: fine)";
const HOVER_CLOSE_MS = 280;

function Player({ music }: { music: MusicValue }) {
  const { dict } = useI18n();
  const { sound } = useSound();
  const t = dict.music;
  const { album, track, isPlaying, isLoading, hasStarted, hasError, togglePlay, next } = music;
  // Open = pinned by a click, or peeking while the mouse is over the player.
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  const open = pinned || hovering;
  // Keep the list mounted after closing until its exit animation finishes.
  const [rendered, setRendered] = useState(false);
  if (open && !rendered) setRendered(true); // derived state: mount as soon as it opens
  const rootRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const close = () => {
    setPinned(false);
    setHovering(false);
  };

  // Close the list on outside tap / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !window.matchMedia(HOVER).matches) return;
    window.clearTimeout(hoverTimer.current);
    setHovering(true);
  };
  const onLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHovering(false), HOVER_CLOSE_MS);
  };
  const toggleList = () => {
    sound.click();
    // Peeking on hover → a click keeps it open; open by click → a click closes.
    if (pinned) close();
    else setPinned(true);
  };

  const status = hasError ? t.error : isLoading ? t.loading : !hasStarted ? t.tapToStart : isPlaying ? t.playing : t.paused;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-music
      data-open={open}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      {rendered && (
        <Drawer
          music={music}
          onClose={close}
          closing={!open}
          onClosed={() => {
            if (!open) setRendered(false);
          }}
        />
      )}

      <div className={styles.pill} data-hint={!hasStarted && !hasError}>
        <button
          type="button"
          className={styles.disc}
          data-spin={isPlaying}
          onClick={toggleList}
          aria-expanded={open}
          aria-controls="music-drawer"
          aria-label={pinned ? t.close : t.open}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- remote R2 cover, no optimizer */}
          <img src={album.coverUrl} alt="" width={40} height={40} decoding="async" />
        </button>

        <span className={styles.meta} aria-hidden>
          <span className={styles.title}>{album.tracks.length > 1 ? track.title : album.title}</span>
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

        <button type="button" className={styles.next} onClick={next} aria-label={t.next} title={t.next}>
          <NextIcon />
        </button>

        <button
          type="button"
          className={styles.listBtn}
          onClick={toggleList}
          aria-expanded={open}
          aria-controls="music-drawer"
          aria-label={pinned ? t.hideList : t.showList}
          title={pinned ? t.hideList : t.showList}
          data-on={open}
        >
          <ListIcon />
        </button>
      </div>
      <span className="visually-hidden" aria-live="polite">
        {isPlaying ? `${t.playing}: ${track.title} — ${album.artist}` : ""}
      </span>
    </div>
  );
}

function Drawer({
  music,
  onClose,
  closing,
  onClosed,
}: {
  music: MusicValue;
  onClose: () => void;
  /** Playing the exit animation; unmounted by the parent when it ends. */
  closing: boolean;
  onClosed: () => void;
}) {
  const { dict } = useI18n();
  const t = dict.music;
  const { albums, album, albumIndex, trackIndex, isPlaying, loopAlbum, setLoopAlbum, togglePlay, next, prev, selectAlbum, getAudio } =
    music;
  // Every song across all albums, in play order.
  const songs = albums.flatMap((al, ai) => al.tracks.map((tr, ti) => ({ al, ai, tr, ti })));
  const listRef = useRef<HTMLOListElement>(null);
  // Bring the playing song into view when the list opens (scrolls only the
  // list), then show the edge fades where more songs are hidden.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const row = list.querySelector<HTMLElement>('[data-active="true"]');
    if (row) list.scrollTop = Math.max(0, row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2);
    markEdges(list);
  }, []);
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
    <div
      id="music-drawer"
      className={styles.drawer}
      role="region"
      aria-label={t.title}
      data-closing={closing}
      aria-hidden={closing || undefined}
      inert={closing || undefined}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && closing) onClosed();
      }}
    >
      {/* Fixed part: header, now playing, progress, controls */}
      <div className={styles.top}>
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

        <p className={styles.listHead}>
          {t.allSongs} <span className={styles.count}>{songs.length}</span>
        </p>
      </div>

      {/* Scrolling part: the songs (data-lenis-prevent: the wheel scrolls the list, not the page) */}
      <ol ref={listRef} className={styles.list} data-lenis-prevent onScroll={(e) => markEdges(e.currentTarget)}>
        {songs.map(({ al, ai, tr, ti }, n) => {
          const active = ai === albumIndex && ti === trackIndex;
          return (
            <li key={`${al.id}/${tr.id}`}>
              <button
                type="button"
                className={styles.songBtn}
                data-active={active}
                aria-current={active ? "true" : undefined}
                onClick={() => (active ? togglePlay() : selectAlbum(ai, ti))}
                aria-label={`${tr.title} — ${al.title}${active ? (isPlaying ? ` (${t.playing})` : ` (${t.paused})`) : ""}`}
              >
                <span className={styles.songN} aria-hidden>
                  {String(n + 1).padStart(2, "0")}
                </span>
                <span className={styles.thumb} aria-hidden>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={al.coverUrl} alt="" width={40} height={40} loading="lazy" decoding="async" />
                  <span className={styles.thumbIcon}>{active && isPlaying ? <PauseIcon /> : <PlayIcon />}</span>
                </span>
                <span className={styles.songText}>
                  <span className={styles.songTitle}>{tr.title}</span>
                  <span className={styles.songSub}>
                    {al.title}
                    {al.year ? ` · ${al.year}` : ""}
                  </span>
                </span>
                {active && (
                  <span className={styles.eq} data-on={isPlaying} aria-hidden>
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
