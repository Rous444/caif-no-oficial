# Design System — MediCare

This document serves as the design guide for the MediCare project, ensuring consistency across all UI components and pages.

## Color Palette

### Semantic Colors

| Variable               | Light Value | Description                        |
| ---------------------- | ----------- | ---------------------------------- |
| `--background`         | `#fafafa`   | Page background                    |
| `--foreground`         | `#1f2937`   | Primary text color                 |
| `--card`               | `#ffffff`   | Card backgrounds                   |
| `--card-foreground`    | `#1f2937`   | Card text                          |
| `--popover`            | `#ffffff`   | Popover backgrounds                |
| `--popover-foreground` | `#1f2937`   | Popover text                       |
| `--muted`              | `#f3f4f6`   | Muted backgrounds (badges, inputs) |
| `--muted-foreground`   | `#6b7280`   | Secondary/muted text               |
| `--border`             | `#e5e7eb`   | Border color                       |
| `--input`              | `#e5e7eb`   | Input borders                      |
| `--ring`               | `#0f766e`   | Focus ring color                   |

### Brand Colors

| Variable                   | Value     | Hex       | Usage                             |
| -------------------------- | --------- | --------- | --------------------------------- |
| `--primary`                | teal-700  | `#0f766e` | Primary actions, CTA buttons      |
| `--primary-foreground`     | -         | `#ffffff` | Text on primary backgrounds       |
| `--secondary`              | green-600 | `#16a34a` | Secondary actions, footer accents |
| `--secondary-foreground`   | -         | `#ffffff` | Text on secondary backgrounds     |
| `--teal`                   | teal-700  | `#0f766e` | Brand teal color                  |
| `--teal-foreground`        | -         | `#ffffff` | Text on teal backgrounds          |
| `--accent`                 | teal-500  | `#14b8a6` | Links, interactive elements       |
| `--accent-foreground`      | -         | `#0f172a` | Text on accent backgrounds        |
| `--destructive`            | red-600   | `#dc2626` | Error/danger states               |
| `--destructive-foreground` | -         | `#ffffff` | Text on destructive backgrounds   |

### Chart Colors (Data Visualization)

| Variable    | Value     | Hex |
| ----------- | --------- | --- |
| `--chart-1` | `#0f766e` |
| `--chart-2` | `#16a34a` |
| `--chart-3` | `#14b8a6` |
| `--chart-4` | `#a3e635` |
| `--chart-5` | `#f59e0b` |

### Sidebar Colors

| Variable                       | Value     | Description                 |
| ------------------------------ | --------- | --------------------------- |
| `--sidebar`                    | `#ffffff` | Sidebar background          |
| `--sidebar-foreground`         | `#1f2937` | Sidebar text                |
| `--sidebar-primary`            | `#0f766e` | Active sidebar item         |
| `--sidebar-primary-foreground` | `#ffffff` | Text on active sidebar item |
| `--sidebar-accent`             | `#f3f4f6` | Sidebar accent background   |
| `--sidebar-accent-foreground`  | `#1f2937` | Sidebar accent text         |
| `--sidebar-border`             | `#e5e7eb` | Sidebar borders             |
| `--sidebar-ring`               | `#0f766e` | Sidebar focus rings         |

### Surface

| Variable    | Value     | Description                  |
| ----------- | --------- | ---------------------------- |
| `--surface` | `#f5f5f5` | Elevated surface backgrounds |

## Typography

| Font    | Stack                                             | Usage                                              |
| ------- | ------------------------------------------------- | -------------------------------------------------- |
| Display | `DM Serif Display, Georgia, serif`                | Headings (`h1`, `h2`, `h3`, `h4`, `.font-display`) |
| Sans    | `Fira Sans, ui-sans-serif, system-ui, sans-serif` | Body text, UI elements                             |

### Typography Conventions

```css
/* Headings use font-display */
h1,
h2,
h3,
h4,
.font-display {
  font-family: var(--font-display);
  letter-spacing: -0.01em;
}
```

## Border Radius

All radii are calculated from a base `--radius` value of `0.875rem`:

| Variable       | Calculation                  | Result     |
| -------------- | ---------------------------- | ---------- |
| `--radius`     | base                         | `0.875rem` |
| `--radius-sm`  | `calc(var(--radius) - 4px)`  | `0.5rem`   |
| `--radius-md`  | `calc(var(--radius) - 2px)`  | `0.625rem` |
| `--radius-lg`  | `var(--radius)`              | `0.875rem` |
| `--radius-xl`  | `calc(var(--radius) + 4px)`  | `1.25rem`  |
| `--radius-2xl` | `calc(var(--radius) + 8px)`  | `1.625rem` |
| `--radius-3xl` | `calc(var(--radius) + 12px)` | `2rem`     |
| `--radius-4xl` | `calc(var(--radius) + 16px)` | `2.375rem` |

## Custom Utilities

### Shadows

| Utility              | Description                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `.shadow-elegant`    | `0 20px 50px -20px color-mix(in oklab, var(--color-primary) 30%, transparent)` - Main card shadow |
| `.shadow-card-hover` | Smooth shadow + transform transition on hover (translateY(-2px))                                  |

### Gradients

| Utility                  | CSS                                                                                            | Usage                            |
| ------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------- |
| `.bg-gradient-primary`   | `linear-gradient(135deg, var(--color-primary), var(--color-secondary) 60%, var(--color-teal))` | Hero backgrounds, icon badges    |
| `.text-gradient-primary` | `linear-gradient(135deg, var(--color-primary), var(--color-teal))`                             | Gradient text effects (headings) |

### Animations

| Utility                         | Description                           |
| ------------------------------- | ------------------------------------- |
| `.animate-star-movement-bottom` | Horizontal movement animation         |
| `.animate-star-movement-top`    | Reverse horizontal movement animation |

### Focus Styles

Global keyboard-visible focus styles for native elements:

```css
a:focus-visible,
button:focus-visible,
[role="button"]:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
  border-radius: 4px;
}
```

### Skip Link

Accessibility skip link (visually hidden until focused).

## UI Components

### Button Variants

| Variant       | Classes                                                                          |
| ------------- | -------------------------------------------------------------------------------- |
| `default`     | `bg-primary text-primary-foreground hover:bg-primary/90`                         |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90`             |
| `outline`     | `border border-input bg-background hover:bg-accent hover:text-accent-foreground` |
| `secondary`   | `bg-secondary text-secondary-foreground hover:bg-secondary/80`                   |
| `ghost`       | `hover:bg-accent hover:text-accent-foreground`                                   |
| `link`        | `text-primary underline-offset-4 hover:underline`                                |

### Button Sizes

| Size      | Classes                       |
| --------- | ----------------------------- |
| `default` | `h-9 px-4 py-2`               |
| `sm`      | `h-8 rounded-md px-3 text-xs` |
| `lg`      | `h-10 rounded-md px-8`        |
| `icon`    | `h-9 w-9`                     |

### Card Structure

```tsx
<Card>
  <CardHeader>
    <CardTitle>Heading</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Main content</CardContent>
  <CardFooter>Actions</CardFooter>
</Card>
```

- `rounded-xl` border `bg-card` text color
- `CardTitle`: `font-semibold` (not `font-display` - use `.font-display` class if needed)

## Design Principles

### Color Philosophy

- **Whites + greys with teal (primary) + green (secondary) accents**
- Clean, modern aesthetic appropriate for medical/healthcare
- Teal conveys trust and professionalism
- Green accents suggest health and vitality

### Layout Conventions

- Max width containers: `max-w-7xl`
- Horizontal padding: `px-4 sm:px-6 lg:px-8`
- Section padding: `py-16 md:py-24` (desktop), `py-20` (standard)
- Grid gaps: `gap-4` for tight, `gap-6` for standard spacing

### Component Patterns

- Icon badges use `bg-gradient-primary` with white icons
- Specialty cards use `shadow-card-hover` for interactivity
- Images use `transition-transform group-hover:scale-105` for hover effects
- Gradients overlay on images: `bg-gradient-to-t from-primary/60 via-transparent to-transparent`

### Accessibility

- Skip links for keyboard navigation
- Focus-visible rings on interactive elements
- Color contrast follows WCAG guidelines
- Semantic HTML structure

## Icon Library

- **Library**: Lucide React
- Used for all icons: `Calendar`, `Clock`, `MapPin`, `Phone`, `ShieldCheck`, `Stethoscope`, etc.

## Breakpoints

Standard Tailwind breakpoints:

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px
