import "server-only";
import { randomUUID } from "node:crypto";
import type { Dish, NewDishInput } from "./types";
import { findDishImage } from "./wikiImage.js";
import { ConflictError, getStorage, ReadOnlyStorageError } from "./storage";

/**
 * Dish repository on top of lib/dishes/storage.ts (Cloudflare R2 in
 * production, data/dishes.json locally).
 */

let queue: Promise<unknown> = Promise.resolve();
/** Serialize writes within this server instance. */
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Short per-instance cache for the home page's reads, so a page render doesn't
 * wait on storage every time. Cleared on every write from this instance; other
 * instances catch up within CACHE_MS. The management list always reads fresh.
 */
const CACHE_MS = 5000;
let cache: { at: number; dishes: Dish[] } | null = null;

async function readAll(fresh = false): Promise<Dish[]> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.dishes;
  const { dishes } = await getStorage().read();
  cache = { at: Date.now(), dishes };
  return dishes;
}

/**
 * Read → change → write, retried if someone else saved in between (the write
 * is conditional on the version that was read).
 */
async function mutate<T>(change: (dishes: Dish[]) => T): Promise<T> {
  return exclusive(async () => {
    const storage = getStorage();
    for (let attempt = 0; ; attempt++) {
      const { dishes, version } = await storage.read();
      const result = change(dishes); // may throw DishError
      try {
        await storage.write(dishes, version);
        cache = { at: Date.now(), dishes };
        return result;
      } catch (err) {
        if (err instanceof ConflictError && attempt < 3) continue;
        throw err;
      }
    }
  });
}

export async function listDishes(): Promise<Dish[]> {
  return readAll(true);
}

export async function listActiveDishes(): Promise<Dish[]> {
  return (await readAll()).filter((d) => d.active);
}

/** API response for a failed save: a clear code instead of a bare 500. */
export function storageFailure(err: unknown): Response {
  if (err instanceof ReadOnlyStorageError) {
    return Response.json({ error: "storage_readonly" }, { status: 503 });
  }
  console.error("[dishes] save failed:", err);
  return Response.json({ error: "storage_error" }, { status: 500 });
}

export class DishError extends Error {
  constructor(public code: "invalid_name" | "duplicate" | "not_found") {
    super(code);
  }
}

const normalize = (s: string) =>
  s.normalize("NFC").trim().replace(/\s+/g, " ");

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "dish";

/** Accept only absolute https image URLs for manual overrides. */
function cleanImageUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && raw.length <= 1000 ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Look up a photo, but never let a slow/limited API hold up adding a dish. */
async function lookupImage(vi: string, en: string, avoid: (string | null | undefined)[]) {
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 8000));
  return Promise.race([findDishImage(vi, en, avoid).catch(() => null), timeout]);
}

export async function createDish(input: NewDishInput): Promise<Dish> {
  const vi = normalize(input.nameVi ?? "");
  const en = normalize(input.nameEn ?? "") || vi;
  if (!vi || vi.length > 40 || en.length > 40) throw new DishError("invalid_name");

  // Fail fast on duplicates before spending time on the image lookup.
  const current = await readAll(true);
  if (current.some((d) => d.active && d.name.vi.toLowerCase() === vi.toLowerCase())) {
    throw new DishError("duplicate");
  }

  // Resolve the photo outside the write lock (network call).
  const manual = cleanImageUrl(input.imageUrl);
  // Avoid photos other dishes already use (variants share general articles).
  const others = current.filter((d) => d.name.vi.toLowerCase() !== vi.toLowerCase()).map((d) => d.image);
  const found = manual ? null : await lookupImage(vi, en, others);
  const image = manual ?? found?.url ?? null;
  const imagePage = manual ? null : (found?.page ?? null);

  const emoji = [...normalize(input.emoji ?? "")].slice(0, 4).join("") || "🍽️";
  return mutate((dishes) => {
    const existing = dishes.find((d) => d.name.vi.toLowerCase() === vi.toLowerCase());
    if (existing) {
      if (existing.active) throw new DishError("duplicate");
      existing.active = true; // re-adding a hidden dish simply re-activates it
      if (image && (manual || !existing.image)) {
        existing.image = image;
        existing.imagePage = imagePage;
      }
      return existing;
    }

    const dish: Dish = {
      id: `${slugify(vi)}-${randomUUID().slice(0, 6)}`,
      name: { vi, en },
      emoji,
      searchKeyword: vi,
      image,
      imagePage,
      active: true,
      createdAt: new Date().toISOString(),
    };
    dishes.push(dish);
    return dish;
  });
}

export function setDishActive(id: string, active: boolean): Promise<Dish> {
  return mutate((dishes) => {
    const dish = dishes.find((d) => d.id === id);
    if (!dish) throw new DishError("not_found");
    dish.active = active;
    return dish;
  });
}
