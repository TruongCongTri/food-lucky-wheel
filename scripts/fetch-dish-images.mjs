// Fill in real photos (Wikipedia / Wikimedia Commons) for dishes that have none.
// Usage: node scripts/fetch-dish-images.mjs [--force]
import { readFile, writeFile } from "node:fs/promises";
import { findDishImage } from "../lib/dishes/wikiImage.js";

const FILE = new URL("../data/dishes.json", import.meta.url);
const force = process.argv.includes("--force");
const dishes = JSON.parse(await readFile(FILE, "utf8"));

for (const d of dishes) {
  if (d.image && !force) continue;
  const others = dishes.filter((o) => o !== d).map((o) => o.image);
  const hit = await findDishImage(d.name.vi, d.name.en, others);
  d.image = hit?.url ?? null;
  d.imagePage = hit?.page ?? null;
  console.log(`${hit ? "✓" : "✗"} ${d.name.vi.padEnd(18)} ${hit?.page ?? "(no image)"}`);
  await new Promise((r) => setTimeout(r, 1500)); // be polite to the API
}

await writeFile(FILE, JSON.stringify(dishes, null, 2) + "\n", "utf8");
