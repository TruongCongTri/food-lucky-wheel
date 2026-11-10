# Hôm nay ăn gì? — Vietnamese food lucky wheel

Mobile-first Next.js 16 app: spin a 3D wheel (three.js + GSAP) to pick a Vietnamese dish, then see famous, highly rated places nearby from Google Maps, with one-tap directions.

## Stack

- **Next.js 16** (App Router, Cache Components, `proxy.ts` for locale routing)
- **three.js**: wheel scene, rendered only on demand to save battery, with a 2D canvas fallback if WebGL is unavailable
- **GSAP + @gsap/react**: spin physics, pointer wobble, sheet transitions, confetti
- **Lenis**: smooth scrolling driven by the GSAP ticker (native touch scrolling kept on mobile)
- **Web Audio API**: synthesized sounds (tick, whoosh, win, click, toggle). No audio files to download.
- **i18n**: `app/[locale]` with `i18n/messages/vi.json` and `en.json`
- **CSS**: `app/global.css` (tokens and reset) plus a `*.module.css` file for each component

## Design

The look is an editorial street-menu poster, drawing on current Awwwards winners: a restrained palette, layouts led by large type, and storytelling through motion.

- **Palette** (tokens in `app/global.css`): paper `#f3ede3`, ink `#1a1414` and chili `#e4411f`, with maroon `#6e1f2a` and turmeric `#f2c14e` as supporting colours. A static SVG grain layer sits on top.
- **Type:** Bricolage Grotesque in heavy condensed widths for headings and body text, Fraunces italic for accent words, and JetBrains Mono for small index labels. All three include the Vietnamese subset.
- **Motion:**
  - A CSS intro curtain, shown once per session.
  - GSAP SplitText reveals for the hero and result titles.
  - A marquee whose speed and direction follow Lenis scroll velocity.
  - ScrollTrigger reveals on the steps and footer.
  - A circular clip-path wipe that opens the result screen from the wheel's centre.
- **Mobile:** a floating bottom dock within thumb reach, tap targets of at least 44px, safe-area padding, and on-demand WebGL rendering.

## Setup

```bash
cp .env.example .env.local   # add GOOGLE_MAPS_API_KEY (Places API (New) enabled)
npm install
npm run dev                  # http://localhost:3000 → redirects to /vi or /en
```

| Env var               | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `GOOGLE_MAPS_API_KEY` | Server-side only. Used for Places Text Search and photos. Without it, the app links to a Google Maps search instead. |
| `ADMIN_PIN`           | Optional. When set, adding or switching dishes on/off asks for this PIN. |

## How it works

1. **Spin**: tap **QUAY/SPIN** or swipe the wheel sideways. The winner is chosen with `crypto.getRandomValues`, and the wheel is animated to land on it.
2. **Location**: the browser asks for location as soon as the spin starts, so it is usually ready by the time the wheel stops.
3. **Places**: `GET /api/places` calls Places API (New) `searchText`, keeps places rated 4.0 or higher with at least 20 reviews, and ranks them by rating, review count and distance.
4. **Directions**: opens `google.com/maps/dir/?api=1&origin=<your lat,lng>&destination=<place>&destination_place_id=<id>`. On phones this opens the Google Maps app.

## Home layout

The pointer sits at **160°**, measured counter-clockwise from 3 o'clock (`POINTER_DEG` in `components/LuckyWheel/wheelScene.ts`). Slice labels and photos are drawn so they read upright when a slice stops at the pointer. You don't need to see the whole wheel, only the slices passing the pointer, so the wheel is intentionally cropped.

- **Desktop** (at least 900px wide and landscape): the wheel's diameter is about 1.45× the screen height, with its left edge at one third of the width. It runs off the top, bottom and right of the screen, and its size is capped so the spin button stays visible. The readout on the left shows a headline, then a live photo and name while spinning, then the result with "Find places" and "Spin again".
- **Phone** (and portrait tablets): "Hôm nay ăn gì đây?" sits on top (`components/StageHeadline`), with a wheel 1.5× the screen width underneath that runs off the right edge (and the bottom, on short screens). The result opens in a popup (`components/ResultPopup`).
- **Both:** "Find places" opens the full-screen list of nearby places.

## Spinning by hand

Besides the SPIN button, you can grab the wheel (`components/LuckyWheel/LuckyWheel.tsx`) and turn it:

- **Pull back and release:** drag it counter-clockwise by about 20 degrees or more and let go, and it slingshots into a spin.
- **Flick:** throw it in either direction, and a harder flick adds turns.
- **Small, slow drag:** the wheel just stays where you leave it.
- **Phones:** moving along the rim rotates the wheel, while swiping toward or away from the centre still scrolls the page.

## Legal pages and location consent (Vietnam)

`/[locale]/guide`, `/[locale]/privacy` and `/[locale]/terms` are linked from the footer on every page. Their copy lives in `content/legal/{vi,en}.json` and is loaded only on those pages.

- **Applicable law:** Law on Personal Data Protection No. 91/2025/QH15 and Decree 356/2025/NĐ-CP, both effective 1 January 2026.
- **Precise location** is treated as sensitive personal data. The app asks for explicit consent in the app, explaining purpose, recipients and that nothing is stored, before the browser's location prompt. The consent is stored only on the user's device (`lib/geoConsent.ts`) and can be withdrawn on the Privacy page.
- **Before launch:** set `OPERATOR_NAME`, `OPERATOR_EMAIL` and `OPERATOR_ADDRESS`. Until then the pages show placeholders.
- **Legal review:** have a lawyer review the texts. Cross-border transfer obligations apply because Google and Wikimedia process data outside Vietnam.

## Dish photos

Real photos come from Wikipedia / Wikimedia Commons, which is free and needs no API key.

- **New dishes:** looked up automatically when added, through `lib/dishes/wikiImage.js`. You can also paste your own https URL in the manage form.
- **Existing dishes:** `node scripts/fetch-dish-images.mjs` fills in missing photos. Add `--force` to re-fetch all of them. The resolver backs off when Wikipedia rate-limits it.
- **Bandwidth:** the wheel loads 330px thumbnails (about 20 KB each) with CORS into its WebGL texture, and the result uses 500px. See `lib/dishes/imageSrc.ts`.
- **Attribution:** each result links to the photo's source page.

## Managing dishes

`/[locale]/manage`: add dishes (Vietnamese name, optional English name, icon) or switch them off. "Removing" a dish only sets `active: false`; turning it back on restores it.

Dishes are stored in `data/dishes.json` through `lib/dishes/store.ts`. The file system is read-only on serverless hosts (Vercel etc.), so replace that module with a database or KV store before deploying there.

## API

| Method  | Route                     | Body                          |
| ------- | ------------------------- | ----------------------------- |
| `GET`   | `/api/dishes[?active=1]`  | –                             |
| `POST`  | `/api/dishes`             | `{ nameVi, nameEn?, emoji? }` |
| `PATCH` | `/api/dishes/:id`         | `{ active: boolean }`         |
| `GET`   | `/api/places?q&lat&lng&lang` | –                          |
| `GET`   | `/api/places/photo?name`  | – (redirects to Google's photo URL) |
