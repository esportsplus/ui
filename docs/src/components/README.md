# Docs components

Reusable presentation belongs here. Routes in `actions/` supply data and compose
these components; they should not own shared component styles. Page-specific
content and styles belong with their action, such as the installation guide in
`actions/docs/index.ts` and `actions/docs/scss/index.scss`. The tokens action owns
its color palettes, contrast calculation, clipboard feedback, and swatch styles.

| Component | Owns |
| --- | --- |
| `code` | TypeScript syntax colors, line numbers, preserved source whitespace, scrolling, and a floating copy control |
| `directory` | Components and CSS Utilities index grids of library card links, and their detail pages, each example composed from the library `preview` with its variant select and view buttons |
| `layout` | A page's main content, previous/next cards and scroll-spied TOC; every action returns its page through it |
| `page` | Docs page and section layout, and empty states |
| `page/header` | Library page title and subtitle, optional breadcrumb and note, and previous/next navigation |
| `root` | Docs-wide theme aliases |
| `sidebar` | Documentation navigation and its search, rendered as the library `panels` layout's static left sidebar |
| `spec` | Shared data tables, token/value typography, and table-header surface and corner styling |
| `toaster` | The shared docs toast queue, placement, and toast surface styles |
| `viewer` | Routed content grid in the layout's main area, with the TOC column |

Components with TypeScript renderers import their own styles. `ui.ts` loads the
global shell and shared page/table styles. Use the library's components and CSS
variables for base behavior and appearance; docs styles add only docs-specific
layout or presentation.

Every response is renderable. Actions build their page data and pass it to `layout`,
which wraps it in the shared main content, previous/next cards and TOC, and return
that; the not-found middleware does the same. The TOC is the library `nav.toc`,
driven by a `nav.spy` scroll spy over the page's headings.

Shell classes use component names such as `.page` and `.sidebar`.
The library `panels` layout owns the sidebar's frame, surface, toggle, Escape handling and swipe; the docs give it the
navigation and the routed page as single unsortable surfaces, so the sidebar is static and the page has no tabs. The navigation
sidebar starts open on desktop and closed on small screens. An effect watches
the request path and closes the sidebar after route changes on small screens;
desktop navigation preserves its open state. CSS media queries control the
layout; on small screens the card keeps its width as it shifts.
The sidebar holds the brand, release badge and search field, so they slide with the layout's
drawer. Header padding sizes the brand row and aligns the fixed sidebar toggle. The search field sits in a tools row below the brand
and filters the tree in place through each link's `visible`: a link shows when its label matches, a section whose name
matches shows all its links, and a section left with none hides. Matching ignores case, dashes and spaces. Mod+K
focuses the field from anywhere, opening the sidebar first; Enter opens the first match, and Escape clears the query,
then leaves the field. Navigation scrolls below
the brand row and uses the library `nav.tree` and original responsive content spacing.
Navigation data keeps links directly on each section; the sidebar supplies the
group structure used by the tree renderer, and the docs capitalize the labels the tree leaves as written.
Scope documentation page styles under `.main > .page` so library pages in live
examples keep their own presentation.

Detail pages pass `variant.render` to the library `preview.stage` so offscreen examples are not constructed yet.
Pre-rendered theme content still mounts immediately. Focus and hash navigation mount a targeted
example before scrolling to it; visited examples retain their state while the browser skips
rendering their offscreen contents.

`examples/index.ts` eagerly discovers default exports from top-level example files
and each example directory's `index.ts`, then sorts entries by name. The registry,
group definitions, and form helper directories are excluded from discovery. New
examples in either supported location register automatically and export an `Entry`
with a name and variants.

Component detail routes group related states explicitly in `examples/groups.ts`. The preview
title stays fixed and the library's `select()` swaps the render factory. Original variant
anchors still select their corresponding state. Each card owns its Preview/Code selection,
keeps its live example mounted, and lazily loads the selected variant's TypeScript snippet.
`docs/scripts/example-source.mjs` captures the original render factory, its imports and helper
dependencies before template compilation; generated examples include their selected closure
values. Changing a variant while viewing Code loads its matching snippet. In-page navigation
and hash links return the targeted card to Preview. All page headers use `pageHeader`.
The header uses the library's `page-title` and `page-subtitle` classes.
Its optional `breadcrumb` list renders the library breadcrumb inside the header;
an omitted or empty list leaves it out. The header also owns previous/next navigation
and its layout styles in `page/scss/head.scss`. Both navigation controls use one
arrow icon, rotated with CSS for the previous page.
