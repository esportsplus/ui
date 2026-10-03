# Docs components

Reusable presentation belongs here. Routes in `actions/` supply data and compose
these components; they should not own shared component styles.

| Component | Owns |
| --- | --- |
| `color-palette` | Color families, contrast, clipboard feedback, and swatch styles |
| `code` | TypeScript syntax colors, line numbers, preserved source whitespace, scrolling, and a floating copy control |
| `doc-card` | Documentation links built on the library card |
| `example-view` | Compact Preview/Code button group above each component preview card with a library highlight for the active selection |
| `header` | Site header and primary navigation |
| `layout` | Main content placement and composition with the TOC |
| `nav/tree` | Shared navigation groups, links, titles, and states for the sidebar and in-page navigation |
| `page` | Docs page headings, card grids, detail pages, and empty states |
| `preview` | Example frames; render factories mount near the viewport and keep their state after mounting |
| `prose` | Markdown rendering and prose typography; tables use `spec-table` |
| `root` | Docs-wide theme aliases and shell tokens |
| `search` | Search state, trigger, and the library `command` palette wired to the nav |
| `sidebar` | Collapsible documentation navigation that pushes content aside on every screen size |
| `spec` | Shared data tables and token/value typography |
| `table-head` | Table-header surface and corner styling, included by `spec` |
| `viewer` | Responsive outer shell grid |

Components with TypeScript renderers import their own styles. `ui.ts` loads the
global shell and shared page/table styles. Use the library's components and CSS
variables for base behavior and appearance; docs styles add only docs-specific
layout or presentation.

Shell classes use component names such as `.header`, `.page`, and `.sidebar`.
The sidebar and routed content share the viewer shell and one open state. The
sidebar starts open on desktop and closed on small screens. An effect watches
the request path and closes the sidebar after route changes on small screens;
desktop navigation preserves its open state. CSS media queries control the
layout; on small screens the content keeps its width as it shifts.
Scope documentation page styles under `.main > .page` so library pages in live
examples keep their own presentation.

Detail pages pass `variant.render` to `preview` so offscreen examples are not constructed yet.
Pre-rendered theme content still mounts immediately. Focus and hash navigation mount a targeted
example before scrolling to it; visited examples retain their state while the browser skips
rendering their offscreen contents.

Component detail routes group related states explicitly in `examples/groups.ts`. The preview
title stays fixed and the library's `select.menu` swaps the render factory. Original variant
anchors still select their corresponding state. Each card owns its Preview/Code selection,
keeps its live example mounted, and lazily loads the selected variant's TypeScript snippet.
`docs/example-source.mjs` captures the original render factory, its imports and helper
dependencies before template compilation; generated examples include their selected closure
values. Changing a variant while viewing Code loads its matching snippet. In-page navigation
and hash links return the targeted card to Preview. Detail page breadcrumbs use the library component directly,
without the example's background or resize handle.
