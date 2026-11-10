import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Dish, NewDishInput } from "./types";
import { findDishImage } from "./wikiImage.js";

/**
 * Tiny JSON-file repository. Swap this module for a real database
 * (Postgres, KV, Firestore…) when deploying to a read-only/serverless host.
 */
const FILE = path.join(process.cwd(), "data", "dishes.json");

let queue: Promise<unknown> = Promise.resolve();
/** Serialize writes so concurrent requests can't clobber each other. */
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function readAll(): Promise<Dish[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as Dish[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(dishes: Dish[]) {
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(dishes, null, 2) + "\n", "utf8");
  await fs.rename(tmp, FILE);
}

export async function listDishes(): Promise<Dish[]> {
  return readAll();
}

export async function listActiveDishes(): Promise<Dish[]> {
  return (await readAll()).filter((d) => d.active);
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
  const current = await readAll();
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

  return exclusive(async () => {
    const emoji = [...normalize(input.emoji ?? "")].slice(0, 4).join("") || "🍽️";
    const dishes = await readAll();
    const existing = dishes.find((d) => d.name.vi.toLowerCase() === vi.toLowerCase());
    if (existing) {
      if (existing.active) throw new DishError("duplicate");
      existing.active = true; // re-adding a hidden dish simply re-activates it
      if (image && (manual || !existing.image)) {
        existing.image = image;
        existing.imagePage = imagePage;
      }
      await writeAll(dishes);
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
    await writeAll(dishes);
    return dish;
  });
}

export function setDishActive(id: string, active: boolean): Promise<Dish> {
  return exclusive(async () => {
    const dishes = await readAll();
    const dish = dishes.find((d) => d.id === id);
    if (!dish) throw new DishError("not_found");
    dish.active = active;
    await writeAll(dishes);
    return dish;
  });
}
