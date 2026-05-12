# Trakt Design System

This document defines the visual identity, UI patterns, and implementation rules for the Trakt personal media tracker. It should describe the app as it is being built now, not an idealized older version of the stack.

## 1. Product Feel

Trakt is a dark, image-forward personal media library. It should feel dense, cinematic, and useful: closer to a high-end media dashboard than a marketing site or social network.

The interface should prioritize:

- Fast scanning across movies, shows, episodes, history, and stats.
- Strong media artwork: posters, backdrops, stills, and compact metadata overlays.
- Clear ownership actions: watched, watchlist, collection, rating, refresh, and exclusions.
- A classic Trakt-inspired dark aesthetic with modern spacing and accessible controls.

Avoid interfaces that feel overly airy, promotional, or decorative. This app is for repeated use.

## 2. Implementation Stack

The web app uses:

- Next.js app router.
- Tailwind CSS utilities and custom tokens in `apps/web/tailwind.config.ts`.
- Global theme variables in `apps/web/app/globals.css`.
- Material Symbols for iconography, loaded in `apps/web/app/layout.tsx`.
- Custom components and page-local UI patterns.

The app does not currently use shadcn/ui or Lucide as its active component/icon foundation. If that changes later, update this document at the same time.

## 3. Color

Use Tailwind tokens and CSS theme variables before hard-coded hex values.

Primary surfaces:

- `background`: app background.
- `surface-container-lowest`: deepest panels and page backdrops.
- `surface-container-low`: low-elevation regions.
- `surface-container`: default inputs, dropdowns, and contained controls.
- `surface-container-high`: poster placeholders and higher cards.
- `surface-container-highest`: selected or emphasized neutral surfaces.

Text:

- `text-on-surface`: primary body text.
- `text-on-surface-variant`: secondary text.
- `text-white`: acceptable for strong display text over dark imagery.
- `text-white/40` and `text-white/60`: common subdued metadata states.

Accent:

- `accent`: dynamic theme accent, currently red or blue.
- `accent-hover`: hover state for primary accent actions.
- `accent-light`: brighter accent for emphasis.

Hard-coded colors such as `#181818`, `#0f0f0f`, and `#1a1a1a` should be treated as cleanup targets unless they are part of a deliberate image overlay or third-party chart style.

## 4. Typography

The app uses Inter via Tailwind's `font-sans`.

Canonical type tokens:

- Page H1: `text-h1 font-black tracking-tight`.
- Section heading (Recently Watched, Last 30 Days, Recommendations): `text-h2 font-black tracking-tight` with accent rule accent bar.
- Subsection or smaller heading: `text-h3 font-bold`.
- Card title (RecentCard, RecommendationCard): `font-bold text-lg` or `text-sm` depending on card type.
- Body text: `text-sm` or `text-body-md`, depending on density.
- Controls, filters, and metadata: prefer `text-sm`.
- Tiny badges and eyebrows: `text-[10px]`, `uppercase`, `tracking-widest`, `font-bold` or `font-black`.

Page titles should normally use title case, not all caps. All-caps text is best reserved for small metadata labels, navigation labels, badges, and controls.

Avoid `text-xs` as a default UI size. It tends to read too small in this app's dense, dark interface. If text needs to be smaller than `text-sm`, use an intentional custom size such as `text-[13px]` or reserve `text-[10px]` for true micro-labels.

## 5. Page Structure

Standard app pages should use:

```tsx
<div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
  ...
</div>
```

Standard page headers should include:

- H1 using `text-h1 font-black tracking-tight text-on-surface`.
- Optional subtitle using `text-on-surface-variant/70`.
- Optional eyebrow using `text-[10px] uppercase tracking-widest font-black text-accent`.

Detail pages may use full-width artwork heroes with overlays. Dashboard sections may use richer composition, but should still preserve the same typography and control language.

## 6. Navigation

The active global navigation is `TopNav`.

TopNav includes:

- Brand mark.
- Global search.
- Primary navigation links.
- Avatar dropdown for secondary destinations.

`SideNav` exists in the codebase but is not currently rendered by the root layout. Either remove it or reintroduce it intentionally; do not let both models drift independently.

## 7. Controls

Primary actions:

- Use `bg-accent text-white`.
- Use `hover:bg-accent-hover` or `hover:bg-accent-light` depending on emphasis.
- Use bold type.

Secondary actions:

- Use tokenized dark surfaces, subtle borders, and subdued text.
- Prefer `border-white/10`, `text-white/60`, and `hover:text-white`.

Disabled states:

- Use `disabled:opacity-50` or `disabled:opacity-30`.
- Avoid hover styles that imply disabled controls are interactive.

Icon buttons:

- Use Material Symbols.
- Provide `aria-label` when the button has no visible text.
- Use fixed square dimensions for pagination, carousel arrows, and hero navigation.

## 8. Filters, Tabs, And Sorting

Filter controls should use one of these patterns:

- Segmented control: for compact mutually exclusive filters near a header.
- Pill row: for horizontal filter sets, especially search-style refinement.
- Sidebar category nav: for browse/discover pages where each category has a label and description.
- Dropdown/menu: for sort selection or secondary configuration.

Do not invent a new filter style per page. Similar pages should share visual treatment:

- All filter/refinement controls should use the rounded pill pattern (History, Calendar, Movies/Shows discover, etc.).
- Sidebar category nav for browse/discover pages may have labels and descriptions alongside.
- Dropdowns/menus for sort selection or secondary configuration are acceptable alternatives.

**Filter pills (chips):**

Use this consistent styling for all filter/refinement pills across the app:

- Shape: `rounded-full`, `px-3 py-2`.
- Type: regular weight (no `font-black`), sentence case (no `uppercase`), no letter spacing (no `tracking-*`).
- Active state: `bg-accent text-white text-sm`.
- Inactive state: `bg-surface-container-low border border-white/10 text-on-surface-variant/70 text-sm` with `hover:bg-surface-container hover:text-on-surface transition-colors`.

Apply this pattern to period filters (top-rated), time range filters, and other refinement pills throughout the app.

## 9. Pagination And More Results

Use consistent language and placement:

- Page-by-page browse: compact previous/next icon buttons with visible page number.
- Infinite or append-only lists: centered `Load More`.
- Calendar ranges: `View Next {range} Days` and `Back to Today`.

Pagination controls should have:

- Clear disabled states.
- Fixed dimensions.
- Consistent radius and border treatment.
- Matching text treatment: bold, uppercase only for command buttons.

Search currently displays a `Load More Results` control. Make sure it is backed by real pagination before treating it as a standard pattern.

## 10. Cards And Surfaces

Use these surface patterns:

- Poster card: aspect `[2/3]`, image-first, minimal chrome.
- Backdrop card: `aspect-video`, gradient overlay, title and metadata at the bottom.
- Glass panel: use `.glass-panel` for dashboard/stats/settings panels.
- Modal: dark elevated surface, visible border, constrained width.

Border radius should be intentional:

- Posters and compact media cards: `rounded-lg` or square when matching discover grids.
- Panels and dashboard cards: `rounded-xl`.
- Large feature panels and modals: `rounded-xl` or `rounded-2xl`.
- Pills, avatars, progress bars, and round icon buttons: `rounded-full`.

Avoid mixing square cards, `rounded-lg`, `rounded-xl`, and `rounded-2xl` within the same repeated component family.

## 11. Imagery

Media artwork should carry the experience.

Use:

- Posters for movie/show grids.
- Backdrops for heroes and schedule cards.
- Stills for episodes where available.
- Gradients over images for text readability.

Fallbacks should use tokenized dark surfaces and Material Symbol icons. Placeholder text like "No Image" is acceptable only when there is no suitable icon or layout-specific fallback.

## 12. Loading, Empty, And Error States

Loading copy should use a single ellipsis style: `Loading...` if ASCII is preferred, or a Unicode ellipsis (`U+2026`) if the file already uses Unicode consistently. Do not mix both styles on the same screen.

Empty states should include:

- A subdued Material Symbol icon when helpful.
- Short explanatory copy.
- No decorative illustration unless the page needs it.

Error states should use:

- `text-error`, `border-error/30`, and `bg-error/10`.
- Specific but concise copy such as "Failed to load movies."

## 13. Copy Rules

Use concise labels:

- `Movies`, `Shows`, `Episodes`, `All Media`, `Airing`, `Ended`.
- Prefer `TV Shows` for the primary Shows discover H1 if distinguishing from movies.
- Use title case for major page and section headings.
- Use uppercase for badges, metadata labels, nav labels, and compact command buttons.

Use consistent punctuation:

- Pick one loading ellipsis style per file.
- Use a middle dot (`U+00B7`) or `&middot;` consistently for media metadata separators.
- Avoid mojibake characters; if rendered text shows garbled encoding sequences, fix the source encoding.

## 14. Known Cleanup Targets

These are the main consistency gaps to address in implementation:

- Replace recurring hard-coded dark hex values with Tailwind surface tokens.
- Normalize page headers, especially Search and Calendar.
- Standardize filters across Collection, History, Ratings, and Progress.
- Standardize pagination and "load more" controls.
- Decide whether poster cards should be square-edged or rounded per page family.
- Remove or restore `SideNav` intentionally.
- Normalize loading copy and visible ellipsis usage.
- Convert one-off card treatments to the card/surface patterns above.

## 15. Summary

Trakt should feel like a premium, dark, personal media library: dense enough to scan quickly, visual enough to feel cinematic, and consistent enough that every screen feels like part of the same tool.
