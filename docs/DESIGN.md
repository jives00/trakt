# DESIGN.md

This document defines the visual identity, UI/UX principles, and branding guidelines for the Trakt Clone project. The goal is to maintain a consistent, "classic" media-tracking aesthetic inspired by the pre-redesign Trakt.tv interface.

## 1. Visual Identity & Branding

### Core Concept
The design should evoke a sense of "Personal Media Library." It is not a social network; it is a high-fidelity, content-centric dashboard for a single user. The aesthetic should be dark, immersive, and focused on high-quality imagery (posters, backdrops).

### Aesthetic Inspiration
*   **Primary Reference:** Pre-redesign Trakt.tv.
*   **Key Attributes:** High contrast, heavy use of imagery, dark mode by default, information-dense but readable, "classic" web feel (less whitespace-heavy than modern minimal SaaS).

### Color Palette (Actual Implementation)

The application uses a Material Design 3-inspired token system for its color palette, defined in `apps/web/tailwind.config.ts`.

*   **Surface Tones (Backgrounds):**
    *   `surface-container-lowest`: `#0c0f0f` (Deepest background)
        *   `surface-container-low`: `#1a1c1c`
    *   `surface-container`: `#1e2020`
    *   `surface-container-high`: `# 282a2b`
    *   `surface-container-highest`: `#333535`
*   **Primary & Accent:**
    *   `primary`: `#ffb3af` (Light accent)
    *   `primary-container`: `#e8002d` (Bright red/pink for key actions/highlights)
*   **Text:**
    *   `on-surface`: `#e2e2e2` (Main text)
    *   `on-surface-variant`: `#cccccc` (Secondary text)
*   **Error:**
    *   `error`: `#ffb4ab`

### Typography
*   **Sans-Serif Stack:** Inter or System Sans-Serif.
*   **Usage:**
    *   **Headings:** Bold, high prominence.
    *   **Body:** Regular weight, optimized for legibility in dense lists.
    *   **Monospace:** For technical metadata (e.g., API keys, timestamps in logs).

---

## 2. UI/UX Principles

### Content-First Approach
Every screen should prioritize media artwork (Post: Posters for movies, Fanart for shows). The UI should act as a frame for the metadata, not a distraction from it.

### Information Density
Unlike modern "airy" designs, this app favors a slightly higher information density. Users should be able to scan lists of episodes or movies without excessive scrolling. Use compact components (e.g., `shadcn/ui` tables and lists) appropriately.

### Interaction Patterns
*   **Immersive Navigation:** Use sidebars or top navs that stay out of the way of the content.
*   Usually, for a single-user app, deep nested menus should be avoided in favor of clear, flat hierarchies.
*   **Immediate Feedback:** When "scrobbling" or marking an item as watched, use subtle toast notifications or icon transitions to confirm the action.
*   **Skeleton States:** Always use skeleton loaders for media-heavy components to prevent layout shift during metadata fetching.

### Component Library (Implementation)
*   **Tailwind CSS:** All styling must use Tailwind utility classes.
*   **shadcn/ui:** Use `shadcn/ui` as the foundational component library to ensure accessibility and consistency.
*   **Responsive Design:**
    *   **Web:** Desktop-first, optimized for large monitors (dashboard views) but usable on tablets.
    *   **Mobile:** Highly optimized for single-hand use, utilizing thumb-friendly touch targets.

---

## 3. Design Tokens & Implementation

### Implementation Strategy
*   **Tailwind Config:** Define the primary palette, spacing, and typography in `tailwind.config.js`.
*   **Global CSS:** Use `globals.css` for base layer resets and CSS variables for the theme (e.g., `--background`, `--primary`).

### Iconography
*   **Lucide React:** Use Lucide icons for all UI elements to maintain a consistent, lightweight, and clean look.

---

## 4. Summary of "The Vibe"
> **"A premium, dark, and immersive library for your media collection. It feels like a high-end streaming service, but entirely under your control."**
