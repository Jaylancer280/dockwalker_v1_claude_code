# DockWalker UI Design System — Claude Code Prompt

You are implementing the UI for DockWalker — a professional superyacht crew marketplace. Before writing any component, read and internalize this entire design system. Every rule here is non-negotiable. Do not deviate without explicit instruction.

---

### STACK

- **Framework:** Next.js + TypeScript
- **Styling:** Tailwind CSS utility classes only — no arbitrary CSS files unless I explicitly ask
- **Fonts:** Geist (UI text) + Geist Mono (rates, counts, timestamps, data) — import via `next/font/google`
- **Icons:** Lucide React — use consistently, never inline SVG unless Lucide lacks the icon
- **Motion:** Tailwind transition utilities for simple states; Framer Motion for entrance animations and staggered lists
- **Theme:** CSS custom properties on `[data-theme]` attribute, toggled via a ThemeProvider context. Dark is the default.

---

### DESIGN TOKENS

Implement these as CSS custom properties in `globals.css`. Every colour in the app must reference a token — no hardcoded hex values in components.

```css
/* ── DARK ──────────────────────────────────────── */
[data-theme='dark'] {
  --c-bg: #111a24; /* page background — visible dark navy, not black */
  --c-surface: #162030; /* topbar, sidebar, panels */
  --c-card: #1b2738; /* card background */
  --c-card-hover: #1f2e40; /* card hover/selected background */
  --c-border: rgba(255, 255, 255, 0.07);
  --c-border-hi: rgba(74, 158, 255, 0.26); /* hover/focus border */

  --c-text-1: #dce8f4; /* primary — headings, labels */
  --c-text-2: #7a9ab8; /* secondary — vessel names, meta */
  --c-text-3: #4a6680; /* tertiary — timestamps, separators */

  --c-accent: #4a9eff;
  --c-accent-lo: rgba(74, 158, 255, 0.1);
  --c-accent-md: rgba(74, 158, 255, 0.2);

  --c-green: #34d399;
  --c-green-lo: rgba(52, 211, 153, 0.1);
  --c-amber: #f59e0b;
  --c-amber-lo: rgba(245, 158, 11, 0.1);
  --c-red: #f87171;
  --c-red-lo: rgba(248, 113, 113, 0.1);

  /* Atmospheric background gradients — radial only, corner-anchored */
  --c-body-grad-a: rgba(74, 158, 255, 0.05);
  --c-body-grad-b: rgba(20, 50, 90, 0.35);

  /* Gradient text — hero numbers only (feed count, stats) */
  --c-num-grad: linear-gradient(160deg, #dce8f4 50%, #4a6680 100%);

  /* Vessel icon chip */
  --c-icon-bg: linear-gradient(145deg, rgba(74, 158, 255, 0.09), rgba(27, 39, 56, 0.95));
  --c-icon-border: rgba(74, 158, 255, 0.14);
  --c-icon-color: #4a9eff;

  /* Featured card */
  --c-featured-bg: #1b2738;
  --c-featured-border: rgba(74, 158, 255, 0.35);
  --c-featured-bar: rgba(74, 158, 255, 0.6); /* left accent bar */
  --shadow-featured: 0 0 0 1px rgba(74, 158, 255, 0.22);
}

/* ── LIGHT ─────────────────────────────────────── */
[data-theme='light'] {
  --c-bg: #eef2f8;
  --c-surface: #ffffff;
  --c-card: #ffffff;
  --c-card-hover: #f7fafd;
  --c-border: rgba(13, 27, 42, 0.07);
  --c-border-hi: rgba(45, 125, 224, 0.3);

  --c-text-1: #0d1b2a;
  --c-text-2: #3d5a7a;
  --c-text-3: #7a9ab8;

  --c-accent: #2d7de0;
  --c-accent-lo: rgba(45, 125, 224, 0.08);
  --c-accent-md: rgba(45, 125, 224, 0.15);

  --c-green: #059669;
  --c-green-lo: rgba(5, 150, 105, 0.08);
  --c-amber: #d97706;
  --c-amber-lo: rgba(217, 119, 6, 0.09);
  --c-red: #dc2626;
  --c-red-lo: rgba(220, 38, 38, 0.08);

  --c-body-grad-a: rgba(74, 158, 255, 0.04);
  --c-body-grad-b: rgba(74, 158, 255, 0.02);
  --c-num-grad: linear-gradient(160deg, #0d1b2a 50%, #7a9ab8 100%);

  --c-icon-bg: linear-gradient(145deg, rgba(45, 125, 224, 0.09), rgba(210, 225, 242, 0.6));
  --c-icon-border: rgba(45, 125, 224, 0.14);
  --c-icon-color: #2d7de0;

  --c-featured-bg: #f4f8ff;
  --c-featured-border: rgba(45, 125, 224, 0.28);
  --c-featured-bar: rgba(45, 125, 224, 0.55);
  --shadow-featured: 0 1px 3px rgba(13, 27, 42, 0.06), 0 2px 8px rgba(45, 125, 224, 0.08);
}
```

---

### TYPOGRAPHY RULES

These are hard rules. Do not override them.

| Role                             | Font       | Size    | Weight  | Notes                                                 |
| -------------------------------- | ---------- | ------- | ------- | ----------------------------------------------------- |
| Hero numbers (feed count, stats) | Geist      | 48–56px | 800     | Gradient text via `--c-num-grad`                      |
| Page title                       | Geist      | 24–28px | 700     | `letter-spacing: -0.5px`                              |
| Card title                       | Geist      | 15px    | 650     | `letter-spacing: -0.3px`                              |
| Body / labels                    | Geist      | 13–15px | 400–500 | —                                                     |
| Rates & money                    | Geist Mono | 17px    | 700     | `letter-spacing: -0.5px`                              |
| Rate period (`/day`)             | Geist      | 11px    | 500     | `color: var(--c-text-2); opacity: 0.6` — NOT `text-3` |
| Timestamps, counts               | Geist Mono | 11px    | 400     | `color: var(--c-text-3)`                              |
| Nav labels                       | Geist      | 10px    | 700     | Uppercase, `letter-spacing: 0.08em`                   |
| Badges                           | Geist      | 11px    | 600     | `letter-spacing: 0.01em`                              |
| Buttons                          | Geist      | 12px    | 600     | `letter-spacing: 0.01em`                              |

**NEVER use:** Inter, Roboto, Arial, system-ui, or any fallback as the primary font.

---

### BORDER RADIUS SYSTEM

This is the hierarchy. Mixing these creates visual inconsistency.

| Element                                    | Radius         |
| ------------------------------------------ | -------------- |
| Cards, modals, panels                      | `14px`         |
| Inputs, icon buttons, nav items, tags      | `8px`          |
| Action buttons (primary, secondary, apply) | `999px` (pill) |
| Filter pills, badges                       | `999px` (pill) |
| Vessel icon chip                           | `10px`         |
| Urgency ribbon label                       | `4px`          |

---

### SHADOW & ELEVATION RULES

These rules exist to avoid AI-generated UI tells. Follow them exactly.

**Dark mode — use borders and glow, never drop shadows:**

- Cards at rest: `border: 1px solid var(--c-border)` only
- Cards on hover/selected: `border-color: var(--c-border-hi)` — border change only, no shadow, no transform
- Featured cards: `box-shadow: var(--shadow-featured)` — a subtle outer ring, not a drop shadow
- Do NOT use `box-shadow` with large blur values on dark surfaces — glow disappears into dark backgrounds and reads as broken

**Light mode — use precise shadows, not atmospheric blur:**

- Cards at rest: `border: 1px solid var(--c-border)` only
- Hover: `border-color: var(--c-border-hi)` — border change only
- Featured: `box-shadow: var(--shadow-featured)` — 1px border ring + soft drop, max blur 8px
- NEVER: `box-shadow: 0 20px 60px rgba(0,0,0,0.3)` — this is 2018 card design

**Universal:**

- No `transform: translateY(-2px)` on hover — cards are not physical objects lifting off a table
- No gradient-fill buttons — ever
- No decorative shadows on flat background surfaces

---

### GRADIENT RULES

Gradients simulate physics. If you cannot explain why a gradient exists in terms of light hitting a surface, remove it.

**Permitted:**

- Body background: two radial gradients, corner-anchored, opacity ≤ 0.07 — atmospheric only
- Gradient text: hero numbers and the “24 positions” display only — `background-clip: text`
- Vessel icon chip: subtle 145deg gradient, same hue family only
- Featured card left accent bar: vertical gradient, full opacity at top fading to transparent

**Forbidden:**

- Linear gradient fills on cards
- Gradient-fill buttons
- Any gradient where you can clearly see where one colour ends and another begins
- Cross-hue gradients (navy to teal, blue to purple, etc.)
- Gradient overlays as decorative elements

---

### CARD ANATOMY

Every card in DockWalker follows this structure. Do not invent new card layouts — adapt this pattern.

```
┌─────────────────────────────────────────┐  ← border: 1px solid --c-border
│ [feat-bar] [vessel-icon] [title+vessel] [badge] [rate] │  ← row 1
│ [tag] [tag] [tag] [tag]                              │  ← row 2
│ ─────────────────────────────────────────────────── │  ← divider
│ [clock] Xh ago  [people] X applicants    [Apply btn] │  ← footer
└─────────────────────────────────────────┘
```

- **Vessel icon chip:** 38×38px, `border-radius: 10px`, 2-letter abbreviation in Geist Mono, uses `--c-icon-*` tokens
- **Rate:** Geist Mono 17px/700 + `/day` in Geist 11px/500 at 60% opacity — they sit on the same baseline
- **Tags:** `background: var(--c-bg)`, `border: 1px solid var(--c-border)`, `border-radius: 8px`, emoji prefix
- **Footer divider:** `border-top: 1px solid var(--c-border)`
- **Featured variant:** add a `feat-bar` div — `position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: linear-gradient(180deg, var(--c-featured-bar) 0%, transparent 100%)`
- **Urgent variant:** `border-color: rgba(245,158,11,0.22)` + absolute-positioned urgency ribbon top-right
- **Hover/selected state:** `border-color: var(--c-border-hi)` only — no shadow, no lift, no background change on standard cards
- **Expanded/selected state:** `border-color: var(--c-accent)` + `background: var(--c-card-hover)`
- **NEVER** use `::before` or `::after` pseudo-elements for visual effects that need to respect `border-radius` — use `box-shadow` or real DOM elements instead (Safari/WebKit clips pseudo-elements inconsistently)

---

### STATUS BADGE SYSTEM

Three semantic states only. Do not invent new badge colours.

| State                  | Background      | Text         | Border                   |
| ---------------------- | --------------- | ------------ | ------------------------ |
| Open / Active          | `--c-green-lo`  | `--c-green`  | `rgba(52,211,153,0.18)`  |
| Filling Fast / Pending | `--c-amber-lo`  | `--c-amber`  | `rgba(245,158,11,0.18)`  |
| Invite Only / Closed   | `--c-accent-lo` | `--c-accent` | `--c-border-hi`          |
| Disputed / Cancelled   | `--c-red-lo`    | `--c-red`    | `rgba(248,113,113,0.18)` |

- Open/Filling badges get a pulsing dot: `5px` circle, `background: currentColor`, `animation: blink 2s ease infinite`
- Static states (Invite Only, Closed) get no dot

---

### BUTTON SYSTEM

| Variant          | Background           | Text              | Border                         |
| ---------------- | -------------------- | ----------------- | ------------------------------ |
| Primary          | `var(--c-accent)`    | `#fff`            | none                           |
| Ghost            | `var(--c-card)`      | `var(--c-text-2)` | `1px solid var(--c-border)`    |
| Apply (card CTA) | `var(--c-accent-lo)` | `var(--c-accent)` | `1px solid var(--c-border-hi)` |

- All buttons: `border-radius: 999px`, `font-size: 12px`, `font-weight: 600`
- Apply button text: uppercase, `letter-spacing: 0.03em`
- Primary hover: `filter: brightness(1.08)` — not a colour change
- Apply hover: flip to `background: var(--c-accent); color: #fff`
- Ghost hover: `border-color: var(--c-border-hi); color: var(--c-text-1)`
- No gradient fills on any button, ever

---

### NAVIGATION SYSTEM

**Sidebar nav items:**

- Inactive: `color: var(--c-text-2)`, transparent background
- Hover: `background: var(--c-card)`
- Active: `background: var(--c-accent-lo); color: var(--c-accent); font-weight: 500`
- Active indicator: `position: absolute; left: 0; top: 20%; bottom: 20%; width: 2px; border-radius: 1px; background: var(--c-accent)` — this is the wing motif carried into nav
- Count chips: Geist Mono, `font-size: 10px`, `border-radius: 4px`

---

### MOTION RULES

- **Entrance animations:** staggered `translateY(14px) → 0` with `opacity: 0 → 1`, delay increment 60ms per item, duration 500ms, easing `cubic-bezier(0.16,1,0.3,1)`
- **Hover transitions:** `border-color .2s`, `background .2s` — nothing else
- **Theme toggle:** `transition: background-color .3s, color .3s` on `body`
- **Pulsing dots:** `@keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0.4 } }` — 2–2.5s, ease
- **No bounce, no spring physics, no scale transforms on cards**
- One well-orchestrated page load with staggered reveals beats scattered micro-interactions

---

### BODY BACKGROUND

```css
body {
  background-color: var(--c-bg);
  background-image:
    radial-gradient(ellipse 70% 50% at 15% -5%, var(--c-body-grad-a) 0%, transparent 65%),
    radial-gradient(ellipse 55% 45% at 85% 105%, var(--c-body-grad-b) 0%, transparent 60%);
}
```

These are the only background gradients on the page. They are radial, corner-anchored, and atmospheric — they simulate ambient light in the scene. Do not add more.

---

### LAYOUT SYSTEM

```
┌─────────────────────────────────────────────────────┐
│ TOPBAR (height: 52px, sticky, z-index: 200)         │
├──────────────┬──────────────────────────────────────┤
│ SIDEBAR      │ MAIN CONTENT                         │
│ (width: 220px│ (max-width: 820px, padding: 28px 32px│
│  sticky)     │  for feed screens)                   │
└──────────────┴──────────────────────────────────────┘
```

- Topbar: `background: var(--c-surface)`, `border-bottom: 1px solid var(--c-border)`
- Sidebar: `background: var(--c-surface)`, `border-right: 1px solid var(--c-border)`
- Logo area in topbar: `width: 220px` (matches sidebar), `border-right: 1px solid var(--c-border)` — creates visual column alignment

---

### WHAT NOT TO DO

These are the specific patterns that make UI look AI-generated. Treat them as hard bans.

1. **No purple** — anywhere, in any form. Not as accent, not as gradient, not in shadows.
1. **No Inter or system-ui** as the display font.
1. **No heavy drop shadows** (`blur > 8px` on cards) — especially on dark mode where they vanish.
1. **No gradient buttons** — solid fill only.
1. **No card lift on hover** (`transform: translateY`) — cards expand, they don’t float.
1. **No `::before`/`::after` for border-radius-dependent visual effects** — use real DOM elements or `box-shadow`. Safari clips pseudo-elements inconsistently.
1. **No `/day` in `--c-text-3`** — rate periods are `--c-text-2` at `opacity: 0.6`. Not invisible, just subordinate.
1. **No evenly-distributed colour palettes** — dominant surfaces with sharp accent moments.
1. **No decorative gradients that cross hue families.**
1. **No scattered micro-interactions** — one entrance animation per screen, hover states are border changes only.

---

### REFERENCE COMPONENT — JOB CARD

When in doubt about any styling decision, refer to this component as the canonical pattern. All other components should feel like they came from the same design system as this card.

```tsx
// JobCard.tsx — canonical reference component
interface JobCardProps {
  title: string;
  vesselName: string;
  vesselSize: string;
  builder: string;
  prefix: string; // 'MY' | 'SY' | 'GS' etc
  rate: number;
  location: string;
  engine: string;
  cert: string;
  rotation: string;
  status: 'open' | 'filling' | 'invite' | 'closed';
  postedAt: string;
  applicantCount: number;
  featured?: boolean;
  urgent?: boolean;
}
```

The card renders:

- Featured variant: left accent bar, `--c-featured-border`, `--c-featured-bg`
- Urgent variant: amber border tint + urgency ribbon (absolute, top-right, `border-radius: 4px`)
- Hover: `border-color: var(--c-border-hi)` only
- Selected/expanded: `border-color: var(--c-accent)` + `background: var(--c-card-hover)`
