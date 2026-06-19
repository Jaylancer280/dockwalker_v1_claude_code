# Responsive Redesign Spec — DockWalker Web App

> **Status:** IMPLEMENTED — Stages 178-184 (2026-04-03). Retained as architectural reference.
> **Scope:** Make the web app responsive across phone, tablet, and desktop. Mobile remains the primary experience. Desktop adds space, not complexity.
> **Authority:** This spec is the single source of truth for responsive layout work. The implementation agent follows it exactly.

---

## 1. Current State (Exhaustive Audit)

The app is locked to a 512px-wide mobile strip on every viewport. There is zero responsive scaling — not a single `md:`, `lg:`, or `xl:` breakpoint class exists in any page file. Below is the complete inventory of layout assumptions baked into the codebase.

### 1.1 max-w-lg Usage (54 occurrences across 32 files)

Every page and most layout-critical components use `max-w-lg` (Tailwind default: 32rem / 512px). Usage falls into three distinct patterns:

**Pattern A — Sticky headers (19 files):**

```tsx
<header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]">
  <div className="mx-auto flex max-w-lg items-center justify-between px-4 pt-3 pb-2">
```

Used in: discover, messages, messages/[id], notifications, profile, settings, billing, vessels, vessels/[id]/edit, add-experience, edit-experience/[id], daywork/post, daywork/mine, daywork/[id]/review, permanent/[id]/review, discover/market, docky, docky/[id].

**Pattern B — Content wrappers (17 files):**

```tsx
<div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-4 py-4">
```

Used in: same pages as Pattern A (most pages have both a header and content max-w-lg).

**Pattern C — Component-level constraints (8 files):**

```tsx
// bottom-nav.tsx inner div
<div className="mx-auto flex h-[var(--nav-height)] max-w-lg items-center justify-around">

// bottom-sheet.tsx, profile-overlay.tsx, availability-overlay.tsx
<div className="w-full max-w-lg ...">

// chat-header.tsx, chat-footer.tsx, message-list.tsx
<div className="mx-auto max-w-lg ...">
```

**Pattern D — Landing page sections (1 file):**

```tsx
// page.tsx (landing) — value props + how-it-works sections
<div className="mx-auto max-w-lg px-6 ...">
```

**Critical:** A mechanical find-replace will NOT work. Pattern C files (overlays, bottom-sheet, chat sub-components) should NOT get the wider desktop treatment — overlays should remain constrained or get their own responsive treatment. Each file must be classified and handled according to its pattern.

### 1.2 Fixed Positioning (8 elements)

| Component                  | Position                        | z-index | Nav-height aware?           | Safe-area aware?    | Desktop issue                               |
| -------------------------- | ------------------------------- | ------- | --------------------------- | ------------------- | ------------------------------------------- |
| `bottom-nav.tsx`           | `fixed bottom-0 left-0 right-0` | z-50    | Yes (h-[var(--nav-height)]) | Yes (pb-[env(...)]) | Must hide on desktop                        |
| `bottom-sheet.tsx`         | `fixed inset-0` (backdrop)      | z-[60]  | Yes (inline calc)           | Yes                 | Needs `md:left-[var(--content-inset-left)]` |
| `dialog.tsx`               | `fixed top-[50%] left-[50%]`    | z-50    | No                          | No                  | Portal to body — needs CSS var centering    |
| `toast-container.tsx`      | `fixed bottom-20 left-1/2`      | z-[60]  | **NO**                      | **NO**              | Needs CSS var centering + nav offset        |
| `profile-overlay.tsx`      | `fixed inset-0`                 | z-[60]  | Yes (inline calc)           | Yes                 | Needs sidebar offset                        |
| `availability-overlay.tsx` | `fixed inset-0`                 | z-[60]  | Yes (inline calc)           | Yes                 | Needs sidebar offset                        |
| `image-cropper.tsx`        | `fixed inset-0`                 | z-[60]  | **NO**                      | Partial (pb-safe)   | Needs sidebar offset, landscape handling    |
| `permanent-job-detail.tsx` | `fixed inset-0`                 | z-50    | **NO**                      | **NO**              | Full-screen modal — needs sidebar offset    |

**Finding missed in original spec:** `permanent-job-detail.tsx` is a full-screen fixed modal at z-50 that blocks all navigation. The toast-container ignores both nav-height and safe-area-inset, using a hardcoded `bottom-20` (5rem).

### 1.3 Sticky Headers (19 elements)

All pages use `sticky top-0` with varying z-indexes:

| z-index | Pages                                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------- |
| z-10    | messages, notifications, settings, vessels, vessels/edit, add-experience, edit-experience, daywork/mine, daywork/review |
| z-20    | permanent/review (uses `<div>` not `<header>`)                                                                          |
| z-30    | discover (bumped due to card stack overlap)                                                                             |
| z-40    | docky, docky/[id], billing                                                                                              |

**Problem:** z-index values are inconsistent — there's no documented scale. The discover page header was bumped from z-10 to z-30 as a bugfix (Stage 117). This needs normalisation.

### 1.4 Hardcoded Pixel/Viewport Values

| File                        | Value                                                            | Purpose                     | Desktop issue                                        |
| --------------------------- | ---------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- |
| `daywork-browse.tsx`        | `h-[420px]`                                                      | Card stack container height | Too short on large screens, too tall on small phones |
| `daywork-card.tsx`          | `SWIPE_THRESHOLD = 100` (px)                                     | Swipe trigger distance      | Not proportional to card width                       |
| `daywork-card.tsx`          | `animate(x, 400, ...)` / `animate(x, -400, ...)`                 | Exit animation distance     | Not proportional                                     |
| `daywork-card.tsx`          | `useTransform(x, [-200, 200], [-15, 15])`                        | Card rotation range         | Not proportional                                     |
| `daywork-card.tsx`          | `scale-[0.97]`                                                   | Preview card scale          | Fine                                                 |
| `message-list.tsx`          | `max-w-[80%]`                                                    | Message bubble width        | 80% of a 1024px container = 819px — absurdly wide    |
| `chat-header.tsx`           | `w-52` (208px)                                                   | Action menu dropdown        | Overflow risk on small screens, fine on desktop      |
| `profile-overlay.tsx`       | `max-h-[calc(85vh-var(--nav-height,4rem))]`                      | Overlay max height          | Desktop: 85vh is more than needed                    |
| `availability-overlay.tsx`  | `max-h-[55vh]`                                                   | Calendar section height     | Fine                                                 |
| `posting-type-selector.tsx` | `min-h-[60vh]`                                                   | Choice screen height        | Fine                                                 |
| `messages/[id]/page.tsx`    | `h-[calc(100svh-var(--nav-height)-env(safe-area-inset-bottom))]` | Chat viewport height        | Desktop: no bottom nav, calc wrong                   |
| `billing/page.tsx`          | `min-h-screen`                                                   | Page height                 | Inconsistent with all other pages using `min-h-svh`  |
| `push-toast.tsx`            | `z-[9999]`                                                       | Push notification toast     | Absurdly high, will overlay everything               |
| Landing page                | `112x112` icon, `400x224` images                                 | Hero assets                 | Need responsive sizing                               |

### 1.5 Viewport Meta Tag

```tsx
// layout.tsx
viewport: {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,   // ← Prevents pinch-to-zoom
  viewportFit: 'cover',
}
```

`userScalable: false` and `maximumScale: 1` are appropriate for a mobile app but hostile to desktop accessibility. Desktop users expect to zoom. This should be changed.

### 1.6 App Layout Wrapper

```tsx
// (app)/layout.tsx
<ToastWrapper>
  <LookupsProvider>
    <NotificationCountsProvider>
      <OfflineBanner />
      <div className="pb-nav">{children}</div>
      <BottomNav currentHat={person.current_hat} identityType={person.identity_type} />
    </NotificationCountsProvider>
  </LookupsProvider>
</ToastWrapper>
```

The `pb-nav` class adds `padding-bottom: calc(var(--nav-height) + env(safe-area-inset-bottom))` (~80px) to ALL content. On desktop with a sidebar (no bottom nav), this is wasted space.

### 1.7 matchMedia Usage (No Layout Queries)

Only used for:

- `prefers-color-scheme: dark` (theme-provider.tsx, root layout.tsx)
- `prefers-reduced-motion: reduce` (daywork-browse.tsx, messages/page.tsx, permanent-job-feed.tsx)

No `window.innerWidth`, `resize` listeners, or `screen.width` usage found. The codebase is CSS-only for layout — good for the responsive approach.

### 1.8 Z-Index Inventory

Current z-index usage is scattered and undocumented:

| z-index  | Element                                                                             | Context                          |
| -------- | ----------------------------------------------------------------------------------- | -------------------------------- |
| z-10     | Most sticky headers                                                                 | Standard header layer            |
| z-20     | Permanent review header, chat menu dropdown, swipe indicators                       | Mid-layer UI                     |
| z-30     | Discover header                                                                     | Bumped to avoid card overlap     |
| z-40     | Docky headers, billing header                                                       | No clear reason for higher value |
| z-50     | Bottom nav, dialog overlay/content, permanent-job-detail                            | Navigation + modal layer         |
| z-[60]   | Bottom-sheet, toast-container, profile-overlay, availability-overlay, image-cropper | Overlay layer                    |
| z-[9999] | Push toast (push-toast.tsx)                                                         | Emergency notification           |

---

## 2. Design Principles

1. **Mobile-first, desktop-enhanced.** Mobile layout must not regress. Desktop adds space, not complexity.
2. **No component duplication.** One component, responsive via breakpoints. Never `<MobileCard>` + `<DesktopCard>`.
3. **CSS-only breakpoints.** No `useMediaQuery` hooks for layout. Tailwind responsive prefixes (`md:`, `lg:`) only.
4. **Incremental delivery.** Each phase is independently shippable. No big-bang merge.
5. **No new dependencies.** Pure Tailwind CSS. No CSS-in-JS, no media query libraries.

---

## 3. Breakpoint Strategy

| Breakpoint | Width     | Layout                                                                    |
| ---------- | --------- | ------------------------------------------------------------------------- |
| Default    | < 768px   | Current mobile layout (bottom nav, single column, max-w-lg)               |
| `md:`      | >= 768px  | Sidebar nav appears, content widens to max-w-3xl, bottom nav hides        |
| `lg:`      | >= 1024px | Multi-column content where appropriate (messages split-panel, card grids) |
| `xl:`      | >= 1280px | Max content width capped at max-w-5xl to prevent infinite stretch         |

---

## 4. Architecture Decisions

### 4.1 Sidebar vs Top Nav

**Decision: Left sidebar on desktop (`>= md`).**

Rationale: Bottom nav items map directly to sidebar links. A top nav would require horizontal space allocation and dropdown menus — more complexity for no UX gain. Sidebar is the standard pattern for dashboard-style apps.

### 4.2 CSS Utility Classes, Not Wrapper Components

**Decision: CSS utility classes in `globals.css` for width control.**

A `<PageContainer>` wrapper component would break sticky headers — sticky needs the scroll container as its ancestor, not an intervening wrapper div. The current DOM structure has headers and content as siblings inside `<main>`, and sticky positioning works because `<main>` is the scroll container.

### 4.3 Radix Dialog Portal Handling

**Decision: CSS variables on `:root` for centering.**

Dialog uses `DialogPrimitive.Portal` which renders to `document.body`. Container-based CSS fixes won't work because the Dialog escapes its parent entirely. CSS variables on `:root` are inherited by Portal children — this is the only approach that works without forking Radix.

### 4.4 Z-Index Normalisation

**Decision: Documented z-index scale.**

```
z-10  — Sticky headers (standard)
z-20  — Sticky headers (elevated, e.g., above card stacks)
z-30  — Sidebar nav (desktop)
z-40  — Bottom nav (mobile)
z-50  — Modal overlays (backdrop)
z-60  — Modal content (sheets, overlays, dialogs)
z-70  — Toast notifications
z-80  — Push notification toast (system-level)
```

This replaces the current ad-hoc system. Changes required during Phase 0.

---

## 5. CSS Foundation (globals.css additions)

These CSS additions are the prerequisite for all responsive work:

```css
/* === RESPONSIVE LAYOUT SYSTEM === */

:root {
  --sidebar-width: 16rem; /* 256px */
  --content-inset-left: 0px; /* 0 on mobile, sidebar-width on desktop */
}

@media (min-width: 768px) {
  :root {
    --content-inset-left: var(--sidebar-width);
  }

  .pb-nav {
    padding-bottom: 0; /* No bottom nav padding on desktop */
  }
}

/* Width utility classes — replace max-w-lg across the codebase */
.page-width {
  margin-left: auto;
  margin-right: auto;
  max-width: 32rem; /* Same as max-w-lg on mobile */
}
@media (min-width: 768px) {
  .page-width {
    max-width: 48rem; /* max-w-3xl on tablet */
  }
}
@media (min-width: 1024px) {
  .page-width {
    max-width: 56rem; /* max-w-4xl on desktop */
  }
}

/* For content that should stay narrow on all viewports (auth forms, overlays) */
.page-width-narrow {
  margin-left: auto;
  margin-right: auto;
  max-width: 32rem; /* Always max-w-lg */
}

/* For content that benefits from extra width (messages split-panel, grids) */
.page-width-wide {
  margin-left: auto;
  margin-right: auto;
  max-width: 32rem;
}
@media (min-width: 768px) {
  .page-width-wide {
    max-width: 64rem; /* max-w-5xl on tablet */
  }
}
@media (min-width: 1024px) {
  .page-width-wide {
    max-width: 72rem; /* max-w-6xl on desktop */
  }
}
```

---

## 6. Phases

Ordered by **user journey priority**: what does a new user see first?

### Phase 0 — Foundation (BLOCKING)

> Nothing else starts until Phase 0 is complete and verified.

#### 0a. CSS Variables + Width Utilities

Add the CSS from Section 5 to `globals.css`. This is the foundation every other change depends on.

**File:** `apps/web/src/app/globals.css`

#### 0b. Z-Index Normalisation

Align all z-index values to the scale in Section 4.4. Changes:

| File                       | Current  | New                             | Reason                              |
| -------------------------- | -------- | ------------------------------- | ----------------------------------- |
| `bottom-nav.tsx`           | z-50     | z-40                            | Nav layer, below modals             |
| `dialog.tsx` (overlay)     | z-50     | z-50                            | Modal overlay layer                 |
| `dialog.tsx` (content)     | z-50     | z-60                            | Modal content above overlay         |
| `bottom-sheet.tsx`         | z-[60]   | z-50 (backdrop), z-60 (sheet)   | Split backdrop/content              |
| `profile-overlay.tsx`      | z-[60]   | z-50 (backdrop), z-60 (content) | Split backdrop/content              |
| `availability-overlay.tsx` | z-[60]   | z-50 (backdrop), z-60 (content) | Split backdrop/content              |
| `image-cropper.tsx`        | z-[60]   | z-60                            | Modal content layer                 |
| `permanent-job-detail.tsx` | z-50     | z-60                            | Full-screen modal content           |
| `toast-container.tsx`      | z-[60]   | z-70                            | Above modals                        |
| `push-toast.tsx`           | z-[9999] | z-80                            | System-level, but sane              |
| All z-10 headers           | z-10     | z-10                            | Keep (standard)                     |
| `discover/page.tsx` header | z-30     | z-20                            | Above cards but below nav           |
| `docky` headers            | z-40     | z-10                            | No reason for elevation             |
| `billing` header           | z-40     | z-10                            | No reason for elevation             |
| `permanent/review` header  | z-20     | z-10                            | Standardise with other review pages |

#### 0c. Viewport Meta Tag

Change `userScalable` to allow zoom on desktop:

**File:** `apps/web/src/app/layout.tsx`

```tsx
viewport: {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,         // was 1
  userScalable: true,       // was false
  viewportFit: 'cover',
}
```

This doesn't affect mobile behaviour (mobile browsers ignore this for pinch-to-zoom on most modern browsers), but it respects desktop accessibility.

#### 0d. Create `<SidebarNav>` Component

**New file:** `apps/web/src/components/sidebar-nav.tsx`

Structure:

```tsx
// Hidden on mobile, visible on desktop
<aside className="fixed left-0 top-0 bottom-0 z-30 hidden w-[var(--sidebar-width)] flex-col border-r border-[var(--border)] bg-[var(--sidebar)] md:flex">
  {/* Logo / app name at top */}
  <div className="px-4 py-4">
    <span className="text-lg font-semibold text-[var(--sidebar-foreground)]">DockWalker</span>
  </div>

  {/* Navigation items — same as bottom-nav, role-conditional */}
  <nav className="flex flex-1 flex-col gap-1 px-3">
    {items.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm ..."
      >
        <item.icon className="h-5 w-5" />
        {item.label}
        {item.badge && <Badge />}
      </Link>
    ))}
  </nav>

  {/* Bottom section: hat switcher, notification bell, sign out */}
  <div className="border-t border-[var(--border)] px-3 py-3">
    <HatSwitcher />
    <NotificationBell />
    <SignOutButton />
  </div>
</aside>
```

**Props:** Same as BottomNav — `currentHat: string`, `identityType: string`.

**Nav items:**

- **Crew:** Discover, Messages (badge), Docky, Profile
- **Employer/Agent:** Post Job, My Jobs, Messages (badge), Profile
- **Common footer:** Hat Switcher (with alt-hat badge), Notification Bell (with badge), Sign out

#### 0e. Update `<BottomNav>` — Hide on Desktop

**File:** `apps/web/src/components/bottom-nav.tsx`

Add `md:hidden` to the outer `<nav>` element:

```tsx
<nav className="fixed bottom-0 left-0 right-0 z-40 border-t ... md:hidden">
```

#### 0f. Update App Layout

**File:** `apps/web/src/app/(app)/layout.tsx`

```tsx
<ToastWrapper>
  <LookupsProvider>
    <NotificationCountsProvider>
      <OfflineBanner />
      <SidebarNav currentHat={person.current_hat} identityType={person.identity_type} />
      <div className="pb-nav md:ml-[var(--sidebar-width)] md:pb-0">{children}</div>
      <BottomNav currentHat={person.current_hat} identityType={person.identity_type} />
    </NotificationCountsProvider>
  </LookupsProvider>
</ToastWrapper>
```

The `md:ml-[var(--sidebar-width)]` pushes content right on desktop. The `md:pb-0` overrides the bottom nav padding (also handled in the CSS `.pb-nav` media query — belt and braces).

#### 0g. Fix Viewport-Positioned Components

All `fixed` components must offset by `--content-inset-left` on desktop so they render inside the content area, not behind the sidebar.

**dialog.tsx** — Radix Portal renders to `document.body`, so we use CSS variables:

Overlay:

```tsx
className="fixed inset-0 z-50 bg-black/50 ..."
style={{ left: 'var(--content-inset-left)' }}
```

Content (centred within content area, not viewport):

```tsx
className="fixed z-60 grid w-full max-w-[calc(100%-2rem)] translate-y-[-50%] sm:max-w-lg ..."
style={{
  top: '50%',
  left: 'calc(var(--content-inset-left) + (100vw - var(--content-inset-left)) / 2)',
  transform: 'translateX(-50%) translateY(-50%)',
}}
```

**toast-container.tsx** — Not a Portal, but same centering logic needed:

```tsx
className="fixed z-70 ..."
style={{
  bottom: 'calc(var(--nav-height, 4rem) + env(safe-area-inset-bottom, 0px) + 0.5rem)',
  left: 'calc(var(--content-inset-left) + (100vw - var(--content-inset-left)) / 2)',
  transform: 'translateX(-50%)',
}}
```

This also fixes the existing bug where `bottom-20` ignores nav-height and safe-area-inset.

Add a media query override for desktop (no bottom nav):

```css
@media (min-width: 768px) {
  /* On desktop, toast sits near the bottom of the content area, no nav offset */
  /* Handled by the calc — --nav-height is still 4rem but that's fine, gives margin */
}
```

Actually simpler: on desktop, position near the bottom without nav offset:

```tsx
// Add responsive bottom
className = 'fixed z-70 md:bottom-6 ...';
```

And keep the `style` for horizontal centering.

**bottom-sheet.tsx, profile-overlay.tsx, availability-overlay.tsx:**

These all have `fixed inset-0` on their backdrop. Add sidebar offset:

```tsx
// Backdrop
className = 'fixed inset-0 z-50 ... md:left-[var(--content-inset-left)]';

// Sheet container (already has inline style for bottom calc)
// Add: md:left-[var(--content-inset-left)] to the sheet wrapper
```

**image-cropper.tsx:**

```tsx
className = 'fixed inset-0 z-60 ... md:left-[var(--content-inset-left)]';
```

**permanent-job-detail.tsx:**

```tsx
className = 'fixed inset-0 z-60 ... md:left-[var(--content-inset-left)]';
```

**push-toast.tsx:**

```tsx
// Change z-[9999] to z-80
className="fixed left-2 right-2 top-2 z-80 ..."
// Add sidebar offset
style={{ marginLeft: 'var(--content-inset-left, 0px)' }}
```

#### 0h. Hide Duplicate Navigation Elements on Desktop

Three pages render `NotificationBell` or `HatSwitcher` inline in their headers. Since the sidebar has these, hide them on desktop:

| Page                | Component                                    | Fix                                    |
| ------------------- | -------------------------------------------- | -------------------------------------- |
| `discover/page.tsx` | `NotificationBell` in header                 | Wrap in `<span className="md:hidden">` |
| `messages/page.tsx` | `NotificationBell` in header                 | Wrap in `<span className="md:hidden">` |
| `profile/page.tsx`  | `HatSwitcher` + `NotificationBell` in header | Wrap in `<span className="md:hidden">` |

Back buttons (present on ~14 pages) should **remain** on desktop — they serve hierarchical navigation, not primary navigation.

#### 0i. Fix Swipe Animation Proportions

**File:** `apps/web/src/app/(app)/discover/_components/daywork-card.tsx`

Make swipe thresholds proportional to container width:

```tsx
const containerRef = useRef<HTMLDivElement>(null);

const getContainerWidth = () => containerRef.current?.offsetWidth ?? 300;
const SWIPE_RATIO = 0.33; // 33% of card width to trigger
const EXIT_RATIO = 1.3; // 130% of card width for exit animation
const ROTATION_RATIO = 0.67; // rotation maps to 67% of card width

// In drag handler:
const threshold = getContainerWidth() * SWIPE_RATIO;
const exitDistance = getContainerWidth() * EXIT_RATIO;

// Replace:
// animate(x, 400, ...) → animate(x, exitDistance, ...)
// animate(x, -400, ...) → animate(x, -exitDistance, ...)

// Replace useTransform ranges:
const rotateRange = getContainerWidth() * ROTATION_RATIO;
const rotate = useTransform(x, [-rotateRange, rotateRange], [-15, 15]);
const applyOpacity = useTransform(x, [0, threshold], [0, 1]);
const passOpacity = useTransform(x, [-threshold, 0], [1, 0]);
```

Add `ref={containerRef}` to the card container div.

**Also in `daywork-browse.tsx`:** The card stack container height `h-[420px]` should remain for now — it works on mobile and the cards will be width-constrained on desktop (see Phase 3). If it feels wrong on larger screens, it can be updated to `h-[420px] md:h-[500px] lg:h-[560px]` but start without and verify visually.

#### 0j. Fix Billing Page Inconsistency

**File:** `apps/web/src/app/(app)/billing/page.tsx`

Change `min-h-screen` to `min-h-svh` for consistency with all other pages.

#### 0k. max-w-lg Migration (Mechanical)

Replace `max-w-lg` with the appropriate CSS utility class in each file. This is the largest single change in Phase 0.

**Classification key:**

- **`page-width`** — standard pages that should widen on desktop
- **`page-width-narrow`** — content that should stay narrow (auth, overlays)
- **`page-width-wide`** — content that benefits from extra width (messages, grids)
- **KEEP** — component-level constraints that should not change

| File                                           | Occurrences | Class             | Notes                                   |
| ---------------------------------------------- | ----------- | ----------------- | --------------------------------------- |
| **Page headers (Pattern A)**                   |             |                   |                                         |
| `discover/page.tsx` header inner               | 1           | `page-width`      |                                         |
| `discover/market/page.tsx` header              | 2           | `page-width`      |                                         |
| `messages/page.tsx` header                     | 2           | `page-width`      | Tab line also has max-w-lg              |
| `notifications/page.tsx` header                | 1           | `page-width`      |                                         |
| `profile/page.tsx` header                      | 1           | `page-width`      |                                         |
| `settings/page.tsx` header                     | 1           | `page-width`      |                                         |
| `billing/page.tsx` header                      | 1           | `page-width`      |                                         |
| `vessels/page.tsx` header                      | 1           | `page-width`      |                                         |
| `vessels/[id]/edit/page.tsx` header            | 1           | `page-width`      |                                         |
| `add-experience/page.tsx` header               | 1           | `page-width`      |                                         |
| `edit-experience/[id]/page.tsx` header         | 1           | `page-width`      |                                         |
| `daywork/post/page.tsx` header                 | 1           | `page-width`      |                                         |
| `daywork/mine/page.tsx` header                 | 1           | `page-width`      |                                         |
| `daywork/[id]/review/page.tsx` header          | 1           | `page-width`      |                                         |
| `permanent/[id]/review/page.tsx` header        | 1           | `page-width`      |                                         |
| `docky/page.tsx` outer                         | 1           | `page-width`      | Uses mx-auto max-w-lg as page wrapper   |
| `docky/[id]/page.tsx` header                   | 1           | `page-width`      |                                         |
| **Page content (Pattern B)**                   |             |                   |                                         |
| `discover/page.tsx` content                    | 1           | `page-width`      |                                         |
| `discover/market/page.tsx` content             | 1           | `page-width`      |                                         |
| `messages/page.tsx` content                    | 1           | `page-width-wide` | Will become split-panel                 |
| `notifications/page.tsx` content               | 1           | `page-width`      |                                         |
| `profile/page.tsx` content                     | 1           | `page-width`      |                                         |
| `settings/page.tsx` content                    | 1           | `page-width`      |                                         |
| `billing/page.tsx` content                     | 1           | `page-width`      |                                         |
| `vessels/page.tsx` content                     | 1           | `page-width`      |                                         |
| `vessels/[id]/edit/page.tsx` content           | 1           | `page-width`      |                                         |
| `add-experience/page.tsx` content              | 1           | `page-width`      |                                         |
| `edit-experience/[id]/page.tsx` content        | 1           | `page-width`      |                                         |
| `daywork/post/page.tsx` content                | 1           | `page-width`      |                                         |
| `daywork/mine/page.tsx` content                | 3           | `page-width`      | Multiple content sections               |
| `daywork/[id]/review/page.tsx` content         | 2           | `page-width`      |                                         |
| `permanent/[id]/review/page.tsx` content       | 3           | `page-width`      |                                         |
| **Component-level (Pattern C) — DO NOT WIDEN** |             |                   |                                         |
| `bottom-nav.tsx` inner                         | 1           | KEEP              | Nav stays max-w-lg                      |
| `bottom-sheet.tsx` sheet                       | 1           | KEEP              | Overlay stays narrow                    |
| `profile-overlay.tsx` sheet                    | 1           | KEEP              | Overlay stays narrow                    |
| `availability-overlay.tsx` sheet               | 1           | KEEP              | Overlay stays narrow                    |
| `chat-header.tsx` inner                        | 1           | `page-width-wide` | Chat should widen                       |
| `chat-footer.tsx` inner                        | 1           | `page-width-wide` | Chat should widen                       |
| `message-list.tsx` inner                       | 1           | `page-width-wide` | Chat should widen                       |
| **Page-specific components (Pattern C)**       |             |                   |                                         |
| `daywork-browse.tsx` outer                     | 1           | `page-width`      |                                         |
| `permanent-job-feed.tsx` outer                 | 1           | `page-width`      |                                         |
| `permanent-job-detail.tsx` inner               | 1           | `page-width`      | Inside full-screen modal                |
| `applied-tab.tsx` outer                        | 1           | `page-width`      |                                         |
| `invitations-tab.tsx` outer                    | 1           | `page-width`      |                                         |
| `permanent-mine-section.tsx` outer             | 1           | `page-width`      |                                         |
| `permanent-post-form.tsx` outer                | 1           | `page-width`      |                                         |
| **Landing page (Pattern D)**                   |             |                   |                                         |
| `page.tsx` (landing) sections                  | 2           | `page-width-wide` | Marketing content should use full width |

**Implementation notes for the migration:**

- Search for `max-w-lg` in each file
- Verify the surrounding classes (some have `mx-auto max-w-lg`, others just `max-w-lg`)
- Replace `mx-auto max-w-lg` with the appropriate class (which includes `margin-left: auto; margin-right: auto`)
- For files that have `max-w-lg` WITHOUT `mx-auto`, add the class AND remove `max-w-lg`, but keep `mx-auto` is not needed since the utility class includes it
- **Do NOT touch files marked KEEP**

#### 0l. Message Bubble Width Cap

**File:** `apps/web/src/app/(app)/messages/[engagementId]/_components/message-list.tsx`

The `max-w-[80%]` on message bubbles becomes absurd on wide desktop layouts (80% of 1024px = 819px for a chat message). Cap it:

```tsx
// Replace: max-w-[80%]
// With: max-w-[80%] md:max-w-md
```

This keeps 80% on mobile (good) and caps at 28rem/448px on desktop (reasonable chat message width).

#### 0m. Chat Page Height Calculation

**File:** `apps/web/src/app/(app)/messages/[engagementId]/page.tsx`

The chat page uses:

```tsx
className = 'flex h-[calc(100svh-var(--nav-height)-env(safe-area-inset-bottom))] flex-col';
```

On desktop, there's no bottom nav, so the height should be the full viewport:

```tsx
className = 'flex h-[calc(100svh-var(--nav-height)-env(safe-area-inset-bottom))] md:h-svh flex-col';
```

### Phase 0 — Verification Checklist

Run these checks BEFORE moving to Phase 1:

- [ ] Mobile (375px): app looks identical to current — zero visual regression
- [ ] Desktop (1440px): sidebar visible, bottom nav hidden, content wider
- [ ] All 19 sticky headers still stick correctly at both widths
- [ ] Dialog opens centred in content area (not viewport centre) on desktop
- [ ] Toast appears centred in content area on desktop
- [ ] Bottom sheet slides up within content area on desktop
- [ ] Profile overlay appears within content area on desktop
- [ ] Image cropper appears within content area on desktop
- [ ] Permanent job detail modal appears within content area on desktop
- [ ] Swipe gesture feels proportional at both 375px and 900px widths
- [ ] Hat switcher works in sidebar
- [ ] Notification badges visible in sidebar
- [ ] NotificationBell/HatSwitcher hidden in page headers on desktop
- [ ] Back buttons still visible and functional on desktop
- [ ] Push toast notification appears above everything on both viewports
- [ ] No z-index overlap issues between modals and navigation

### Phase 0 — File List

| File                                                   | Action                                      | Priority           |
| ------------------------------------------------------ | ------------------------------------------- | ------------------ |
| `globals.css`                                          | Add CSS variables + width utilities         | First              |
| `layout.tsx` (root)                                    | Change viewport meta                        | First              |
| `(app)/layout.tsx`                                     | Add SidebarNav, update content wrapper      | First              |
| `components/sidebar-nav.tsx`                           | NEW — desktop nav                           | First              |
| `components/bottom-nav.tsx`                            | `md:hidden`, z-40                           | First              |
| `components/ui/dialog.tsx`                             | CSS var centering, z-60 content             | First              |
| `components/toast-container.tsx`                       | CSS var centering, z-70, fix bottom offset  | First              |
| `components/ui/bottom-sheet.tsx`                       | Sidebar offset, z-50/60 split               | First              |
| `components/profile-overlay.tsx`                       | Sidebar offset, z-50/60 split               | First              |
| `components/availability-overlay.tsx`                  | Sidebar offset, z-50/60 split               | First              |
| `components/image-cropper.tsx`                         | Sidebar offset, z-60                        | First              |
| `components/push-toast.tsx`                            | z-80, sidebar offset                        | First              |
| `discover/_components/permanent-job-detail.tsx`        | Sidebar offset, z-60                        | First              |
| `discover/_components/daywork-card.tsx`                | Proportional swipe values                   | Second             |
| `discover/_components/daywork-browse.tsx`              | No change yet (verify h-[420px] visually)   | Verify only        |
| `messages/[engagementId]/page.tsx`                     | Responsive height calc                      | Second             |
| `messages/[engagementId]/_components/message-list.tsx` | Message bubble max-width cap                | Second             |
| `billing/page.tsx`                                     | min-h-screen → min-h-svh                    | Second             |
| `discover/page.tsx`                                    | md:hidden on NotificationBell               | Second             |
| `messages/page.tsx`                                    | md:hidden on NotificationBell               | Second             |
| `profile/page.tsx`                                     | md:hidden on HatSwitcher + NotificationBell | Second             |
| 32+ files with max-w-lg                                | Replace per Section 0k table                | Third (mechanical) |
| All z-index files per Section 0b                       | Normalise per table                         | Woven into above   |

**Total: ~48 files touched (1 new, ~47 modified)**

---

### Phase 1 — Landing + Auth + Onboarding

> First impression for new users. Must look professional on desktop.

#### 1a. Landing Page (`page.tsx`)

The landing page has multiple sections using `max-w-lg` for inner content. On desktop, these should use the full width:

- Hero section: widen, possibly 2-column layout (text left, illustration right) on `lg:`
- Value props: 3 cards in a row on `md:` (currently stacked vertically)
- How it works: already uses `grid-cols-2` for images — widen the text steps
- CTA buttons: centre on mobile, left-align on desktop

**Key changes:**

```tsx
// Hero: text-center on mobile, text-left on desktop
className = 'text-center md:text-left md:flex md:items-center md:gap-12';

// Value props: flex-col on mobile, flex-row on md:
className = 'flex flex-col gap-4 md:flex-row md:gap-6';

// Widen sections from page-width to page-width-wide
```

The landing page is NOT inside the `(app)` layout, so it has no sidebar and no bottom nav. It doesn't need sidebar offsets.

#### 1b. Auth Pages (login, signup, forgot-password, reset-password)

These already use `max-w-sm` centred with `items-center justify-center`. This is fine on desktop — centred forms look correct at any viewport. No layout changes needed.

**One improvement:** Add a subtle background pattern or illustration behind the form card on desktop to fill the empty space:

```tsx
className =
  'flex min-h-svh flex-col items-center justify-center bg-background px-4 md:bg-[radial-gradient(...)]';
```

This is optional polish, not a structural change.

#### 1c. Onboarding Page

The onboarding flow is a multi-step wizard. Currently fullscreen single-column. On desktop, it should be a centred card with comfortable width:

```tsx
// Outer wrapper
className = 'mx-auto max-w-lg md:max-w-2xl md:py-12';
```

The step components themselves render forms — they should stay single-column even on desktop (forms are easier to fill vertically). The wider container just gives breathing room.

The `ProgressDots` component uses hardcoded sizes (`h-1.5`, `w-4`, `w-1.5`) — these are fine at any viewport.

### Phase 1 — File List

| File                            | Action                                            |
| ------------------------------- | ------------------------------------------------- |
| `page.tsx` (landing)            | Responsive hero, value props row, widen sections  |
| `auth/login/page.tsx`           | Optional background polish (no structural change) |
| `auth/signup/page.tsx`          | Optional background polish                        |
| `auth/forgot-password/page.tsx` | Optional background polish                        |
| `auth/reset-password/page.tsx`  | Optional background polish                        |
| `onboarding/page.tsx`           | Widen container on desktop                        |

---

### Phase 2 — Discover

> The core experience. First screen after onboarding.

#### 2a. Discover Page Layout

Mobile: unchanged (tab toggles, card stack or feed, full-width).
Desktop: content widens via `page-width`. Card stack stays constrained for swipe UX.

**Key constraint:** The daywork swipe cards must NOT stretch to fill wide desktop layouts. The swipe mechanic depends on a narrow card width. Constrain the card stack:

```tsx
// In daywork-browse.tsx, add max-width to card container
className = 'mx-auto w-full max-w-md ...'; // max-w-md = 28rem/448px
```

This keeps cards at a comfortable swipe width on desktop while the surrounding page widens. The action buttons (apply/pass) below the cards centre naturally.

#### 2b. Permanent Job Feed

Mobile: single-column scrollable feed.
Desktop (`lg:`): 2-column card grid.

```tsx
// In permanent-job-feed.tsx, change card list container
className = 'flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4';
```

#### 2c. Applied + Invitations Tabs

Mobile: single-column card list.
Desktop (`lg:`): 2-column card grid (same pattern as permanent feed).

```tsx
// In applied-tab.tsx and invitations-tab.tsx
className = 'flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4';
```

#### 2d. Filter Panel

Currently uses a Dialog component (modal) for filters. On desktop, consider making filters always-visible in a collapsible side panel. However, this is a significant layout change that can be deferred — the modal filter works fine on desktop.

**Decision: Keep modal filters for now. Revisit in a polish pass.**

### Phase 2 — File List

| File                                          | Action                                                            |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `discover/page.tsx`                           | Content widens (already handled by page-width class from Phase 0) |
| `discover/_components/daywork-browse.tsx`     | Constrain card stack to max-w-md                                  |
| `discover/_components/permanent-job-feed.tsx` | 2-column grid on lg:                                              |
| `discover/_components/applied-tab.tsx`        | 2-column grid on lg:                                              |
| `discover/_components/invitations-tab.tsx`    | 2-column grid on lg:                                              |

---

### Phase 3 — Profile

> Crew identity page. Important for first impression after signup.

#### 3a. Profile View

Mobile: single column, collapsible sections.
Desktop (`lg:`): 2-column layout — main content (left, wider) + quick stats sidebar (right, 300px).

Quick stats sidebar shows: avatar, name, career status, role, location, profile completeness indicator. This is a read-only summary that stays visible while scrolling the main content.

```tsx
<div className="lg:flex lg:gap-6">
  <div className="flex-1">{/* Main profile sections (about, experience, etc.) */}</div>
  <aside className="hidden lg:block lg:w-[300px] lg:sticky lg:top-16 lg:self-start">
    {/* Quick stats card */}
  </aside>
</div>
```

#### 3b. Profile Edit Form

Mobile: single column.
Desktop (`md:`): 2-column field grid where fields naturally pair (first name + last name, deck name + current role, etc.). Do NOT force all fields into 2-column — only pairs that make visual sense.

```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  <div>{/* First name */}</div>
  <div>{/* Last name */}</div>
</div>
<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  <div>{/* Deck name */}</div>
  <div>{/* Current role */}</div>
</div>
{/* Bio stays full-width */}
<div>{/* Bio textarea */}</div>
```

### Phase 3 — File List

| File                                              | Action                                          |
| ------------------------------------------------- | ----------------------------------------------- |
| `profile/page.tsx`                                | 2-column layout on lg:                          |
| `profile/_components/profile-edit-form.tsx`       | 2-column field grid on md: where appropriate    |
| `profile/_components/profile-summary-section.tsx` | Extract to quick stats card for desktop sidebar |

---

### Phase 4 — Messages

> Most impactful desktop improvement. Split-panel chat.

#### 4a. Messages List (`messages/page.tsx`)

Mobile: unchanged (full-width conversation list).
Desktop (`md:`): this page doesn't change structurally — it's a list that widens. The real improvement is in the chat page.

A true split-panel (list + chat side by side) requires a nested layout with route slots — this is a significant architectural change. **Defer to a polish pass.** For now, the conversation list simply widens.

#### 4b. Chat Page (`messages/[engagementId]/page.tsx`)

This is the single most complex page for responsive redesign.

Mobile: unchanged (full-height chat with bottom input).
Desktop (`lg:`): 2-column — message feed (left, flexible width) + engagement summary card + action buttons (right, 320px sticky panel).

On mobile, the summary card is at the top of the chat (collapsible). On desktop, it moves to the right panel alongside the action buttons (currently in the kebab menu).

```tsx
<main className="flex h-[calc(100svh-var(--nav-height)-env(safe-area-inset-bottom))] md:h-svh flex-col lg:flex-row">
  {/* Left: chat column */}
  <div className="flex flex-1 flex-col">
    <ChatHeader />
    <MessageList />
    <ChatFooter />
  </div>

  {/* Right: engagement info (desktop only) */}
  <aside className="hidden lg:flex lg:w-[320px] lg:flex-col lg:border-l lg:border-[var(--border)]">
    <DayworkSummaryCard /> {/* or PermanentSummaryCard */}
    <div className="flex flex-col gap-2 p-4">
      {/* Action buttons — extracted from kebab menu */}
      <Button>Mark complete</Button>
      <Button>Propose postponement</Button>
      <Button variant="destructive">Cancel engagement</Button>
    </div>
  </aside>
</main>
```

**The kebab menu should remain on mobile** (it's the correct pattern for small screens). On desktop, the same actions become visible buttons in the right panel. Use `md:hidden` on the kebab and `hidden lg:flex` on the right panel.

### Phase 4 — File List

| File                                                             | Action                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `messages/page.tsx`                                              | Content widens (handled by page-width-wide from Phase 0)           |
| `messages/[engagementId]/page.tsx`                               | 2-column layout on lg:, responsive height                          |
| `messages/[engagementId]/_components/chat-header.tsx`            | Hide kebab on desktop                                              |
| `messages/[engagementId]/_components/daywork-summary-card.tsx`   | Make responsive (collapsible on mobile, always-visible on desktop) |
| `messages/[engagementId]/_components/permanent-summary-card.tsx` | Same treatment                                                     |

---

### Phase 5 — My Jobs + Review

> Employer workflows.

#### 5a. My Jobs (`daywork/mine/page.tsx`)

Mobile: unchanged.
Desktop (`lg:`): Job cards in 2-column grid.

```tsx
// Active, in-progress, completed sections
className = 'flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4';
```

#### 5b. Daywork Review (`daywork/[id]/review/page.tsx`)

Mobile: unchanged (swipe card stack for applicants).
Desktop: constrain card stack to max-w-md (same as discover). Shortlist tab could show cards in a grid.

#### 5c. Permanent Review (`permanent/[id]/review/page.tsx`)

Mobile: unchanged.
Desktop (`lg:`): 2-column — applicant list (left) + shortlist panel (right, sticky).

### Phase 5 — File List

| File                                                  | Action                               |
| ----------------------------------------------------- | ------------------------------------ |
| `daywork/mine/page.tsx`                               | Card grid on lg:                     |
| `daywork/mine/_components/permanent-mine-section.tsx` | Card grid on lg:                     |
| `daywork/[id]/review/page.tsx`                        | Constrain card stack, grid shortlist |
| `permanent/[id]/review/page.tsx`                      | 2-column layout on lg:               |

---

### Phase 6 — Forms + Simple Pages

> Everything else.

#### 6a. Post Job (`daywork/post/page.tsx`)

Mobile: unchanged.
Desktop: widen form to comfortable reading width. 2-column field pairs where logical (same approach as profile edit).

#### 6b. Experience Forms (add-experience, edit-experience)

Same as post job — widen, 2-column field pairs.

#### 6c. Vessels Pages

Mobile: unchanged.
Desktop: vessel list + add form side by side on `lg:`.

#### 6d. Simple Pages

These already benefit from the `page-width` class applied in Phase 0:

| Page                              | Desktop Enhancement                                  |
| --------------------------------- | ---------------------------------------------------- |
| `settings/page.tsx`               | Left section nav + right content on `lg:` (optional) |
| `notifications/page.tsx`          | Wider list, no structural change                     |
| `billing/page.tsx`                | Plan cards side-by-side on `md:`                     |
| `docky/page.tsx`                  | Wider chat area                                      |
| `docky/[conversationId]/page.tsx` | Wider chat area                                      |

### Phase 6 — File List

| File                                               | Action                          |
| -------------------------------------------------- | ------------------------------- |
| `daywork/post/page.tsx`                            | Widen form, 2-column fields     |
| `daywork/post/_components/permanent-post-form.tsx` | 2-column fields                 |
| `profile/add-experience/page.tsx`                  | Widen form, 2-column fields     |
| `profile/edit-experience/[id]/page.tsx`            | Widen form, 2-column fields     |
| `vessels/page.tsx`                                 | Side-by-side list + form on lg: |
| `billing/page.tsx`                                 | Plan cards side-by-side on md:  |

---

## 7. Testing Strategy

### 7.1 Visual Regression (Per Phase)

After each phase, screenshot every affected page at three widths:

- 375px (iPhone SE — smallest supported)
- 768px (iPad portrait — sidebar trigger point)
- 1440px (standard desktop)

Compare before/after. Mobile screenshots must be **identical** to pre-redesign captures.

### 7.2 Manual Smoke Test Checklist (Phase 0)

These are the highest-risk interactions:

1. Open a Dialog (e.g., filter on discover) — verify centred in content area, not behind sidebar
2. Trigger a toast (e.g., submit an application) — verify centred in content area
3. Open profile overlay from discover card — verify doesn't extend behind sidebar
4. Open availability overlay — verify doesn't extend behind sidebar
5. Open bottom sheet (e.g., cancel engagement) — verify doesn't extend behind sidebar
6. Swipe a daywork card — verify gesture feels natural at 768px and 1440px
7. Open permanent job detail modal — verify doesn't extend behind sidebar
8. Open image cropper (upload avatar) — verify doesn't extend behind sidebar
9. Receive a push notification toast — verify appears above everything
10. Navigate using sidebar — verify all links work, active state highlights correctly
11. Switch hats using sidebar hat switcher — verify nav items update
12. Resize browser from 375px to 1440px — verify smooth transition at 768px breakpoint

### 7.3 Interaction Tests (Post-Phase 4)

The message page responsive layout has the most complex state. Verify:

- Chat scrolls correctly on desktop (flex-1 overflow)
- Real-time messages appear in both mobile and desktop layouts
- Action buttons in right panel trigger the same overlays as the kebab menu
- Summary card displays correctly in the right panel

---

## 8. What This Spec Does NOT Cover

- Dark mode changes (already works via CSS variables — responsive changes inherit)
- New features or functionality (responsive is layout-only)
- Performance optimisation (separate workstream)
- Mobile native app (parked — see mobile-web-split-spec.md)
- Accessibility audit beyond zoom (separate workstream)
- Print styles (not needed for v1)
- RTL support (not needed for v1 — target markets are LTR)

---

## 9. Risk Register

| Risk                                        | Likelihood | Impact | Mitigation                                                                           |
| ------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------ |
| Dialog centering with Radix Portal          | HIGH       | HIGH   | CSS variable on `:root` — Portal children inherit. Tested approach.                  |
| Toast centering off-centre on desktop       | HIGH       | MEDIUM | Same CSS variable approach as dialog                                                 |
| Swipe gesture feels different on desktop    | MEDIUM     | MEDIUM | Cap card width at max-w-md, proportional thresholds                                  |
| Sticky headers break inside flex layout     | LOW        | HIGH   | Verified: `sticky` works within flex children. No wrapper component.                 |
| Bottom sheet UX feels wrong on desktop      | MEDIUM     | LOW    | Keep as-is for now. Convert to side panel in polish pass.                            |
| Chat height calc wrong on desktop           | HIGH       | HIGH   | `md:h-svh` override drops nav-height deduction                                       |
| max-w-lg migration introduces bugs          | MEDIUM     | MEDIUM | File-by-file classification table prevents wrong class assignment                    |
| z-index changes break existing modals       | MEDIUM     | HIGH   | Document scale, test every modal type at Phase 0 verification                        |
| Sidebar covers content on tablet portrait   | LOW        | MEDIUM | 768px breakpoint gives 512px content area (768 - 256 sidebar). Tight but functional. |
| Push toast overlays sidebar                 | LOW        | MEDIUM | margin-left offset via CSS variable                                                  |
| Message bubbles too wide on desktop         | HIGH       | LOW    | max-w-md cap from Phase 0                                                            |
| 32-file max-w-lg migration introduces typos | MEDIUM     | LOW    | Use classification table, verify at 375px after each batch                           |
| Image cropper unusable in landscape         | MEDIUM     | LOW    | Sidebar offset sufficient; landscape is a pre-existing issue                         |

---

## 10. Execution Constraints

1. **Each phase is one PR.** No cross-phase dependencies except Phase 0.
2. **Mobile must not regress.** Test at 375px after every change.
3. **Test at 3 widths:** 375px, 768px, 1440px.
4. **No new dependencies.** Pure Tailwind responsive prefixes + CSS variables.
5. **Phase 0 is blocking.** No page work without the shell + fixed components.
6. **Phase ordering is fixed.** 0 → 1 → 2 → 3 → 4 → 5 → 6. Skip phases only with user approval.

---

## 11. Stress Test Log

**Test 1 (original spec, 2026-04-03):** Found 7 viewport-positioned components, hardcoded swipe pixels, 17 copy-pasted headers.

**Test 2 (original spec):** Found 3 plan-breaking issues:

1. Radix Dialog Portal — renders to `document.body`, escaping container. Fixed with CSS variable.
2. `<PageContainer>` breaks sticky headers — replaced with CSS utility classes.
3. Chat footer height calc — needs responsive variant.

**Test 3 (v3 revision, 2026-04-03):** Exhaustive codebase audit. Found 12 additional issues:

1. `permanent-job-detail.tsx` is a full-screen `fixed inset-0 z-50` modal — needs sidebar offset (missed in original spec).
2. `toast-container.tsx` uses hardcoded `bottom-20` — doesn't account for nav-height or safe-area-inset (existing bug).
3. `push-toast.tsx` uses `z-[9999]` — absurd, needs normalisation.
4. Z-index system is completely ad-hoc (z-10, z-20, z-30, z-40, z-50, z-[60], z-[9999]) — needs documented scale.
5. `message-list.tsx` uses `max-w-[80%]` for bubbles — 80% of 1024px = 819px, needs cap.
6. `billing/page.tsx` uses `min-h-screen` while all other pages use `min-h-svh` — inconsistency.
7. Viewport meta tag has `userScalable: false` — hostile to desktop accessibility.
8. `daywork-browse.tsx` has `h-[420px]` hardcoded card stack height — may need responsive variants.
9. `profile-overlay.tsx` has `max-h-[calc(85vh-var(--nav-height,4rem))]` — hardcoded vh percentage.
10. max-w-lg migration is NOT a simple find-replace — 54 occurrences across 3 distinct patterns, 8 of which should NOT be widened.
11. Original spec ordered phases by complexity (Messages first) instead of user journey (Landing first).
12. No testing strategy existed — added visual regression + manual smoke test + interaction test sections.
