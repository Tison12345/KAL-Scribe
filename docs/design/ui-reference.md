# UI Reference — Extracted from PK Protocol Builder

This file documents the exact visual patterns used in the existing PK Protocol Builder
(`treatment-plan-tool/app/(doctor)/`). Every new screen must match these patterns.
Read this before building any new UI. When this file and ui-guidelines.md conflict, ask first.

---

## 1. Design Tokens

All colors are CSS custom properties defined in `app/globals.css`. Use `var(--token-name)` in
Tailwind arbitrary values — never hardcode hex codes.

### Color Map

| Token | Hex | Used For |
|---|---|---|
| `--color-primary` | `#1e4b3c` | Primary actions, active nav, icons, links |
| `--color-primary-hover` | `#163a30` | Primary button hover state |
| `--color-on-primary` | `#ffffff` | Text/icons on primary backgrounds |
| `--color-primary-container` | `#d4e8e2` | Avatar background, soft fills |
| `--color-on-primary-container` | `#1e4b3c` | Text on primary container |
| `--color-background` | `#f5faf7` | Page background (body) |
| `--color-on-background` | `#1a2520` | Primary text (headings, values) |
| `--color-surface` | `#f5faf7` | Same as background |
| `--color-on-surface` | `#1a2520` | Body text, table cell content |
| `--color-on-surface-variant` | `#4a5652` | Labels, secondary text, breadcrumbs |
| `--color-surface-variant` | `#dce5e1` | Surface fills |
| `--color-outline` | `#6b7874` | Placeholder text, dividers, empty cell "—" |
| `--color-outline-variant` | `#a3b0ab` | Borders, ring colors, dividers (typically at `/20`–`/40` opacity) |
| `--color-surface-container-lowest` | `#ffffff` | Inner card fill, form field backgrounds in modals |
| `--color-surface-container-low` | `#eef3f0` | Form input backgrounds, sidebar hover, table row hover |
| `--color-surface-container` | `#e7eeeb` | Date range chips, subtle fills |
| `--color-surface-container-high` | `#e1e8e5` | Button hover (unselected pill) |
| `--color-surface-container-highest` | `#dce5e1` | Heaviest surface fill |
| `--color-accent` | `#aa832a` | Secondary/text-format badges, accent icons, combobox hints |

### Status Colors (raw Tailwind, not custom tokens)

| Purpose | Classes |
|---|---|
| Warning banner | `border-amber-200 bg-amber-50 text-amber-900` |
| Warning text inside banner | `text-amber-950/95` |
| Inline error | `text-red-600 bg-red-50`, border `border-red-200` |
| Success text | `text-emerald-700` |
| System status dot | `bg-emerald-500 shadow-sm shadow-emerald-200` |

---

## 2. Typography

**Font:** Manrope (Google Fonts, loaded in `app/layout.tsx`). Applied via `className={manrope.className} antialiased` on `<body>`.
**Icon font:** Material Symbols Outlined (loaded via `<link>` in `<head>`). Use `<span className="material-symbols-outlined">icon_name</span>`.

### Scale

| Role | Classes | Where Used |
|---|---|---|
| Page heading | `text-5xl font-extrabold tracking-tight text-[var(--color-on-background)]` | Every page's `<h2>` — "Patients", "Build Protocol", etc. |
| Page subheading | `text-lg font-medium leading-relaxed text-[var(--color-on-surface-variant)]` | Paragraph under every page heading |
| Section heading | `text-xl font-extrabold text-[var(--color-on-background)]` | Form section titles — "Demographics", "Clinical Intake" |
| Phase/group heading | `text-lg font-extrabold text-[var(--color-on-background)]` | Phase headers in protocol builder, stage group headers in review |
| Brand name | `text-xl font-extrabold text-[var(--color-primary)] tracking-tight` | Sidebar top |
| Brand sub-label | `text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]` | "Protocol Builder" beneath brand name |
| Field label | `text-[11px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]` | Every form `<label>`, section subsection labels |
| Micro label | `text-[9px] font-bold text-[var(--color-on-surface-variant)]` | Medicine sub-field labels inside StageCard (Dosage, Unit, When) |
| Table header | `text-[10px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]` | Patient table column headers |
| Dense table header | `text-[9px] font-extrabold uppercase tracking-wider text-[var(--color-on-surface-variant)]` | Treatments table (space-constrained) |
| Table cell — primary | `text-sm font-bold text-[var(--color-on-surface)]` | Patient name, protocol type cells |
| Table cell — secondary | `text-xs font-medium text-[var(--color-on-surface-variant)]` | Date cells, secondary value cells |
| Body text | `text-sm font-medium text-[var(--color-on-surface)]` | General body content |
| Helper text | `text-[10px] text-[var(--color-outline)] font-medium` | Below form fields ("Required for WhatsApp delivery") |
| Error message | `text-[11px] font-semibold text-red-600` | Inline field-level validation errors |
| Form-level error | `text-[12px] font-semibold text-red-600 bg-red-50 px-4 py-2.5 rounded-xl` | Single-line block error below form |
| Success message | `text-sm text-emerald-700 font-semibold` | Inline success (edit protocol page) |
| Breadcrumb | `text-[11px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]` | Active breadcrumb item in `text-[var(--color-primary)]` |
| Stage summary | `text-[11px] text-[var(--color-on-surface-variant)]` | Collapsed stage card "2 diet, 1 lifestyle" line |
| Modal paragraph | `text-sm text-[var(--color-on-surface-variant)] leading-relaxed` | Modal body copy |

---

## 3. Spacing

### Page-Level Rhythm

| Pattern | Classes | Where |
|---|---|---|
| Heading → description paragraph | `mb-4` on heading | All pages |
| Description → first content block | `mb-12` on description | All pages |
| Between major form sections | `space-y-12` on form | `new/page.tsx` |
| Section divider | `h-px bg-[var(--color-outline-variant)]/30` | Between Demographics and Clinical Intake |
| Action bar separator | `pt-8 border-t border-[var(--color-outline-variant)]/20` | Bottom of all forms |
| Page bottom padding | `pb-16` | Main layout |

### Card / Panel Inner Padding

| Component | Padding |
|---|---|
| Outer double-card shell | `p-1.5` (outer), gap between outer and inner is visual only |
| Form card inner panel | `p-12` |
| Stage card header | `px-8 py-5` |
| Stage card body | `px-8 pb-8 pt-2` |
| Stage card body field spacing | `space-y-6` |
| Dashboard metric card | `p-8` |
| Modal container | `p-7` (standard) or `p-8` (LMP/warning modal) |
| Table cell (patients) | `px-8 py-5` |
| Table cell (treatments, dense) | `px-3 py-3.5` |

### Component Gaps

| Pattern | Classes |
|---|---|
| Between stage cards | `space-y-4` |
| Between phase sections | `space-y-10` |
| Between medicine rows | `space-y-3` |
| Section label → input | `mb-2` (stage card) or `mb-3` (main forms) |
| Phase header → stage cards | `mb-5` |
| Between dashboard metric cards | `gap-8` in `grid grid-cols-3` |
| Combobox selected chips | `gap-2` |
| Button + icon inside button | `gap-3` (primary CTA) or `gap-2` (ghost) |

---

## 4. Component Patterns

### 4.1 Primary CTA Button

Full-weight green button. Used for the main action at the bottom of every flow step.

```
bg-[var(--color-primary)] text-[var(--color-on-primary)]
px-10 py-4 rounded-2xl text-sm font-extrabold
shadow-lg shadow-[var(--color-primary)]/30
hover:shadow-xl hover:bg-[var(--color-primary-hover)]
active:scale-[0.98] transition-all
flex items-center gap-3
disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
```

Smaller variant (page header "New Patient" link-button):
```
px-8 py-4 (instead of px-10)
shadow-lg shadow-[var(--color-primary)]/30
hover:shadow-xl hover:bg-[var(--color-primary-hover)]
```

### 4.2 Ghost / Back Button

Text-colored with hover fill. Used for secondary actions and "Back" navigation.

```
px-8 py-4 text-sm font-bold text-[var(--color-primary)]
hover:bg-[var(--color-primary)]/5 rounded-2xl transition-all
flex items-center gap-2
```

### 4.3 Cancel / Text-Only Button

No background, no border. Used in modals as the tertiary option.

```
text-sm font-bold text-[var(--color-on-surface-variant)]
(optionally: w-full py-2)
```

### 4.4 Protocol Type Pill Buttons (toggle group)

Selected state:
```
px-6 py-3 rounded-2xl text-sm font-bold
bg-[var(--color-primary)] text-[var(--color-on-primary)]
shadow-lg shadow-[var(--color-primary)]/30 transition-all
```

Unselected state:
```
px-6 py-3 rounded-2xl text-sm font-bold
bg-[var(--color-surface-container-low)] text-[var(--color-on-surface-variant)]
hover:bg-[var(--color-surface-container-high)] transition-all
```

### 4.5 Inline Table Action Button (with text label)

```
inline-flex shrink-0 items-center gap-1
px-2.5 py-1.5 rounded-lg text-[10px] font-bold
bg-[var(--color-primary)]/10 text-[var(--color-primary)]
hover:bg-[var(--color-primary)]/15 transition-all
```

### 4.6 Icon-Only Table Action Button

```
inline-flex shrink-0 items-center justify-center
w-9 h-9 rounded-lg
text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all
```

### 4.7 Add Item Ghost Button (inside cards)

```
flex items-center gap-2 px-5 py-3 rounded-2xl
text-sm font-bold text-[var(--color-primary)]
hover:bg-[var(--color-primary)]/5 transition-all
```

Smaller variant (inside StageCard medicine section):
```
flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl
text-[11px] font-bold text-[var(--color-primary)]
hover:bg-[var(--color-primary)]/5 transition-all
```

### 4.8 Delete / Remove Button

Circular icon button with red hover:
```
w-8 h-8 flex items-center justify-center rounded-full
text-[var(--color-outline)] hover:bg-red-50 hover:text-red-600 transition-all
```

Smaller variant inside medicine row:
```
w-7 h-7 ... rounded-full (same pattern)
```

### 4.9 Secondary Outline Button (modal)

```
w-full py-3 rounded-2xl text-sm font-bold
border-2 border-[var(--color-outline-variant)]/40
text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container-low)]
disabled:opacity-50
```

### 4.10 Form Inputs

Standard text/date/number input:
```
w-full bg-[var(--color-surface-container-low)] rounded-2xl py-4 px-5
text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)]/40
form-input-focus transition-all font-medium
```

The `form-input-focus` class (defined in `globals.css`) removes default outline and applies:
```css
box-shadow: 0 0 0 2px var(--color-primary-container);
```

Select (same as input, add `appearance-none`):
```
... appearance-none
```

Textarea (same as input, add `resize-none`):
```
... resize-none
```

Error state (add to input):
```
border-red-500
```
or for stronger visual:
```
ring-2 ring-red-400/50
```

Disabled state:
```
disabled:opacity-60 disabled:cursor-not-allowed
```

Input inside cards/sub-panels (smaller):
```
bg-[var(--color-surface-container-low)] rounded-2xl py-3 px-4 text-sm
```

Input inside medicine rows (on white card surface):
```
bg-white rounded-xl py-2 px-3 text-sm
```

Time picker (tiny, inline with label row):
```
bg-[var(--color-surface-container-low)] rounded-lg px-2 py-0.5
text-[10px] font-medium w-[90px]
```

Search input (top bar):
```
w-full bg-[var(--color-surface-container-low)] border-none rounded-full
py-2.5 pl-12 pr-4 text-sm placeholder:text-[var(--color-outline)]
focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all
```
(Magnifier icon at `absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-outline)] text-lg`)

### 4.11 ComboboxMultiSelect

Container (acts as the input field):
```
w-full bg-[var(--color-surface-container-low)] rounded-2xl p-2
flex flex-wrap gap-2 items-center
border border-transparent focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20
transition-all cursor-text
```

Selected chip inside container:
```
inline-flex items-center gap-1.5
bg-[var(--color-primary)] text-[var(--color-on-primary)]
text-xs font-bold px-3 py-1.5 rounded-full
```

Chip remove button: `hover:bg-white/20 rounded-full w-4 h-4`

Internal text input (transparent, no outline):
```
flex-1 min-w-[120px] bg-transparent border-none outline-none
focus:ring-0 focus:outline-none py-2 text-sm
placeholder:text-[var(--color-outline)]/40 font-medium text-[var(--color-on-surface)]
```

Dropdown list:
```
absolute z-50 mt-2 w-full bg-white rounded-2xl
shadow-xl shadow-black/8 ring-1 ring-[var(--color-outline-variant)]/20
py-2 max-h-56 overflow-y-auto
```

Dropdown item (default):
```
w-full text-left px-5 py-2.5 text-sm font-medium
text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container-low)]
```

Dropdown item (highlighted):
```
bg-[var(--color-primary)]/5 text-[var(--color-primary)]
```

"No matches" panel:
```
absolute z-50 mt-2 w-full bg-white rounded-2xl
shadow-xl shadow-black/8 ring-1 ring-[var(--color-outline-variant)]/20
py-4 px-5 text-sm text-[var(--color-on-surface-variant)]
```
Contains `<kbd>` with `px-1.5 py-0.5 bg-[var(--color-surface-container-low)] rounded text-xs font-bold`.

Hint text (duplicate warning):
```
mt-1.5 ml-1 text-[11px] font-semibold text-[var(--color-accent)]
animate-[fadeIn_0.2s_ease-out]
```

### 4.12 Page-Level Content Card (double-rounded shell)

Used for tables, forms, and the review screen timeline. The outermost visual container.

```
bg-white rounded-[2.5rem] p-1.5
shadow-xl shadow-[var(--color-primary)]/5
ring-1 ring-[var(--color-outline-variant)]/20
```

Inner panel for tables (overflow hidden):
```
bg-[var(--color-surface-container-lowest)] rounded-[2.3rem] overflow-hidden
```

Inner panel for forms (with padding):
```
bg-[var(--color-surface-container-lowest)] rounded-[2.3rem] p-12
```

### 4.13 Dashboard Metric Cards

```
bg-white rounded-[2rem] p-8
shadow-lg shadow-[var(--color-primary)]/5
ring-1 ring-[var(--color-outline-variant)]/20
```

Icon container inside:
```
w-10 h-10 rounded-xl bg-[var(--color-primary)]/5
flex items-center justify-center
```

### 4.14 StageCard

Outer card:
```
bg-white rounded-[2rem]
ring-1 ring-[var(--color-outline-variant)]/20
shadow-lg shadow-[var(--color-primary)]/5
```

Header (collapse toggle area):
```
flex items-center gap-4 px-8 py-5
cursor-pointer select-none
hover:bg-[var(--color-surface-container-low)]/50 transition-colors
```

Expand chevron (rotates on collapse):
- Expanded: `rotate(0deg)`, Collapsed: `rotate(-90deg)` — `transition-transform duration-200`

Body (shown when expanded):
```
px-8 pb-8 pt-2 space-y-6
border-t border-[var(--color-outline-variant)]/15
animate-[fadeIn_0.2s_ease-out]
```

Medicine sub-row container:
```
bg-[var(--color-surface-container-low)] rounded-2xl p-4 space-y-3
```

Diet left-border accent:
```
pl-4 border-l-2 border-[var(--color-primary)]/15
```

Locked field (read-only display):
```
w-full bg-[var(--color-surface-container-low)] rounded-2xl py-3 px-4
text-sm text-[var(--color-on-surface)] font-medium
opacity-60 cursor-not-allowed
```

### 4.15 Tables

Table wrapper (inside double-card shell):
```
<table className="w-full text-left">
```

Patients table uses `table-auto`, treatments table uses `table-fixed border-collapse`.

Header row:
```
<tr className="border-b border-[var(--color-outline-variant)]/20">
```

Header cell (patients):
```
px-8 py-5 text-[10px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]
```

Header cell (treatments, space-constrained):
```
px-3 py-3.5 text-[9px] font-extrabold uppercase tracking-wider text-[var(--color-on-surface-variant)] leading-tight
```

Data row:
```
border-b border-[var(--color-outline-variant)]/10 last:border-b-0
hover:bg-[var(--color-surface-container-low)]/50 transition-colors
```

Data cell — primary value:
```
px-8 py-5 text-sm font-bold text-[var(--color-on-surface)]
```

Data cell — secondary/date value:
```
px-8 py-5 text-xs font-medium text-[var(--color-on-surface-variant)]
```

Empty cell placeholder:
```
<span className="text-[var(--color-outline)]">—</span>
```

### 4.16 Sidebar Navigation

```
<aside className="h-screen w-64 fixed left-0 top-0
  bg-white border-r border-[var(--color-outline-variant)]/30
  flex flex-col py-6 px-4 z-50">
```

Nav item (inactive):
```
flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors duration-200
text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-low)]
```

Nav item (active):
```
text-[var(--color-primary)] font-bold bg-[var(--color-primary)]/5
```

Active icon — apply filled variant: `fontVariationSettings: "'FILL' 1"`

User profile card (bottom of sidebar):
```
flex items-center gap-3 p-3 bg-[var(--color-surface-container-low)] rounded-2xl
```

### 4.17 Top Bar

```
<header className="fixed top-0 right-0 w-[calc(100%-16rem)] z-40
  bg-white/80 backdrop-blur-md
  flex items-center justify-between px-10 h-20
  border-b border-[var(--color-outline-variant)]/20">
```

User pill (right side):
```
flex items-center gap-3 pl-3 pr-1.5 py-1.5
rounded-full border border-[var(--color-outline-variant)]/40
```

Notification button:
```
w-10 h-10 flex items-center justify-center rounded-full
text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-high)] transition-all
```

### 4.18 Avatar / Initials

Standard (sidebar profile, patient chip):
```
w-10 h-10 rounded-full bg-[var(--color-primary-container)]
flex items-center justify-center text-[var(--color-primary)] font-bold text-sm
```

Small (top bar, patient chip inline):
```
w-9 h-9 rounded-full bg-[var(--color-primary-container)]
flex items-center justify-center text-[var(--color-primary)] font-bold text-xs
```

Top bar small variant: `w-8 h-8 ... text-xs`

### 4.19 Badges and Chips

Count badge (phase, list counts):
```
text-[10px] font-bold text-[var(--color-primary)]
bg-[var(--color-primary)]/10 px-2 py-0.5 rounded-full
```

Phase label badge (review screen):
```
text-[10px] font-bold text-[var(--color-primary)]
bg-[var(--color-primary)]/10 px-2.5 py-0.5 rounded-full
```

Date range chip (stage card header, review):
```
text-[10px] font-bold text-[var(--color-on-surface-variant)]
bg-[var(--color-surface-container-low)] px-2.5 py-1 rounded-full
```

Duration chip ("14 days" in review):
```
text-[10px] font-bold text-[var(--color-on-surface-variant)]
bg-[var(--color-surface-container)] px-2 py-0.5 rounded-full
```

Format badge — PDF:
```
text-[10px] font-extrabold uppercase tracking-wider
bg-[var(--color-primary)]/10 text-[var(--color-primary)]
px-2.5 py-0.5 rounded-full
```

Format badge — Text:
```
bg-[var(--color-accent)]/10 text-[var(--color-accent)]
(same size/shape as PDF badge)
```

### 4.20 Status / Alert Banners

Warning (amber), standard — used for "treatment started" lock notice and PDF errors:
```
rounded-2xl border border-amber-200 bg-amber-50
px-5 py-4 text-xs text-amber-900
```

Warning, compact — used for pagination cap notice:
```
text-[12px] font-medium text-amber-900 bg-amber-50 border border-amber-200
px-4 py-2.5 rounded-xl
```

Info banner (replication mode notice):
```
rounded-2xl border border-[var(--color-outline-variant)]/40
bg-[var(--color-surface-container-low)]
px-5 py-4 text-xs text-[var(--color-on-surface-variant)]
```

Error banner (inline, below form):
```
text-[12px] font-semibold text-red-600 bg-red-50 px-4 py-2.5 rounded-xl
```

Error banner with border (modal/alert):
```
rounded-xl border border-red-200 bg-red-50
px-4 py-3 text-sm text-red-900 font-medium leading-relaxed
```

### 4.21 Modals

Standard modal backdrop:
```
fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4
```

LMP warning modal uses `bg-black/40 backdrop-blur-sm`.

Modal container (standard):
```
w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl
ring-1 ring-[var(--color-outline-variant)]/30
```

Larger modal (EnrollTreatmentModal):
```
w-full max-w-xl rounded-3xl bg-white p-7 shadow-2xl
ring-1 ring-[var(--color-outline-variant)]/30
max-h-[90vh] overflow-y-auto
```

LMP warning modal inner (warning icon):
```
w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0
```
Icon: `text-amber-600 text-xl`

### 4.22 Protocol Summary Bar (Review screen)

```
flex items-center gap-4 px-6 py-4
bg-[var(--color-surface-container-low)] rounded-2xl
```

Vertical dividers between items: `w-px h-5 bg-[var(--color-outline-variant)]/30`

### 4.23 SendRow (Review screen timeline item)

```
flex gap-4 items-start py-4 px-5 rounded-2xl transition-colors
hover:bg-[var(--color-surface-container-low)]/50
border-l-[3px]
```

Left border color: PDF → `border-l-[var(--color-primary)]/40`, Text → `border-l-[var(--color-accent)]/40`

Format icon container — PDF:
```
w-9 h-9 rounded-xl flex items-center justify-center shrink-0
bg-[var(--color-primary)]/10 text-[var(--color-primary)]
```

Format icon container — Text (accent):
```
bg-[var(--color-accent)]/10 text-[var(--color-accent)]
```

### 4.24 Patient Context Chip (inline with page header)

Used on "Build Protocol" and "Review Protocol" pages:
```
flex items-center gap-3 bg-[var(--color-surface-container-low)]
px-5 py-3 rounded-2xl shrink-0
```

### 4.25 Phase Section Header (Build Protocol / Edit Protocol)

```
<div className="flex items-center gap-4 mb-5">
  <span className="material-symbols-outlined text-[var(--color-primary)] text-lg">{icon}</span>
  <h3 className="text-lg font-extrabold text-[var(--color-on-background)]">{label}</h3>
  {/* optional count badge */}
  <div className="flex-1 h-px bg-[var(--color-outline-variant)]/30" />
</div>
```

### 4.26 Form Section Split Layout (two-column)

```
<div className="grid grid-cols-12 gap-12">
  <div className="col-span-12 lg:col-span-4">
    {/* Section title + description */}
    <h3>...</h3>
    <p className="text-sm text-[var(--color-on-surface-variant)] mt-2 leading-relaxed">...</p>
  </div>
  <div className="col-span-12 lg:col-span-8 grid grid-cols-2 gap-8">
    {/* Fields */}
  </div>
</div>
```

Divider between sections: `<div className="h-px bg-[var(--color-outline-variant)]/30" />`

### 4.27 Breadcrumb Nav

```
<nav className="flex items-center gap-2
  text-[11px] font-bold uppercase tracking-widest
  text-[var(--color-on-surface-variant)] mb-5">
  <Link href="..." className="hover:text-[var(--color-primary)] transition-colors">Label</Link>
  <span className="material-symbols-outlined text-xs">chevron_right</span>
  <span className="text-[var(--color-primary)]">Current Page</span>
</nav>
```

---

## 5. Interaction Patterns

### Loading States

**Page-level table/card:** Center the following inside `p-16`:
```
<p className="text-sm text-[var(--color-on-surface-variant)] font-medium">
  Loading patients...
</p>
```

**Page-level Suspense fallback:**
```
<div className="max-w-5xl mx-auto p-8 text-sm text-[var(--color-on-surface-variant)]">
  Loading…
</div>
```

**Modal loading:**
```
<p className="text-sm text-[var(--color-on-surface-variant)] font-medium">Loading…</p>
```
(inside a `rounded-3xl bg-white p-8` container with the standard backdrop)

**Button loading (in-progress):** Change label text to "Saving..." and add `disabled` — no spinner.
Use Material Symbol icon when useful:
```
<span className="material-symbols-outlined text-sm">hourglass_empty</span>
Saving...
```

### Empty States

Center the following inside `p-16 flex flex-col items-center justify-center text-center`:
```
<div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/5
  flex items-center justify-center mb-6">
  <span className="material-symbols-outlined text-3xl text-[var(--color-primary)]">
    {icon}
  </span>
</div>
<h3 className="text-xl font-extrabold text-[var(--color-on-background)] mb-2">
  No {items} yet
</h3>
<p className="text-sm text-[var(--color-on-surface-variant)] max-w-md leading-relaxed">
  {Explanation of how to create the first item.}
</p>
```

Icon suggestions by context:
- No patients: `person_search`
- No treatments: `description`
- No stages/protocols: `clinical_notes`

### Error States

**Inline field error** (below input):
```
<p className="text-[11px] font-semibold text-red-600 mt-1.5 ml-1">{error}</p>
```

**Form-level error** (below all fields, above action bar):
```
<p className="text-[12px] font-semibold text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">
  {error}
</p>
```

**Fetch error inline** (center of table area, replaces loading/empty):
```
<p className="text-sm text-red-600 font-medium">{error}</p>
```

**Modal load error:** Same container as loading state but with `text-sm text-red-600 font-medium` + a Close button.

**Full-page error** (when snapshot missing entirely):
```
<div className="max-w-5xl mx-auto py-12">
  <p className="text-sm text-red-600 font-medium mb-4">{error}</p>
  <Link href="..." className="text-sm font-bold text-[var(--color-primary)]">Back to ...</Link>
</div>
```

### Success Confirmation

**Inline success** (below form, after save):
```
<p className="mt-8 text-sm text-emerald-700 font-semibold">{successMessage}</p>
```

No toast system. Success is shown inline in the same area as errors.

### Validation

- Validation runs on submit (`validate()` returns `Record<string, string>`)
- Errors are set into a `errors` state map keyed by field name
- Each field clears its own error on change: `setErrors((prev) => { const { fieldName: _, ...rest } = prev; return rest; })`
- Error border on input: add `border-red-500` to input class
- Stronger error ring: `ring-2 ring-red-400/50`

### Disabled States

Buttons: `disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`
Inputs/selects: `disabled:opacity-60 disabled:cursor-not-allowed`
Read-only locked display (StageCard name when locked): `opacity-60 cursor-not-allowed` on a `div` styled like an input.

### Conditional Reveal (fade in)

LMP date field appears when `gender === "female" && age > 15`:
```
animate-[fadeIn_0.3s_ease-out]
```

StageCard body expands:
```
animate-[fadeIn_0.2s_ease-out]
```

The `fadeIn` keyframe is in `globals.css`:
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## 6. Layout

### Shell

```
Sidebar (fixed, w-64, left-0, top-0, z-50)
TopBar (fixed, right-0, w-[calc(100%-16rem)], h-20, z-40)
Main  (ml-64 pt-28 pb-16 px-12 min-h-screen)
```

The `pt-28` on main accounts for the TopBar height (h-20 = 80px) plus extra breathing room.

### Page Content Width

All page content is constrained to:
```
<div className="max-w-5xl mx-auto">
```

No page uses full-bleed content.

### Page Header Pattern

Every page follows this structure:

```
max-w-5xl mx-auto
  [breadcrumb nav]         ← pages with parent context only (mb-5)
  flex items-start justify-between mb-12
    div                    ← heading + description
      h2 (text-5xl ...)    ← mb-4
      p  (text-lg ...)
    [optional: CTA button or patient chip]
  [page body content]
  [action bar: pt-8 flex justify-between border-t]
```

### Dashboard Grid

3-column card grid:
```
grid grid-cols-3 gap-8
```

### Form Layout

Section split: `grid grid-cols-12 gap-12` (4-col description + 8-col fields).
Field grid inside right column: `grid grid-cols-2 gap-8`.
Full-width fields: `col-span-2`.

### Modal Z-indices

| Layer | z-index |
|---|---|
| Sidebar | `z-50` |
| Standard modals | `z-50` |
| LMP warning modal (above enrollment modal) | `z-[60]` or `z-[100]` |
| TopBar | `z-40` |

---

## 7. Icons

All icons use **Material Symbols Outlined** (`<span className="material-symbols-outlined">`).

Default variation settings (in globals.css): `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`

Active sidebar nav icons use fill variant: inline style `fontVariationSettings: "'FILL' 1"`

### Common Icon Usage

| Icon name | Used for |
|---|---|
| `dashboard` | Dashboard nav |
| `group` | Patients nav |
| `description` | Treatments nav / PDF format |
| `clinical_notes` | Protocol-related, no-content-yet icon |
| `person_search` | No patients empty state |
| `person_add` | Patients this month stat |
| `schedule` | Pending check-ins stat |
| `add` | Add buttons |
| `arrow_forward` | Next/submit CTA |
| `arrow_back` | Back navigation |
| `chevron_right` | Breadcrumb separator |
| `expand_more` / `expand_less` | Collapse toggle |
| `edit` | Edit action |
| `delete` | Remove stage |
| `close` | Remove chip / close medicine row |
| `content_copy` | Replicate protocol |
| `visibility` | View protocol |
| `play_circle` | Start treatment |
| `check_circle` | Confirm protocol |
| `hourglass_empty` | Saving in progress |
| `search` | Search input icon |
| `notifications` | Notification button |
| `verified_user` | Patient data privacy notice |
| `warning` | LMP warning modal |
| `science` | Purvakarma phase |
| `healing` | Pradhana Karma phase |
| `self_improvement` | Paschat Karma phase |
| `summarize` | Overview group in review |
| `chat` | Text message format |
| `chat_bubble` | Check-in question list item |

---

## 8. Key Class Patterns (Quick Reference)

```
# Page container
max-w-5xl mx-auto

# Double-card shell (tables and forms)
bg-white rounded-[2.5rem] p-1.5 shadow-xl shadow-[var(--color-primary)]/5 ring-1 ring-[var(--color-outline-variant)]/20

# Inner card (table)
bg-[var(--color-surface-container-lowest)] rounded-[2.3rem] overflow-hidden

# Inner card (form)
bg-[var(--color-surface-container-lowest)] rounded-[2.3rem] p-12

# Primary button
bg-[var(--color-primary)] text-[var(--color-on-primary)] px-10 py-4 rounded-2xl text-sm font-extrabold shadow-lg shadow-[var(--color-primary)]/30 hover:shadow-xl hover:bg-[var(--color-primary-hover)] active:scale-[0.98] transition-all

# Ghost button
px-8 py-4 text-sm font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 rounded-2xl transition-all

# Standard input
bg-[var(--color-surface-container-low)] rounded-2xl py-4 px-5 text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)]/40 form-input-focus transition-all font-medium

# Field label
text-[11px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]

# Page heading
text-5xl font-extrabold tracking-tight text-[var(--color-on-background)]

# Page description
text-lg font-medium leading-relaxed text-[var(--color-on-surface-variant)]

# Section divider
h-px bg-[var(--color-outline-variant)]/30

# Table header cell
text-[10px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]

# Table row
border-b border-[var(--color-outline-variant)]/10 last:border-b-0 hover:bg-[var(--color-surface-container-low)]/50 transition-colors

# Count badge
text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-0.5 rounded-full

# Warning banner
rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs text-amber-900
```
