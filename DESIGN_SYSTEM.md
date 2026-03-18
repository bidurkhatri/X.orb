# X.orb — Design System & UI/UX Specification

**Version**: 1.0
**Style**: Liquid Glass (dark glassmorphism)
**Framework**: React + Tailwind CSS + Vite

This document defines every visual element in the X.orb dashboard. It is framework-agnostic in its definitions — reusable in any project.

---

## 1. Color Palette

### Primary Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `bg` | `#0A0A0A` | Page background, root canvas |
| `surface` | `#141414` | Elevated surfaces, cards (when not glass) |
| `border` | `#1E1E1E` | Subtle dividers, non-glass borders |
| `blue` | `#0066FF` | Primary actions, active nav, links, accents |
| `blue-hover` | `#0052CC` | Primary button hover state |
| `text` | `#E5E5E5` | Default body text |
| `muted` | `#737373` | Secondary text, labels, timestamps |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `green` | `#22C55E` | Success, active status, approved actions |
| `amber` | `#F59E0B` | Warning, paused status, slashing events |
| `red` | `#EF4444` | Error, revoked status, blocked actions |
| `purple` | `#7C3AED` | Tier badges, premium indicators |

### Opacity Scale

All semantic colors use opacity layers for backgrounds:

| Pattern | Opacity | Usage |
|---------|---------|-------|
| `{color}/5` | 5% | Glass card background |
| `{color}/8` | 8% | Table row dividers |
| `{color}/10` | 10% | Glass borders, hover surfaces |
| `{color}/15` | 15% | Active nav item background |
| `{color}/20` | 20% | Badge backgrounds, hover glass borders |
| `{color}/30` | 30% | Button hover backgrounds |
| `{color}/50` | 50% | Disabled state opacity |
| `{color}/60` | 60% | Placeholder text opacity |

---

## 2. Typography

### Font Families

| Family | Stack | Usage |
|--------|-------|-------|
| **Sans** | `Inter, system-ui, sans-serif` | UI text, labels, headings, descriptions |
| **Mono** | `JetBrains Mono, monospace` | Data values, hashes, addresses, agent IDs, timestamps, scores, prices |

### Type Scale

| Name | Size | Weight | Usage |
|------|------|--------|-------|
| Page Title | 28px (`text-2xl`) | 600 (`font-semibold`) | Page headings |
| Section Title | 18px (`text-lg`) | 600 (`font-semibold`) | Sidebar brand, card titles |
| Card Title | 14px (`text-sm`) | 500 (`font-medium`) | Section headers inside cards |
| Body | 14px (`text-sm`) | 400 (normal) | Default text, table cells, descriptions |
| Small | 12px (`text-xs`) | 500 (`font-medium`) | Badges, labels, table headers, timestamps |
| Tiny | 10px (`text-[10px]`) | 400 | Sidebar subtitle (brand tagline) |
| Metric Value | 28px (`text-2xl`) | 600 + mono | Large metric numbers |

### Letter Spacing

| Style | Value | Usage |
|-------|-------|-------|
| `tracking-tight` | -0.025em | Mono data, brand title |
| `tracking-wide` | 0.025em | Sidebar subtitle |
| `tracking-wider` | 0.05em | Table headers (uppercase) |

---

## 3. Glass Components (Liquid Glass Design)

### Glass Card — `.glass-card`

The foundation component. Used for all content containers.

```css
background: rgba(255, 255, 255, 0.05);    /* white at 5% */
backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.1); /* white at 10% */
border-radius: 16px;                        /* rounded-xl */
```

### Glass Card Hover — `.glass-card-hover`

Interactive glass cards (clickable rows, cards).

```css
/* Base: same as .glass-card */
transition: all 200ms;

/* Hover state */
background: rgba(255, 255, 255, 0.1);      /* white at 10% */
border-color: rgba(255, 255, 255, 0.2);    /* white at 20% */
```

### Glass Sidebar — `.glass-sidebar`

```css
background: rgba(255, 255, 255, 0.05);
backdrop-filter: blur(20px);
border-right: 1px solid rgba(255, 255, 255, 0.1);
```

---

## 4. Layout

### Page Structure

```
┌─────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────────────────────────────┐   │
│ │          │ │ Page Header                      │   │
│ │ Sidebar  │ │ ──────────────────────────────── │   │
│ │ 220px    │ │ Content Area                     │   │
│ │ fixed    │ │ padding: 24px                    │   │
│ │          │ │ overflow-y: auto                 │   │
│ │          │ │                                  │   │
│ └──────────┘ └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

| Element | Value |
|---------|-------|
| Root | `flex h-screen overflow-hidden` |
| Sidebar width | `220px` fixed, non-shrinkable |
| Content padding | `24px` (p-6) |
| Content overflow | `overflow-y: auto` (scrollable) |

### Responsive Grid Patterns

| Pattern | Mobile | Tablet (md: 768px) | Desktop (lg: 1024px) |
|---------|--------|---------------------|----------------------|
| Metric cards | 1 column | 2 columns | 4 columns |
| Form fields | 1 column | 2 columns | 2 columns |
| Two-panel | 1 column | 1 column | 2 columns |
| Report metrics | 4 columns | 4 columns | 4 columns |

Grid gap: `16px` (gap-4)

---

## 5. Sidebar

| Element | Style |
|---------|-------|
| Width | `220px` |
| Background | Glass sidebar (white/5 + blur 20px) |
| Right border | `1px solid rgba(255, 255, 255, 0.1)` |
| Header padding | `20px` |
| Header border | Bottom `1px solid rgba(255, 255, 255, 0.1)` |
| Logo size | `32px × 32px`, inverted |
| Brand title | 18px, weight 600, tight tracking |
| Brand subtitle | 10px, muted, uppercase, wide tracking |
| Nav padding | `12px horizontal, 8px vertical` |
| Nav item spacing | `2px` |
| Nav icon size | `18px` |
| Nav icon gap | `12px` |
| Nav item radius | `8px` (rounded-lg) |
| Nav inactive | Muted text, transparent background |
| Nav hover | White text, `rgba(255,255,255,0.05)` background |
| Nav active | `#0066FF` text, `rgba(0,102,255,0.15)` background, weight 500 |
| Status card | Glass card, `12px` padding, `6px` spacing |
| Activity dot | `8px` circle, green |

### Navigation Items

9 items with Lucide icons (18px):
1. Overview — `LayoutDashboard`
2. Agents — `Bot`
3. Actions — `Zap`
4. Marketplace — `Store`
5. Audit — `Shield`
6. Webhooks — `Webhook`
7. Billing — `CreditCard`
8. Settings — `Settings`

---

## 6. Component Specifications

### Page Header

```
┌──────────────────────────────────────────────────────┐
│ Title (28px, 600)                    [Action Button] │
│ Description (14px, muted)                            │
└──────────────────────────────────────────────────────┘
```

- Container: `flex items-start justify-between`
- Bottom margin: `24px`
- Title → description gap: `4px`

### Metric Card

```
┌─────────────────────┐
│ Label (14px)   Icon │
│                     │
│ Value (28px, mono)  │
│ Change (12px)       │
└─────────────────────┘
```

- Glass card with `20px` padding
- Header: flex between label and icon (18px)
- Header margin bottom: `12px`
- Value: 28px, weight 600, monospace
- Change indicator: 12px, top margin 4px
  - Positive: green
  - Negative: red
  - Neutral: muted

### Glass Table

```
┌────────────────────────────────────────────┐
│ HEADER  │ HEADER  │ HEADER  │ HEADER      │  12px uppercase, muted
├─────────┼─────────┼─────────┼─────────────┤  border white/8
│ data    │ data    │ data    │ data        │  14px, hover white/5
├─────────┼─────────┼─────────┼─────────────┤  border white/5
│ data    │ data    │ data    │ data        │
└────────────────────────────────────────────┘
```

| Element | Style |
|---------|-------|
| Container | Glass card, `overflow-hidden` |
| Header border | `1px solid rgba(255,255,255,0.08)` |
| Header cell | `16px × 12px` padding, 12px uppercase, weight 500, muted, wider tracking |
| Body row | `16px × 12px` padding, 14px |
| Row divider | `1px solid rgba(255,255,255,0.05)`, last row no border |
| Row hover | `rgba(255,255,255,0.05)` background (when clickable) |
| Empty state | `48px` padding, centered, 14px muted |

---

## 7. Buttons

### Primary Button

```css
padding: 8px 16px;
background: #0066FF;
border-radius: 8px;
font-size: 14px;
font-weight: 500;
transition: background 200ms;
/* Hover */ background: #0052CC;
/* Disabled */ opacity: 0.5;
```

### Secondary Button

```css
padding: 8px 16px;
background: rgba(255, 255, 255, 0.05);
border-radius: 8px;
font-size: 14px;
transition: background 200ms;
/* Hover */ background: rgba(255, 255, 255, 0.1);
```

### Semantic Action Buttons

| Action | Background | Text | Hover Background |
|--------|-----------|------|-----------------|
| Pause | `rgba(245,158,11,0.2)` | `#F59E0B` | `rgba(245,158,11,0.3)` |
| Resume | `rgba(34,197,94,0.2)` | `#22C55E` | `rgba(34,197,94,0.3)` |
| Revoke/Delete | `rgba(239,68,68,0.2)` | `#EF4444` | `rgba(239,68,68,0.3)` |

All: `12px × 6px` padding, `8px` radius, 14px text, `6px` icon gap, icon `14px`.

### Icon Button

```css
padding: 4px;
border-radius: 4px;
/* Hover */ background: rgba(255, 255, 255, 0.1);
```

### Pagination Button

```css
padding: 6px 12px;
background: rgba(255, 255, 255, 0.05);
border-radius: 8px;
font-size: 14px;
transition: background 200ms;
/* Hover */ background: rgba(255, 255, 255, 0.1);
/* Disabled */ opacity: 0.3;
```

---

## 8. Form Elements

### Text Input

```css
width: 100%;
background: rgba(255, 255, 255, 0.05);
border: 1px solid rgba(255, 255, 255, 0.1);
border-radius: 8px;
padding: 8px 12px;
font-size: 14px;
color: #E5E5E5;
/* Placeholder */ color: rgba(115, 115, 115, 0.6);
/* Focus */ outline: none; border-color: rgba(0, 102, 255, 0.5);
transition: border-color 200ms;
```

### Monospace Input (API keys, addresses)

Same as text input + `font-family: JetBrains Mono, monospace`.

### Select / Dropdown

Same styling as text input. Min-width `200px` for agent selectors.

### Form Field Label

```css
font-size: 12px;
color: #737373;
display: block;
margin-bottom: 4px;
```

### Form Error Text

```css
font-size: 12px;
color: #EF4444;
margin-top: 8px;
```

---

## 9. Badges

### Status Badges

| Status | Background | Text |
|--------|-----------|------|
| Active | `rgba(34,197,94,0.2)` | `#4ADE80` (green-400) |
| Paused | `rgba(245,158,11,0.2)` | `#FBBF24` (amber-400) |
| Revoked | `rgba(239,68,68,0.2)` | `#F87171` (red-400) |
| Tier | `rgba(124,58,237,0.2)` | `#A78BFA` (purple-400) |

All badges: `12px` font, weight 500, `8px × 2px` padding, pill shape (`border-radius: 9999px`).

### Scope Badge

- Background: `rgba(0,102,255,0.2)`
- Text: `#0066FF`

### Auth Badge

- Background: `rgba(234,179,8,0.2)`
- Text: `#FBBF24`

---

## 10. Event Indicators

Color-coded dots (`8px` circle) for event types:

| Event Pattern | Color | Hex |
|--------------|-------|-----|
| `action.approved` | Green | `#22C55E` |
| `action.blocked` | Red | `#EF4444` |
| Contains "slash" | Amber | `#F59E0B` |
| All other events | Blue | `#0066FF` |

Layout: `flex items-center gap-12px`, dot shrink-0, text truncates.

---

## 11. Compliance Report

### Score Grid (4 columns)

```
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│  95  │ │   4  │ │   4  │ │   0  │
│Score │ │Ctrls │ │Pass  │ │Fail  │
└──────┘ └──────┘ └──────┘ └──────┘
```

- Cell: `rgba(255,255,255,0.05)` background, `12px` padding, centered
- Value: 28px, mono, bold
- Label: 12px, muted
- Pass count: green, Fail count: red

### Section Card

```
┌─ ✓ Risk Management ──── pass ──────────────────┐
│  • 1847 actions processed through 8-gate pipeline │
│  • Violation rate: 0.11%                          │
└───────────────────────────────────────────────────┘
```

- Background: `rgba(255,255,255,0.05)`, radius `8px`, padding `12px`
- Icon: 14px (CheckCircle green / AlertTriangle yellow or red)
- Title: 14px, weight 500
- Status badge: 12px, `6px × 2px` padding, radius `4px`
- Evidence list: 12px, muted, left margin `20px`, `2px` spacing

---

## 12. Search Bar

```
┌──🔍─────────────────────────┐
│  Search agents...            │
└──────────────────────────────┘
```

- Container: `relative`, max-width `24rem`
- Icon: 14px, muted, absolute left `12px`, vertically centered
- Input: left padding `36px` (clears icon), right padding `12px`
- Placeholder: muted at 60% opacity
- Focus: blue border at 50% opacity

---

## 13. Transitions & Animations

| Property | Duration | Easing |
|----------|----------|--------|
| Color changes | 200ms | ease (default) |
| Background changes | 200ms | ease |
| Border changes | 200ms | ease |
| All properties (glass hover) | 200ms | ease |

No keyframe animations. No loading spinners (text-based "Loading..." states).

---

## 14. Iconography

**Library**: Lucide React
**Default size**: 16px (buttons), 18px (navigation), 14px (inline/small)
**Style**: Stroke icons, 2px stroke width (Lucide default)

Key icons used:
- `Plus` — Create/Add actions
- `Pause`, `Play`, `XCircle` — Agent lifecycle
- `Search` — Search bar
- `ChevronLeft`, `ChevronRight` — Pagination, back navigation
- `ArrowLeft` — Back button
- `FileText` — Generate report
- `Download` — Export
- `CheckCircle` — Pass status
- `AlertTriangle` — Warning/fail status
- `Eye`, `EyeOff` — Show/hide API key
- `Copy` — Copy to clipboard
- `Trash2` — Delete webhook
- `Key` — API key section
- `LayoutDashboard`, `Bot`, `Zap`, `Store`, `Shield`, `Webhook`, `CreditCard`, `Settings` — Navigation

---

## 15. Data Display Conventions

| Data Type | Font | Format |
|-----------|------|--------|
| Agent ID | Mono, 12px, muted | `agent_abc123` |
| Wallet address | Mono, 12px | `0x742d...5f2b` (truncated) |
| Audit hash | Mono, 12px | `0xabc...` (truncated) |
| Trust score | Mono, 14px | `72/100` |
| USDC amounts | Mono, 14px, blue | `$0.005` |
| Timestamps | Mono, 12px, muted | ISO 8601 or relative |
| Action counts | Mono, 14px | `1,847` (comma-separated) |

---

## 16. Empty States

All empty states follow this pattern:

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│    No data message here.                │
│    (14px, muted, centered)              │
│                                         │
│                                         │
└─────────────────────────────────────────┘
```

- Glass card container
- Padding: `48px`
- Text: 14px, muted, centered

---

## 17. Dark Mode

This is a dark-only design system. No light mode toggle exists.

| Layer | Color | Purpose |
|-------|-------|---------|
| Canvas | `#0A0A0A` | Page background |
| Surface | `#141414` | Card backgrounds (fallback) |
| Glass | `rgba(255,255,255,0.05)` on `#0A0A0A` | Primary surface treatment |
| Glass border | `rgba(255,255,255,0.1)` | Container boundaries |
| Text primary | `#E5E5E5` | Body copy |
| Text muted | `#737373` | Labels, secondary info |
| Accent | `#0066FF` | Interactive elements |

The entire UI relies on white-on-dark with varying opacity levels. Color is used semantically (green=good, red=bad, amber=warning, blue=action, purple=tier).

---

## 18. Reuse Guide

To reuse this design system in another project:

1. Install dependencies:
   ```bash
   npm install tailwindcss @tailwindcss/forms lucide-react
   npm install -D @fontsource/inter @fontsource/jetbrains-mono
   ```

2. Copy `tailwind.config.js` color extensions

3. Copy `.glass-card`, `.glass-card-hover`, `.glass-sidebar`, `.badge-*` classes from `index.css`

4. Set root background to `#0A0A0A`

5. Use Inter for UI text, JetBrains Mono for data

6. Follow the opacity scale: `/5` for backgrounds, `/10` for borders, `/20` for badges, `/30` for hover

7. All containers are glass cards. No solid backgrounds except the canvas.
