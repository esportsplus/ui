# Docs components

Reusable presentation belongs here. Routes in `actions/` supply data and compose
these components; they should not own shared component styles. Page-specific
content and styles belong with their action, such as the installation guide in
`actions/docs/index.ts` and `actions/docs/scss/index.scss`. The tokens action owns
its color palettes, contrast calculation, clipboard feedback, and swatch styles.

| Component | Owns |
| --- | --- |
| `code` | TypeScript syntax colors, line numbers, preserved source whitespace, scrolling, and a floating copy control |
| `nav/tree` | Shared navigation groups, links, titles, and states for the sidebar and in-page navigation |
| `page` | Docs page headings, inline library card links for Components and CSS Utilities grids, detail pages, and empty states |
| `page/head` | Library page title and subtitle, optional breadcrumb, and previous/next navigation |
| `preview` | Example frames and inline Preview/Code controls with the library highlight; render factories mount near the viewport and keep their state after mounting |
| `root` | Docs-wide theme aliases and shell tokens |
| `search` | Search state, trigger, and the library `command` palette wired to the shared nav tree renderer |
| `sidebar` | Collapsible documentation navigation that pushes content aside on every screen size |
| `spec` | Shared data tables, token/value typography, and table-header surface and corner styling |
| `toaster` | The shared docs toast queue, placement, and toast surface styles |
| `viewer` | Responsive outer shell grid |

Components with TypeScript renderers import their own styles. `ui.ts` loads the
global shell and shared page/table styles. Use the library's components and CSS
variables for base behavior and appearance; docs styles add only docs-specific
layout or presentation.

Routes return page data. `middleware/layout/index.ts` lists the routes whose responses
are wrapped in the shared main content and TOC layout, including the fallback.
The middleware owns that markup and its styles in `middleware/layout/scss/index.scss`.

Shell classes use component names such as `.page` and `.sidebar`.
The sidebar and routed content share the viewer shell and one open state. The
sidebar starts open on desktop and closed on small screens. An effect watches
the request path and closes the sidebar after route changes on small screens;
desktop navigation preserves its open state. CSS media queries control the
layout; on small screens the content keeps its width as it shifts.
The drawer owns the brand, release badge, search icon, textured surface, and full-height right
divider, so they slide together. Header padding sizes the brand row and aligns
the fixed sidebar toggle. The search icon sits beside the release badge, and
the command palette mounts in the viewer shell
so its keyboard shortcut also works with the sidebar closed. Navigation scrolls below
the brand row and uses the shared nav tree styling and original responsive content spacing.
Navigation data keeps links directly on each section; the sidebar supplies the
group structure used by the tree renderer.
The command palette passes its filtered groups to `navTree` through `command`'s
`render` callback. Sidebar and command results use the same markup and tree styles;
the tree's `--command` modifier changes the active highlight and text colors.
Scope documentation page styles under `.main > .page` so library pages in live
examples keep their own presentation.

Detail pages pass `variant.render` to `preview` so offscreen examples are not constructed yet.
Pre-rendered theme content still mounts immediately. Focus and hash navigation mount a targeted
example before scrolling to it; visited examples retain their state while the browser skips
rendering their offscreen contents.

Component detail routes group related states explicitly in `examples/groups.ts`. The preview
title stays fixed and the library's `select()` swaps the render factory. Original variant
anchors still select their corresponding state. Each card owns its Preview/Code selection,
keeps its live example mounted, and lazily loads the selected variant's TypeScript snippet.
`docs/scripts/example-source.mjs` captures the original render factory, its imports and helper
dependencies before template compilation; generated examples include their selected closure
values. Changing a variant while viewing Code loads its matching snippet. In-page navigation
and hash links return the targeted card to Preview. All page headers use `pageHead`.
The header uses the library's `page-title` and `page-subtitle` classes.
Its optional `breadcrumb` list renders the library breadcrumb inside the header;
an omitted or empty list leaves it out. The header also owns previous/next navigation
and its layout styles in `page/scss/head.scss`. Both navigation controls use one
arrow icon, rotated with CSS for the previous page.
