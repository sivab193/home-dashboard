---
name: DockSpace
colors:
  surface: '#121416'
  surface-dim: '#121416'
  surface-bright: '#38393b'
  surface-container-lowest: '#0c0e10'
  surface-container-low: '#1a1c1e'
  surface-container: '#1e2022'
  surface-container-high: '#282a2c'
  surface-container-highest: '#333537'
  on-surface: '#e2e2e5'
  on-surface-variant: '#e0bfbe'
  inverse-surface: '#e2e2e5'
  inverse-on-surface: '#2f3133'
  outline: '#a8898a'
  outline-variant: '#594141'
  surface-tint: '#ffb3b4'
  primary: '#ffb3b4'
  on-primary: '#680017'
  primary-container: '#ff6370'
  on-primary-container: '#680017'
  inverse-primary: '#b1293b'
  secondary: '#c3c7cc'
  on-secondary: '#2d3135'
  secondary-container: '#484c50'
  on-secondary-container: '#b9bcc1'
  tertiary: '#82d8a6'
  on-tertiary: '#003921'
  tertiary-container: '#53a87a'
  on-tertiary-container: '#003821'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdada'
  primary-fixed-dim: '#ffb3b4'
  on-primary-fixed: '#40000b'
  on-primary-fixed-variant: '#8f0b26'
  secondary-fixed: '#e0e3e8'
  secondary-fixed-dim: '#c3c7cc'
  on-secondary-fixed: '#181c20'
  on-secondary-fixed-variant: '#43474b'
  tertiary-fixed: '#9ef5c1'
  tertiary-fixed-dim: '#82d8a6'
  on-tertiary-fixed: '#002111'
  on-tertiary-fixed-variant: '#005232'
  background: '#121416'
  on-background: '#e2e2e5'
  surface-variant: '#333537'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: -0.01em
  mono-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system establishes an instrument-panel aesthetic tailored for a desktop smart home and Mac workstation dock dashboard. It targets power users, engineers, and hardware enthusiasts who value precision, high information density, and immediate visual clarity.

The design style blends **Minimalism** with **Low-Contrast Outlines**—evoking the crisp, developer-grade polish of modern telemetry and workstation tools. Surfaces rely on subtle tonal shifts and 1px hairline borders rather than heavy shadows or decorative chrome. A single vivid coral-red accent cuts through the dark slate canvas to highlight active states, critical metrics, and primary actions without overwhelming the peripheral field.

## Colors

The dark-mode palette is engineered for prolonged desktop viewing, pairing deep slate neutrals with a single high-chroma accent.

- **Canvas & Surfaces:** The base canvas uses `#131517` (`Background`), stepping up to `#1A1C1F` (`Surface`) for primary cards and sheets, and `#222428` (`Surface 2`) for inset panels, input fields, and nested wells.
- **Hairlines & Borders:** Structural separation relies on `#32353A` (`Line`), providing crisp 1px grid boundaries without visual clutter.
- **Typography:** Primary text uses `#EFF1F4` (`Ink`) for high-contrast legibility, while secondary labels, metadata, and axis ticks use `#A8ABB0` (`Ink 2`).
- **Accents:** `#FF6370` (`Primary`) is reserved strictly for active navigation tabs, key live metrics, links, and primary interactive states, paired with `#2F1113` (`On Primary`) for text on solid primary fills and `#4B2A2B` (`Primary Soft`) for tinted chips and selected table rows. `#E0E3E8` (`Secondary`) handles secondary actions, and `#6BC090` (`Tertiary`) supports charts, category tiles, and telemetry series.
- **Semantic States:** Status indicators use `#77CC90` (Success), `#F5BB5C` (Warning), and `#FC827A` (Danger). Dark feature cards and toast notifications use `#4F2729` (`Inverse`).

## Typography

The typographic system pairs **Geist** for geometric, developer-grade headlines with **Inter** for dense UI controls and body copy. **JetBrains Mono** is used for all tabular figures, timestamps, port numbers, power draw readouts, and live telemetry metrics.

- **Tabular Numerals:** Enable `font-variant-numeric: tabular-nums` on all `mono-*` roles and any `Inter` instances displaying live counters or table columns to prevent horizontal jitter during real-time updates.
- **Scale & Density:** The type scale is intentionally compact (`13px` default body, `12px` labels) to maximize data density on desktop monitors without sacrificing legibility.
- **Iconography:** Pair text with Material Symbols Outlined at `20px` for inline controls and `24px` for navigation rails and primary headers.

## Layout & Spacing

The layout uses a **12-column fluid grid** optimized for wide desktop displays, with `12px` (`0.75rem`) gutters and `24px` (`1.5rem`) outer canvas margins.

- **Desktop (≥ 1024px):** Full 12-column grid with a persistent left navigation rail (`240px` fixed) and modular telemetry cards spanning 3, 4, 6, or 12 columns.
- **Tablet (640px – 1023px):** Collapses to an 8-column grid with `16px` outer margins; the navigation rail condenses to an icon-only bar.
- **Mobile (< 640px):** Stacks into a 4-column grid with `12px` outer margins, prioritizing critical status cards and collapsing dense tables into stacked key-value rows.

## Elevation & Depth

Visual hierarchy is achieved through **tonal layers** and **low-contrast outlines** rather than drop shadows.

- **Surface Stacking:** Elements step upward in lightness from `#131517` (canvas) to `#1A1C1F` (cards) and `#222428` (inset fields and nested wells).
- **Hairline Boundaries:** Every card, table, and panel is bounded by a `1px solid #32353A` hairline border, creating crisp, precision-engineered separation.
- **Overlays:** Modals, command palettes, and floating popovers use `#1A1C1F` with a `1px solid #32353A` border and a subtle, tight ambient shadow (`0 8px 24px rgba(0, 0, 0, 0.45)`) to separate them from the underlying dashboard.

## Shapes

This design system uses a **Soft (`1`)** roundedness profile (`0.25rem` / `4px` base radius) to reinforce a technical, hardware-instrument aesthetic.

- **Small Controls:** Buttons, inputs, badges, and table row highlights use `4px` (`0.25rem`).
- **Containers:** Cards, panels, and modals use `8px` (`0.5rem`, `rounded-lg`).
- **Large Overlays:** Full-screen sheets or command palettes use `12px` (`0.75rem`, `rounded-xl`).

## Components

- **Buttons:** Primary buttons use `#FF6370` fill with `#2F1113` text (`label-lg`, `4px` radius). Secondary buttons use `#222428` fill with `#EFF1F4` text and a `1px solid #32353A` border. Soft/ghost buttons use `#4B2A2B` fill with `#FF6370` text for contextual actions.
- **Chips & Tags:** Status and category chips use `4px` radius, `11px`–`12px` `Inter` medium text, and `1px` hairline borders. Active or selected chips use `#4B2A2B` background with `#FF6370` text.
- **Cards:** Telemetry cards use `#1A1C1F` background, `1px solid #32353A` border, `8px` radius, and `16px` (`space-lg`) internal padding. Headers pair `headline-sm` (`Geist`) with a `20px` Material Symbols Outlined icon.
- **Dense Tables & Lists:** Rows are `36px`–`40px` tall with `1px solid #32353A` bottom hairlines. Numeric columns and timestamps use `JetBrains Mono` (`mono-md`) right-aligned. Selected rows highlight with `#4B2A2B`.
- **Input Fields:** Inputs use `#222428` background, `1px solid #32353A` border, `4px` radius, and `#EFF1F4` text. Focus states transition the border to `#FF6370`.
- **Checkboxes & Radio Buttons:** `16px` controls with `#222428` fill and `#32353A` border; checked states fill with `#FF6370` and `#2F1113` indicator marks.
- **Hardware Telemetry Tiles:** Compact, high-density tiles displaying a `label-sm` title, a `mono-lg` live metric, and a sparkline or status dot (`#77CC90`, `#F5BB5C`, `#FC827A`).