"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Dish } from "@/lib/dishes/types";
import { dishImageSrc } from "@/lib/dishes/imageSrc";
import { fmt, useI18n } from "@/components/Providers/I18nProvider";
import { useSound } from "@/components/Providers/SoundProvider";
import styles from "./DishManager.module.css";

gsap.registerPlugin(useGSAP);

type Filter = "all" | "active" | "inactive";
const PIN_KEY = "lw:pin";
const EMOJIS = ["🍜", "🍲", "🥖", "🍚", "🥢", "🌶️", "🥬", "🦀", "🍤", "🐟", "🍗", "🥘", "🍢", "🥣", "🍙", "🫕"];

class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

export function DishManager() {
  const { locale, dict } = useI18n();
  const { sound } = useSound();
  const t = dict.manage;

  const rootRef = useRef<HTMLDivElement>(null);
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [nameVi, setNameVi] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [pinPrompt, setPinPrompt] = useState<null | ((pin: string) => void)>(null);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    fetch("/api/dishes", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { dishes: Dish[] }) => setDishes(d.dishes))
      .catch(() => setDishes([]));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  /** Fetch wrapper that asks for the admin PIN (once per session) on 401. */
  async function api<T>(url: string, init: RequestInit, retried = false): Promise<T> {
    let pin = "";
    try {
      pin = sessionStorage.getItem(PIN_KEY) ?? "";
    } catch {
      /* ignore */
    }
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(pin ? { "x-admin-pin": pin } : {}) },
    });
    if (res.status === 401 && !retried) {
      const entered = await new Promise<string>((resolve) => {
        setPinError(Boolean(pin));
        setPinValue("");
        setPinPrompt(() => resolve);
      });
      if (!entered) throw new ApiError("cancelled", 401);
      try {
        sessionStorage.setItem(PIN_KEY, entered);
      } catch {
        /* ignore */
      }
      return api<T>(url, init, true);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error ?? "error", res.status);
    return data as T;
  }

  const fail = (err: unknown) => {
    if (err instanceof ApiError && err.code === "cancelled") return;
    sound.error();
    const code = err instanceof ApiError ? err.code : "";
    const text =
      code === "invalid_name"
        ? t.errorName
        : code === "duplicate"
          ? t.errorDuplicate
          : code === "unauthorized"
            ? t.pinWrong
            : t.errorGeneric;
    if (code === "unauthorized") {
      try {
        sessionStorage.removeItem(PIN_KEY);
      } catch {
        /* ignore */
      }
    }
    setToast({ text, tone: "err" });
  };

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const vi = nameVi.trim();
    if (!vi || vi.length > 40) {
      sound.error();
      setToast({ text: t.errorName, tone: "err" });
      return;
    }
    setBusy(true);
    try {
      const { dish } = await api<{ dish: Dish }>("/api/dishes", {
        method: "POST",
        body: JSON.stringify({ nameVi: vi, nameEn: nameEn.trim(), emoji, imageUrl: imageUrl.trim() }),
      });
      setDishes((prev) => {
        const list = prev ?? [];
        return list.some((d) => d.id === dish.id)
          ? list.map((d) => (d.id === dish.id ? dish : d))
          : [...list, dish];
      });
      setNameVi("");
      setNameEn("");
      setImageUrl("");
      setFilter((f) => (f === "inactive" ? "all" : f));
      sound.success();
      setToast({ text: fmt(t.added, { name: dish.name[locale] }), tone: "ok" });
      requestAnimationFrame(() => {
        const row = rootRef.current?.querySelector(`[data-id="${CSS.escape(dish.id)}"]`);
        if (row) gsap.fromTo(row, { backgroundColor: "#f2c14e" }, { backgroundColor: "rgba(242,193,78,0)", duration: 1.6 });
      });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(dish: Dish) {
    const next = !dish.active;
    setPending(dish.id);
    // optimistic
    setDishes((prev) => prev?.map((d) => (d.id === dish.id ? { ...d, active: next } : d)) ?? prev);
    sound.toggle(next);
    try {
      await api(`/api/dishes/${encodeURIComponent(dish.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ active: next }),
      });
    } catch (err) {
      setDishes((prev) => prev?.map((d) => (d.id === dish.id ? { ...d, active: !next } : d)) ?? prev);
      fail(err);
    } finally {
      setPending(null);
    }
  }

  const activeCount = dishes?.filter((d) => d.active).length ?? 0;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (dishes ?? [])
      .filter((d) => (filter === "all" ? true : filter === "active" ? d.active : !d.active))
      .filter((d) => !q || d.name.vi.toLowerCase().includes(q) || d.name.en.toLowerCase().includes(q))
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name[locale].localeCompare(b.name[locale], locale));
  }, [dishes, filter, query, locale]);

  useGSAP(
    () => {
      if (!dishes) return;
      gsap.from("[data-row]", {
        y: 14,
        opacity: 0,
        stagger: 0.025,
        duration: 0.4,
        ease: "power2.out",
        clearProps: "opacity,transform", // hand control back to CSS (inactive rows are dimmed)
      });
    },
    { scope: rootRef, dependencies: [dishes === null, filter] },
  );

  return (
    <div ref={rootRef} className={styles.manager}>
      {/* Add form */}
      <form className={styles.card} onSubmit={onAdd}>
        <h2 className={styles.cardTitle}>
          <span className={styles.cardIndex}>+</span> {t.addTitle}
        </h2>

        <fieldset className={styles.emojiField}>
          <legend>{t.emoji}</legend>
          <div className={styles.emojiRow} data-lenis-prevent>
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                className={styles.emojiOpt}
                data-selected={e === emoji}
                aria-pressed={e === emoji}
                onClick={() => {
                  sound.click();
                  setEmoji(e);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </fieldset>

        <label className={styles.field}>
          <span>{t.nameVi} *</span>
          <input
            value={nameVi}
            onChange={(e) => setNameVi(e.target.value)}
            placeholder={t.nameViPlaceholder}
            maxLength={40}
            required
            enterKeyHint="next"
            autoComplete="off"
          />
        </label>
        <label className={styles.field}>
          <span>{t.nameEn}</span>
          <input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder={t.nameEnPlaceholder}
            maxLength={40}
            enterKeyHint="done"
            autoComplete="off"
          />
        </label>
        <label className={styles.field}>
          <span>{t.imageUrl}</span>
          <input
            type="url"
            inputMode="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder={t.imageUrlPlaceholder}
            className={styles.urlInput}
            autoComplete="off"
          />
        </label>
        <button type="submit" className={styles.addBtn} disabled={busy}>
          {busy ? t.adding : t.add}
          <span className={styles.addIcon} aria-hidden>
            {emoji}
          </span>
        </button>
      </form>

      {/* List */}
      <section className={styles.listSection}>
        <div className={styles.toolbar}>
          <p className={styles.count}>{fmt(t.activeCount, { count: activeCount })}</p>
          <input
            type="search"
            className={styles.search}
            placeholder={t.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t.search}
          />
          <div className={styles.tabs} role="tablist">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                className={styles.tab}
                data-active={filter === f}
                onClick={() => {
                  sound.click();
                  setFilter(f);
                }}
              >
                {t[f]}
                <span className={styles.tabCount}>
                  {f === "all" ? (dishes?.length ?? 0) : f === "active" ? activeCount : (dishes?.length ?? 0) - activeCount}
                </span>
              </button>
            ))}
          </div>
        </div>

        {dishes === null ? (
          <p className={styles.empty}>{t.loading}</p>
        ) : visible.length === 0 ? (
          <p className={styles.empty}>{t.empty}</p>
        ) : (
          <ul className={styles.list}>
            {visible.map((d, i) => (
              <li key={d.id} className={styles.row} data-row data-id={d.id} data-active={d.active}>
                <span className={styles.rowIndex}>{String(i + 1).padStart(2, "0")}</span>
                <span className={styles.rowEmoji} aria-hidden>
                  {d.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={dishImageSrc(d.image, 120)} alt="" loading="lazy" decoding="async" />
                  ) : (
                    d.emoji
                  )}
                </span>
                <div className={styles.rowText}>
                  <strong>{d.name[locale]}</strong>
                  <span>
                    {d.name[locale === "vi" ? "en" : "vi"]} · {d.active ? t.statusOn : t.statusOff}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={d.active}
                  aria-label={`${d.active ? t.deactivate : t.activate}: ${d.name[locale]}`}
                  className={styles.switch}
                  data-on={d.active}
                  disabled={pending === d.id}
                  onClick={() => onToggle(d)}
                >
                  <span className={styles.switchText}>{d.active ? t.on : t.off}</span>
                  <span className={styles.knob} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {toast && (
        <div className={styles.toast} data-tone={toast.tone} role="status">
          {toast.text}
        </div>
      )}

      {pinPrompt && (
        <div className={styles.pinBackdrop}>
          <form
            className={styles.pinCard}
            onSubmit={(e) => {
              e.preventDefault();
              pinPrompt(pinValue);
              setPinPrompt(null);
            }}
          >
            <h3>{t.pinTitle}</h3>
            {pinError && <p className={styles.pinError}>{t.pinWrong}</p>}
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value)}
              placeholder={t.pinPlaceholder}
              className={styles.pinInput}
            />
            <div className={styles.pinActions}>
              <button
                type="button"
                className={styles.pinCancel}
                onClick={() => {
                  pinPrompt("");
                  setPinPrompt(null);
                }}
              >
                {dict.result.close}
              </button>
              <button type="submit" className={styles.addBtn}>
                {t.pinSubmit}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
