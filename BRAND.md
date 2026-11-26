# Trident brand

Source of truth: **Trident Brand Guidelines v2.1 — DRAFT FOR REVIEW (Nov 2026, 34 pages)**.
This file extracts it into a reusable reference. The guide wins over this file and over any generic design preference.

Status tags carried over from the guide:

| Tag | Meaning |
|---|---|
| `KIT v1.0` | Decided in Brand Kit v1.0. Treat as approved. |
| `PROPOSAL` | Recommendation consistent with the kit, **awaiting approval**. Implemented provisionally. |
| `CHANGED v2.1` | Corrected after the v2.0 review. |
| `[CONFIRM: …]` | A fact Trident does not hold yet. Never invent it. |

---

## ⚠ Gate before anything external (guide p.2, p.32)

> `[CONFIRM: employer conflict-of-interest and outside-activity review]` — Gate. Nothing external until this clears.

Consequences in this repository:

- Every use of **"independent"**, **"not affiliated"** and value 02 *Independent by design* is **provisional** (guide p.4, 14, 15, 16). They are implemented because the guide specifies them, and are flagged in `src/content/site.ts`.
- The site must **not be deployed publicly** and no outreach may be sent until the gate is cleared. `APP_ENV != production` pages are `noindex`.
- Trident Command enforces a per-opportunity conflict-of-interest review before qualification (see SECURITY.md).

## Foundation

| Item | Value | Status |
|---|---|---|
| Name | Trident (running text). `TRIDENT` only in logo artwork. | KIT v1.0 |
| Descriptor | TECHNOLOGY COMMERCIALIZATION & CREATIVE AGENCY | KIT v1.0 |
| Tagline | Beyond the Award. | KIT v1.0 |
| Secondary line | Government-validated. Market-ready. | PROPOSAL |
| Promise | Turning breakthrough technology into market opportunity. | KIT v1.0 |
| What we do | We transform emerging technologies into commercially competitive brands, digital experiences and growth strategies. | KIT v1.0 |
| Purpose | Make sure breakthrough technology doesn't stop at the award. | PROPOSAL |
| Headline | Innovation deserves a market. | KIT v1.0 |
| Method | Position · Build · Activate (always this order) | KIT v1.0 |
| Positioning statement | Guide p.4 (implemented on /about) | PROPOSAL; "independent" provisional |
| Values | Proof over promise · Independent by design · Commercial first · Craft at speed | PROPOSAL |
| Personality | Precision-driven, sophisticated, ambitious, technical, entrepreneurial | KIT v1.0 |

### Method (guide p.8)

| Prong | Line | Question | Output |
|---|---|---|---|
| 01 Position | Define the opportunity. | Who buys this and why? | Positioning brief + messaging house |
| 02 Build | Establish the presence. | Will they believe us? | Launch-ready brand system and assets |
| 03 Activate | Generate demand. | Will they act? | 90-day activation plan + content calendar |

Names and one-line definitions are KIT v1.0; questions, activities and outputs are PROPOSAL.

### Audiences (guide p.5, PROPOSAL)

1. Award-stage companies (primary buyer) 2. Pre-award founders 3. Referrers (accelerators, tech-transfer offices, investors).
Programs the audience passes through (SBIR/STTR, Tradewinds, P1, DARPA ERIS, IARPA, DARPAConnect, APEX Accelerators, voucher programs) may be named for targeting **but never presented as partners**.

### Quality standard (guide p.10, PROPOSAL)

Make → Render → Review → Fix → Ship. Ship levels: **L1** internal draft, **L2** client review, **L3** release. Encoded in `deliverables.ship_level`.

## Logo (guide p.17–19)

- **Always use the supplied artwork.** The wordmark is never retyped, redrawn or re-spaced.
- Artwork in `public/brand/` was **extracted unaltered** from the raster images embedded in the guide PDF (`pdfimages`, alpha mask re-applied, no redrawing):
  - `lockup-gold.png` (primary, gold on Black) · `lockup-ivory.png` (reversed, on Carbon) · `lockup-black.png` (on Ivory/Gold) · `mark-gold.png` · `mark-black.png`
- Favicons (`src/app/icon.png`, `apple-icon.png`) are the gold mark resized onto Black (guide p.31: mark only, on Black).
- **Dependency:** vector masters (SVG/EPS) do not exist yet (guide p.32, open decision 02). Raster is acceptable for screen at current sizes; print requires vectors.
- Minimum size: lockup 120 px wide, mark 24 px tall (enforced in `src/components/brand/logo.tsx`). Clear space = wordmark height (lockup), ¼ mark height (mark alone).
- **Owner decision (Nov 26, 2026):** the homepage hero (`HeroTrident`) renders the supplied mark as a field of binary digits on a binary-code staff (handle) reaching down to the baseline, with falling code columns and a rising gold line. The staff is an added element beneath the unaltered mark. This is an **approved exception** to the guide's imagery "don't" list ("binary code", p.26) and the glow/texture misuse examples (p.19), **limited to the website hero**. The artwork is not redrawn: digits are clipped to the mark's own alpha. Do not reuse the treatment on print, social, decks or documents without a new decision; update the guide to record it.
- Gold logo never on a light ground. One logo per surface. No shadows, glows, outlines, rotation, recolouring or busy backgrounds.

## Color (guide p.20–22)

| Token | Hex | Role |
|---|---|---|
| Black | `#000000` | Primary ground |
| Carbon | `#15130F` | Secondary ground: cards, panels, alternating sections |
| Gold Light | `#FBD474` | Highlights, key numbers, links, focus on dark |
| Gold | `#E6A73B` | Logo, headline accents on Black/Carbon. *The* brand color |
| Gold Deep | `#C5851B` | Rules, dividers, pressed states, secondary chart series |
| Bronze | `#996304` | Gradient end; the only accent allowed as text on Ivory (4.58:1) or White (5.07:1) |
| Ivory | `#F7F3EA` | Body text on dark; light document ground |
| Ivory 70% | `#ADAAA4` | Captions/secondary text on Black or Carbon (CHANGED v2.1) |
| Ivory 50% | `#7C7A75` | Disabled / large labels **on Black only** (fails AA on Carbon) |
| White | `#FFFFFF` | Utility ground only (email, uncoated paper). Never a brand surface |

- **Signature gradient:** 135°, `#FBD474 → #E6A73B → #996304`, never reversed or re-stopped, only on large hero fields, never behind body text, max one element per surface.
- **Proportion:** ~70% Black · 20% Ivory · 10% Gold. *If a layout looks gold, it has too much gold.*
- **Gold lives on dark. Black lives on light.** Gold text on Ivory fails contrast (1.90:1) and is not used.
- CMYK values are guidance only; Pantone matches `[CONFIRM]`.

## Typography (guide p.23–24)

| Role | Family | Weights | Fallback |
|---|---|---|---|
| Headlines | Space Grotesk | 700 (500 for small subheads, PROPOSAL) | Arial Bold |
| Body | Inter | 400 (600 for emphasis, PROPOSAL) | Arial |
| Labels | IBM Plex Mono | 500, caps, +12% tracking | Consolas, Courier New |
| Wordmark | Logo artwork only | — | — |

Screen scale (KIT v1.0 + PROPOSAL): Display 68/1.0/−2% · H1 40/1.05/−1.5% · H2 24/1.15/−1% · H3 18 (500)/1.3 · Body L 18/1.6 · Body 16/1.6 · Caption 14/1.5 · Label 12 mono/1.4/+12%.
Rules: sentence case, left-aligned, ragged right, 60–75 characters per line, headlines ≤ 3 lines; never italic or all-caps headlines, never mono for body, ≤ 3 sizes in a layout's main message.

Fonts are self-hosted from npm (`@fontsource*`, SIL OFL) so no request goes to Google at runtime.

## Layout and imagery (guide p.25–26, PROPOSAL)

- 12 columns; spacing steps 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- **No photography is approved yet** `[CONFIRM: image library]`. The site therefore uses no photography and no stock imagery.
- Iconography: line icons, 24 px grid, 1.5 px stroke, square caps, mitred corners, Gold on Black/Carbon. The site uses almost no icons by design.

## Guardrails (guide p.16 — non-negotiable)

1. Trident is independent and platform-agnostic. *(KIT v1.0; provisional until the gate clears)*
2. Never imply government endorsement. *(KIT v1.0)*
3. Never describe marketplace selection as a contract award. *(KIT v1.0)*
4. No agency or program seals, logos or marks without written permission. *(PROPOSAL)*
5. Every client credential published is verified, with source and date on file. *(PROPOSAL — enforced by the `credentials` schema)*

**"Validated"** means a competitive selection (an award, or an assessment as awardable). Not a certification, not an endorsement. Use only beside a named, dated credential.

**Standard disclaimer** (footer, any material naming programs): *Trident is an independent company. It is not affiliated with, endorsed by or acting on behalf of any government agency or program.*

## Owner decisions that differ from the guide

| Date | Decision | Scope |
|---|---|---|
| 2026-11-26 | Binary-code texture and animated light on the mark | Website homepage hero only |
| 2026-11-26 | Staff (handle) added beneath the mark in the hero | Website homepage hero only; not part of the logo |

## Open decisions (guide p.32) and repository status

| # | Decision | Status in this repo |
|---|---|---|
| 01 | Outside-activity / COI review (gate) | **Open.** Blocks deployment and outreach. |
| 02 | Vector logo masters | **Open.** Raster extracted from the guide is used. |
| 03 | Approve PROPOSAL items | **Open.** Implemented provisionally. |
| 04 | Facts to confirm: website, location, contacts, prices, turnaround, proof points, targets | **Open.** Prices seeded as `price_status = proposed`; turnaround shown as "(est.)"; contact email shows `[CONFIRM]`. |
| 05 | Pantone spot colors | Not needed for web. |
| 06 | Brand owner and approvals | **Open** `[CONFIRM: owner]`. |

## Market figures

The guide's Chapter 02 figures (GAO-26-108750, National Academies 2026, Bresler & Bresler 2023, Tradewinds Sept 2026) are used **only** in `/insights/awardable-is-not-adopted`, always with publisher, measure and year, and never to imply a relationship with any program. Refresh yearly.
