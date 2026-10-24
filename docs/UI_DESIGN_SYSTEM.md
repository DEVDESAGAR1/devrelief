# DevRelief — UI Design System & Component Guidelines

**Product:** DevRelief  
**Document:** Design System & Component Guidelines  
**Status:** Milestone 0 Foundation  
**Design Philosophy:** Anti-AI Slop, High Information Density, Tactile Precision, Linear/Raycast-Inspired  

---

## 1. Design Principles & Anti-Slop Discipline

DevRelief rejects the generic "AI chat" template characterized by floating bubble cards, excessive pill badges, low-contrast pastel gradients, and giant pulsing AI icons. 

Our interface reflects high-performance developer tools:
1. **Zero Pill Soup:** Badges exist strictly for metadata that demands instant scannability (e.g. file formats, epistemic status). We do not decorate every noun with a colorful pill.
2. **Tactile Information Density:** Compact line heights, clear tabular borders, monospace alignment for technical values, and efficient padding.
3. **Epistemic Clarity:** Visual hierarchy cleanly distinguishes verified facts from probabilistic inferences.
4. **Accessible Contrast:** Strong borders, crisp dark-slate typography, and unmistakable focus rings.

---

## 2. Design Tokens

### 2.1 Color Palette

DevRelief uses a refined neutral slate palette paired with an engineering cobalt primary accent and strict semantic status colors:

```css
:root {
  /* Surface & Background Neutrals */
  --color-canvas-bg: #0b0f17;         /* Deep obsidian background */
  --color-surface-base: #111827;      /* Base workbench surface */
  --color-surface-elevated: #1f2937;  /* Card & pane surface */
  --color-surface-subtle: #1e293b;    /* Hover & subtle table rows */
  --color-border-subtle: #374151;     /* Default dividers & borders */
  --color-border-strong: #4b5563;     /* Active borders & focus boundaries */

  /* Text & Foreground */
  --color-text-primary: #f9fafb;     /* High contrast body & headers */
  --color-text-secondary: #9ca3af;   /* Captions & secondary labels */
  --color-text-muted: #6b7280;       /* Placeholders & disabled text */

  /* Brand Cobalt Accent */
  --color-brand-500: #3b82f6;
  --color-brand-600: #2563eb;
  --color-brand-700: #1d4ed8;
  --color-brand-subtle: rgba(37, 99, 235, 0.12);

  /* Epistemic Status Colors */
  --color-fact-bg: rgba(16, 185, 129, 0.12);
  --color-fact-border: #059669;
  --color-fact-text: #34d399;

  --color-inference-bg: rgba(245, 158, 11, 0.12);
  --color-inference-border: #d97706;
  --color-inference-text: #fbbf24;

  --color-unknown-bg: rgba(148, 163, 184, 0.12);
  --color-unknown-border: #64748b;
  --color-unknown-text: #cbd5e1;

  /* Alert States */
  --color-danger-bg: rgba(239, 68, 68, 0.12);
  --color-danger-border: #dc2626;
  --color-danger-text: #f87171;
}
```

### 2.2 Typography Scale

DevRelief uses modern system sans for UI chrome and a robust monospace stack for code, logs, and citations:

- **UI Sans:** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Code & Logs Monospace:** `JetBrains Mono, "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace`

| Token | Size | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `text-display` | 24px (1.5rem) | 32px | 600 SemiBold | Screen titles, workbench headers |
| `text-title` | 18px (1.125rem) | 26px | 600 SemiBold | Panel titles, modal headers |
| `text-heading` | 15px (0.9375rem) | 22px | 600 SemiBold | Card titles, section subheadings |
| `text-body` | 14px (0.875rem) | 20px | 400 Regular | Primary reading copy, table cells |
| `text-caption` | 12px (0.75rem) | 16px | 500 Medium | Badges, metadata, timestamps |
| `text-mono-sm` | 12px (0.75rem) | 18px | 400 Regular | Citations, log lines, diff snippets |

### 2.3 Spacing & Grid System

Based on a strict 4px/8px rhythm:
- `space-1`: 4px
- `space-2`: 8px
- `space-3`: 12px
- `space-4`: 16px
- `space-6`: 24px
- `space-8`: 32px

### 2.4 Border Radii
- Standard controls (Buttons, inputs): `rounded-md` (6px)
- Cards & dialogs: `rounded-lg` (8px)
- Full round / pills: *Restricted exclusively to circular avatar icons or numerical count badges*.

---

## 3. Core Component Library Specifications

### 3.1 Buttons
- **Primary:** Solid cobalt background (`bg-brand-600`), white text, crisp 1px inset highlight. Hover: `bg-brand-500`. Active: scale 0.98.
- **Secondary / Ghost:** Subdued surface (`bg-surface-elevated` or transparent), subtle border (`border-border-subtle`), text `text-primary`.
- **Danger:** Subtle red background (`bg-danger-bg`), border `border-danger-border`, text `text-danger-text`.
- **States:** All buttons include `:focus-visible` with a 2px offset ring, and disabled state with `opacity-50 pointer-events-none`.

### 3.2 Form Controls & File Dropzone
- **Text Inputs & Textareas:** Dark slate background, 1px subtle border, sharp contrast focus ring (`border-brand-500 ring-1 ring-brand-500`).
- **Universal Multi-File Dropzone:**
  - High-contrast dashed border (`border-2 border-dashed border-border-strong`).
  - Active drag-over state changes to cobalt border with subtle blue tint background.
  - Informational caption listing supported extensions and file size limits (50 MB total).

### 3.3 Epistemic Badges (Facts vs Inferences vs Unknowns)
Must be accompanied by text and icon for accessibility:

```html
<!-- Confirmed Fact Badge -->
<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-600/50">
  <CheckCircle2 class="w-3.5 h-3.5 text-emerald-400" />
  Confirmed Fact
</span>

<!-- Inference Badge -->
<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-amber-950/40 text-amber-300 border border-amber-600/50">
  <Sparkles class="w-3.5 h-3.5 text-amber-400" />
  Inference
</span>

<!-- Unknown / Missing Data Badge -->
<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-600/50">
  <HelpCircle class="w-3.5 h-3.5 text-slate-400" />
  Unknown
</span>
```

### 3.4 Interactive Provenance Citation Link
Inline source citations are rendered as interactive monospace buttons:

```html
<button class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-elevated text-brand-400 font-mono text-xs border border-border-subtle hover:border-brand-500 hover:text-brand-300 transition-colors">
  <FileText class="w-3 h-3" />
  <span>build_output.log:1482</span>
</button>
```
*Interaction:* Clicking this opens the context drawer focused directly on line 1482.

### 3.5 Log & Code Snippet Box
- Syntax-highlighted background `#0d1117`.
- Monospace font `12px` with persistent line numbers.
- Integrated quick copy button and highlighted target line.
- Bounded viewport with custom slim scrollbars.

---

## 4. Mobile Ergonomic Controls

1. **Touch Targets:** Any interactive button, chip, tab, or link has at least `44px x 44px` hit boundary via padding or min-height.
2. **Bottom Sheet Drawers:** Provenance inspections and workflow parameters on mobile slide up as bottom sheets with a physical drag-handle pill and smooth exit transitions.
3. **Floating Primary Action:** On small screens, the primary execution button pins to the bottom bar above the keyboard safe area.
