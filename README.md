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
- **Intro and page transitions:** the chili curtain intro (`components/Intro`) plays on every full page load: opening the site, refreshing, or following an outside link. In-app navigation shows a page-transition curtain instead (`components/PageTransition`): it covers the page with a spinning mini wheel and "Đang dọn món…", waits for the new route, then reveals it. Language switches keep your scroll position, and if a navigation never completes, the curtain clears itself after 8 seconds.
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
- **Legal review:** have a lawyer review the texts. Cross-border transfer obligations apply because Google processes data outside Vietnam.

## Privacy and cookie consent (Vietnam, Taiwan, EU)

After the preload screen, first-time visitors see a privacy panel (`components/ConsentBanner`). It is built to the strictest common rules of Vietnam's PDPL 91/2025/QH15 and Decree 356/2025, Taiwan's PDPA (2025 amendment) and the EU GDPR/ePrivacy rules.

- **Terms:** the user must tick to accept the Terms and acknowledge the Privacy policy before choosing.
- **Optional purposes are opt-in and separate:** "Preferences" (remember sound on/off) and "Location". Nothing is pre-ticked. "Accept all" and "Necessary only" are equally prominent.
- **Storage:** the choice is stored in `localStorage` as `lw:consent` (`lib/consent.ts`). Bump `CONSENT_VERSION` after a material policy change and everyone is asked again. The Location toggle syncs with `lib/geoConsent.ts`. Turning Preferences off deletes `lw:sound`.
- **Changing choices:** "Cookie settings" in every footer, and the button on `/[locale]/cookies`, reopen the panel.
- **`/[locale]/cookies`:** lists every cookie and storage key, how caching works, how location is handled, third parties and the legal bases.
- **No third-party image requests:** Wikimedia photos are served through `/api/img`, a same-origin proxy that only accepts Wikimedia Commons image URLs, caps size at 5 MB and keeps an in-memory cache. The browser never contacts Wikimedia.
- **Security headers** (`next.config.ts`): HSTS, nosniff, `X-Frame-Options: DENY`, a strict Referrer-Policy, a Permissions-Policy that allows geolocation only for this site, and COOP. `X-Powered-By` is off. A nonce-based Content-Security-Policy is still to do.
- **Cybersecurity law:** the Terms cite Law on Cybersecurity No. 116/2025/QH15, in force 1 July 2026, which replaces Law 24/2018/QH14.

## Wheel rendering and performance

The wheel is built as progressive enhancement, so it shows up fast and never stays blank on weak or old phones:

1. **Silhouette at first paint.** The server renders a CSS silhouette of the wheel (ink plate plus slices in the real colours), so the wheel shape is visible before any JavaScript runs.
2. **Instant 2D wheel.** On hydration, `FlatWheel` (`components/LuckyWheel/flatWheel.ts`) draws the full face (labels and photos) on a 2D canvas. It uses no three.js, spins with a single GPU-composited CSS rotation, and works without WebGL.
3. **3D upgrade when idle.** `wheelScene.ts` and three.js (about 540 KB) are code-split and loaded with `requestIdleCallback`, then cross-faded in.
4. **Fallback.** If 3D can't start (no WebGL2, a software-only GPU, or out of memory) or loses its GPU context later, the wheel switches back to 2D automatically.

Other details:

- **Weak devices:** devices with 2 GB of RAM or less, 2 CPU cores or fewer, or Data Saver turned on stay on 2D.
- **3D scene:** uses cheap Phong materials, with no reflection pre-pass and no clear-coat material. Pegs and bulbs are instanced, and the face texture is sized to the screen with no mipmaps.
- **Loading order:** photos load after first paint, face redraws are batched, and each GPU context is released on unmount, since browsers cap live WebGL contexts.
- **Fonts:** only the brand font is preloaded, and only with the width axis (the optical-size axis nearly doubled its size). The accent and mono fonts load without preload.
- **Forcing a renderer** (useful for support or testing): add `?wheel=flat` or `?wheel=3d` to the URL.
- **Measuring:** `performance.mark("wheel:drawn")` and `"wheel:3d"` mark the two milestones.

## Preload screen (first load)

The chili curtain loads the app in the background and lifts as soon as it's ready. The logic is in `components/Intro/Intro.tsx` and `lib/appReady.ts`.

- **What it waits for:** the brand font and, on the home page, the wheel drawn with all its dish photos. The wheel sits inside a `<Suspense>` boundary and hydrates later, so it announces itself with `data-ready-gate="wheel"` in the HTML.
- **Timing:** it lifts no sooner than 1.4 s after first paint, so the title can finish rising, and no later than 4 s, so it never feels frozen. The progress bar eases forward on its own and jumps as tasks finish.
- **Safety nets against getting stuck** (important on iPhone):
  - The inline head script has its own 7 s timer, which works even if React never loads.
  - A pure-CSS failsafe hides the curtain after 9 s.
  - A page restored from Safari's back-forward cache ends the intro at once.
  - Every readiness task has its own timeout, because `document.fonts` and image decoding can stall on iOS.
- **Ordering:** entrance animations start as the curtain lifts, and the 3D wheel upgrade starts only after it has fully gone.

## Result moment

- **Confetti:** drawn on one canvas (fewer particles on low-end phones) instead of about 100 GSAP-animated DOM pieces.
- **Popup backdrop:** no `backdrop-filter` blur on the popup.
- **No forced layout at the reveal:** no per-letter text splitting and no layout reads at the moment the result appears.
- **Photos ready in advance:** the winner's large photo preloads and pre-decodes while the wheel spins (`lib/dishes/imagePreload.ts`). `ResultPhoto` shows the already-decoded wheel thumbnail instantly and fades the sharp one in on top.

## Dish photos

Real photos come from Wikipedia / Wikimedia Commons, which is free and needs no API key.

- **New dishes:** looked up automatically when added, through `lib/dishes/wikiImage.js`. You can also paste your own https URL in the manage form.
- **Existing dishes:** `node scripts/fetch-dish-images.mjs` fills in missing photos. Add `--force` to re-fetch all of them. The resolver backs off when Wikipedia rate-limits it.
- **Bandwidth:** the wheel loads 330px thumbnails (about 20 KB each) into its texture, and the result uses 500px. They are served same-origin through `/api/img`. See `lib/dishes/imageSrc.ts`.
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
