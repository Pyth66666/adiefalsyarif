# ADIEF AL SYARIF — Interactive Portfolio

An interactive digital experience with two worlds: **BUILD** (tech / cybersecurity /
engineering) and **CREATE** (photography / design / visual memories). Backed by a real
private CMS at **/admin** (Supabase Auth + Postgres + Storage).

Stack: Next.js 15 · React 19 · TypeScript · Tailwind · Three.js (R3F) · GSAP · Lenis ·
Framer Motion · Supabase.

## Quick start

```bash
npm install
npm run dev       # http://localhost:3000
```

Without Supabase configured, the public site runs on development placeholder content and /admin shows setup guidance. Follow **`supabase/SETUP.md`** to activate.

## CMS

- **/admin/login** — persistent Supabase auth session (stays logged in across reloads/browser restarts).
- **/admin** — manage everything: projects, photography (drag-drop upload + auto EXIF),
  events (auto-countdown for future dates), collection badges, HackDev stats, profile,
  statistics, social links, media library, site settings.
- Publish/unpublish (drafts never appear publicly), live previews reusing the real public
  components, and safe deletes (media in use is protected).

```
ADMIN → Supabase (Postgres + Storage) → Public Website
```

Env: `.env.example`. Schema + setup: `supabase/schema.sql` + `supabase/SETUP.md`.

## Making it yours — all content is data-driven

| Where | What you control |
|---|---|
| `/admin` (recommended) | Every editable piece of portfolio content |
| `data/` | Development placeholder fallback only (used when Supabase is not configured) |

### Placeholders

Anything in `[BRACKETS]` is a placeholder. Never invent achievements, ranks, dates, or
statistics that are not verified. Unfilled optional fields (links, images, EXIF) are hidden
gracefully.

## Design decisions

- **No conventional navbar** — top-left `ADIEF`, top-right `MENU` full-screen overlay.
- **Custom cursor** with contextual labels (VIEW / OPEN / DRAG / ENTER) — desktop only,
  auto-disabled on touch + `prefers-reduced-motion`.
- **Split gateway** — BUILD / CREATE panels expand toward the cursor; central shader object
  morphs neutral → network (BUILD) → lens (CREATE). Falls back to a 2D object without WebGL.
- **Mobile** — stacked BUILD / CREATE chooser instead of the cursor split.
- **Sound** — none by default (nothing plays automatically).
- **Performance** — 3D scene is lightweight (single icosahedron + one particle field,
  `dpr` capped, GPU-friendly shader), gallery images are `loading="lazy"`.

## Notes for extension

- Heavy 3D could be `next/dynamic`-loaded on interaction if you add more scenes.
- Photographs use placeholder gradients until `src` values are added; `lib/exif.ts` wires
  real EXIF automatically once images exist.
- Add `outputFileTracingRoot` intentionally pins the build root to this directory.

## Interaction refinements

The original boot sequence, explicit ENTER screen, full-screen split gateway,
minimal ADIEF / MENU navigation, and BUILD and CREATE introductions remain the
visual foundation. The sections below them use the newer interactive designs.

- The gateway uses the existing Three.js stack, loaded on demand, with a lower-detail mesh and rendering paused offscreen.
- Projects use the large screenshot preview, frame scrubbing, and full case-study galleries.
- Photos offer GRID and ON THE DESK layouts. The viewer includes swipe navigation, optional camera details, and image expansion.
- The discipline map links to matching published projects; LAB adds the signal-matching experiment.
- Section entrances and text reveals replay when scrolling down or back up.
- Collection badges support actual drag rotation, flip buttons, and story dialogs.
- Modal dialogs handle Escape and focus restoration; gallery and map controls support keyboard navigation.
- No additional visual libraries were installed.
