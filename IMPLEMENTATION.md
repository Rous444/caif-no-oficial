# MediCare Design System — Implementation Plan

## Overview

**Scope**: Full redesign across all pages + shared dashboard layout refactor
**Library**: React Bits (via shadcn CLI) + framer-motion
**Timeline**: 7 phases, ordered by dependency

---

## Phase 1: Foundation

**Goal**: Set up animation library and update design tokens

### 1.1 Install Animation Dependencies

```bash
bun add framer-motion
```

### 1.2 Install React Bits Components (via shadcn CLI)

```bash
# Core animation wrappers
npx shadcn@latest add https://reactbits.dev/r/FadeIn-TS-TW
npx shadcn@latest add https://reactbits.dev/r/SplitText-TS-TW
npx shadcn@latest add https://reactbits.dev/r/AnimatedCounter-TS-TW
npx shadcn@latest add https://reactbits.dev/r/ShimmerButton-TS-TW

# Landing page statement pieces
npx shadcn@latest add https://reactbits.dev/r/GlowCard-TS-TW
npx shadcn@latest add https://reactbits.dev/r/ParallaxScroll-TS-TW
npx shadcn@latest add https://reactbits.dev/r/ShinyText-TS-TW
```

### 1.3 Update Design Tokens in `src/styles.css`

**Color changes (all `:root` variables):**

- `--background`: `#FFFFFF` (pure white, was blue-tinted)
- `--surface`: `#F8F9FA` (neutral grey)
- `--foreground`: `#1A1D21` (near-black)
- `--primary`: `#0F766E` (teal-700, was deep navy)
- `--secondary`: `#16A34A` (green-600, health accent)
- `--muted-foreground`: `#6B7280` (grey-500)
- `--border`: `#E5E7EB` (grey-200)
- `--ring`: `#0F766E` (teal, match primary)

**New hover-state tokens:**

- `--primary-hover`: `#115E59`
- `--secondary-hover`: `#15803D`
- `--surface-hover`: `#F1F3F5`
- `--destructive-hover`: `#B91C1C`

**Shadow utilities replaced:**

- Remove `shadow-elegant`, `shadow-card-hover`
- Add `shadow-soft`, `shadow-medium`, `shadow-elevated`
- Add `card-hover` utility class

---

## Phase 2: Component Library Updates

**Goal**: Update shadcn component variants to match new design system

### 2.1 Button Component

- Update `cva` variants for new color tokens
- Add `transition-all duration-150` and `active:scale-[0.98]` base styles

### 2.2 Card Component

- Remove default shadow, keep subtle border

### 2.3 Input Component

- Update focus states

---

## Phase 3: Layout Components

**Goal**: Update SiteHeader, SiteFooter, create shared DashboardLayout

### 3.1 SiteHeader

- Update to new color tokens, subtle transitions on nav links

### 3.2 SiteFooter

- Update to new color tokens

### 3.3 Create DashboardLayout (new file)

- Extract common patterns from dashboard/staff/admin pages
- Shared header with logo, title, user info, sign-out

---

## Phase 4: Landing Page Redesign

**Goal**: Apply new design system + add statement piece animations

### 4.1 Hero Section

- `FadeIn` wrappers for entrance animation
- `SplitText` for headline letter-animation
- `AnimatedCounter` for stats numbers

### 4.2 Specialties Grid

- Staggered `FadeIn` cards on scroll
- Replace `shadow-card-hover` with `card-hover`

### 4.3 Gallery

- `ParallaxScroll` wrapper for images
- Faster hover overlay transition

### 4.4 Contact

- `FadeIn` entrance
- Update icon container colors

---

## Phase 5: Authentication Pages

**Goal**: Update Login/Register with new design system

### 5.1 Login Page

- Update left panel gradient to new palette
- `FadeIn` form entrance

### 5.2 Register Page

- Mirror Login page changes

---

## Phase 6: Dashboard Pages

**Goal**: Refactor to shared DashboardLayout + apply new design system

### 6.1 Dashboard

- Replace inline header with `<DashboardLayout>`
- Update cards, buttons, `FadeIn` sections

### 6.2 Staff

- Replace inline header with `<DashboardLayout>`

### 6.3 Admin

- Replace inline header with `<DashboardLayout>`

---

## Phase 7: Polish & Accessibility

**Goal**: Final touches and accessibility audit

### 7.1 `prefers-reduced-motion` Support

- Create `useReducedMotion` hook

### 7.2 Focus Management

- Verify all interactive elements have visible focus states

### 7.3 Contrast Audit

- Verify WCAG AA for all text/background combinations

### 7.4 Touch Targets

- Ensure minimum 44x44px for all interactive elements

---

## Files Modified (total ~17)

| Phase | Files                                                                                                      |
| ----- | ---------------------------------------------------------------------------------------------------------- |
| 1     | `src/styles.css`, `package.json`                                                                           |
| 2     | `src/components/ui/button.tsx`, `card.tsx`, `input.tsx`                                                    |
| 3     | `SiteHeader.tsx`, `SiteFooter.tsx`, `DashboardLayout.tsx` (new), `dashboard.tsx`, `staff.tsx`, `admin.tsx` |
| 4     | `HomeSections.tsx`                                                                                         |
| 5     | `login.tsx`, `register.tsx`                                                                                |
| 6     | `dashboard.tsx`, `staff.tsx`, `admin.tsx` (refactor)                                                       |
| 7     | `use-reduced-motion.ts` (new)                                                                              |
