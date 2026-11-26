# Design system

Implementation of BRAND.md for screens. Tokens live in `src/app/globals.css` (`@theme`, Tailwind 4) and are the only source of colors, fonts and type sizes.

## Principles

1. **Editorial, not template.** Left rail eyebrow + headline, content on the right; hairline rules instead of cards; numbered rows instead of three-up feature grids.
2. **Gold is rare.** Gold appears on labels, key numbers, one primary button per view and the 135° gradient on at most one element. Never as a surface.
3. **Solid fields, not noise.** Black, Carbon and Ivory grounds. No glassmorphism, no textures, no stock photography, no decorative gradients.
4. **The logo is the hero on covers; the type is the hero on the web.** Mark alone in headers (tight space), full lockup in the footer.
5. **Three audiences, three densities.** Public site: generous and editorial. Portal: calm and reassuring. Command: dense, tabular, 13 px base.

## Tokens

| Token (Tailwind) | Value | Use |
|---|---|---|
| `black` | #000000 | Default ground |
| `carbon` | #15130F | Panels, alternate sections, table headers |
| `carbon-2` | #1D1A15 | **PROVISIONAL** raised Carbon for active nav in Command |
| `gold-light` | #FBD474 | Primary button, links, focus ring on dark |
| `gold` | #E6A73B | Labels, numbers, accents |
| `gold-deep` | #C5851B | Pressed state |
| `bronze` | #996304 | Labels and links on Ivory |
| `ivory` | #F7F3EA | Text on dark; light sections |
| `ivory-2` | #EDE6D6 | **PROVISIONAL** Ivory panel tint (seen in guide p.4/15) |
| `ivory-70` | #ADAAA4 | Secondary text on Black/Carbon |
| `ivory-50` | #7C7A75 | Disabled, large labels — Black only |
| `line` / `line-light` | #2A2620 / #D9D2C3 | Decorative hairlines (non-text) |
| `danger`, `danger-deep`, `success` | — | **PROVISIONAL utility colors** for form errors and status. The guide defines no semantic colors; these are muted to stay inside the palette's warmth. Flag for brand approval. |

Utility class `.gradient-gold` = the signature gradient. `.label` = Plex Mono 500, 12 px, caps, +12%.

## Type

`text-display` 68 · `text-h1` 40 · `text-h2` 24 · `text-h3` 18 · `text-body-l` 18 · `text-body` 16 · `text-caption` 14 · `text-label` 12, all with the guide's leading and tracking.
Responsive exceptions: hero display scales 52 → 68 → 88 px and section H2s 32 → 40 px; ratios are kept.
Command uses 13 px table text and 10.5 px mono headers for density (PROVISIONAL; the guide's minimum is for marketing surfaces).

## Contrast pairings (guide p.22, WCAG 2.2)

| Pair | Ratio | Allowed |
|---|---|---|
| Ivory / Black | 18.96 | any text |
| Gold Light / Black | 14.77 | any text |
| Gold / Black | 9.96 | any text |
| Gold / Carbon | 8.79 | any text |
| Black / Gold Light (primary button) | 14.77 | any text |
| Black / Ivory | 18.96 | any text |
| Bronze / Ivory | 4.58 | body text (AA) |
| Ivory 70% / Carbon | ≥ 4.5 | secondary text |
| Ivory 50% / Carbon | 4.33 | **large text only** |
| Gold or Gold Deep / Ivory | 1.90 / 2.81 | **never** |

## Components (`src/components`)

| Component | File | Notes |
|---|---|---|
| `Logo` | `brand/logo.tsx` | Supplied raster only; enforces minimum sizes |
| `Button`, `ButtonLink`, `buttonClass` | `ui/button.tsx` | `primary` (Black on Gold Light), `secondary` (outline), `ghost`, `dark` / `outline-dark` for Ivory surfaces. 2 px radius |
| `Container`, `Eyebrow`, `Notice`, `Pill`, `EmptyState`, `Provisional` | `ui/primitives.tsx` | `Notice` is the single pattern for info/warning/error/success (left rule, `role=alert` for errors) |
| `Field`, `Input`, `Textarea`, `Select`, `Checkbox` | `ui/form.tsx` | Visible labels, `(optional)` markers, `aria-describedby` for help and errors, `aria-invalid` |
| `Section`, `PageHeader` | `site/` | Editorial section pattern; `tone` = black / carbon / ivory |
| `HeroTrident` | `site/hero-trident.tsx` | Homepage hero (canvas, client). Supplied mark rendered as binary digits clipped to its alpha, on a binary staff (~16% of mark width) from the mark's point to the award baseline (palette gradient Gold Light → Gold → Gold Deep over a 28% copy of the artwork), faint Bronze/Gold Deep code columns behind, and a Gold Light line rising A → B every 9 s that lights the code. 30 fps cap, paused off-screen, static under reduced motion, plain mark without JS. **Owner-approved exception** (BRAND.md → Owner decisions), hero only |
| `MethodDiagram` | `site/method-diagram.tsx` | Abstract stems A→B. **Not a logo derivative.** Currently unused (replaced in the hero by `HeroTrident`) |
| Command `PageTitle`, `Metric`, `Table/Th/Td`, `Panel` | `command/ui.tsx` | Dense operational UI; `NoData` for metrics without inputs |

## States

Every surface implements: **loading** (`loading.tsx`, "Saving…", disabled buttons), **empty** (`EmptyState` / dashed panels with the reason and next action), **success** (`Notice tone=success`), **warning**, **error** (`Notice tone=error`, field errors, `error.tsx`), **permission denied** (`/forbidden`; other tenants' records return 404 so existence isn't leaked).

## Accessibility

Skip link; one `h1` per page; landmark navs with labels; `aria-current` on nav; focus ring Gold Light on dark / Black on Ivory; progress bars with `role=progressbar`; radio/checkbox groups in fieldsets with legends; `prefers-reduced-motion` disables animation; no horizontal overflow at 390 / 834 / 1440 px (verified with Playwright).

## Open design items

- Photography direction approved but no images licensed: pages use typography and diagrams only.
- Semantic utility colors (danger/success) and Carbon/Ivory tints need brand approval.
- Iconography set (guide p.26) not yet produced as SVGs; the UI avoids icons except a 14 px arrow.
