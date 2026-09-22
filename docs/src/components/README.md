# Docs components

Reusable presentation belongs here. Routes in `actions/` supply data and compose
these components; they should not own shared component styles.

| Component | Owns |
| --- | --- |
| `color-palette` | Color families, contrast, clipboard feedback, and swatch styles |
| `command` | Searchable command dialog, using the library overlay, modal, card, input, and button |
| `doc-card` | Documentation links built on the library card |
| `header` | Site header and primary navigation |
| `layout` | Main content placement and composition with the TOC |
| `nav/tree` | Shared navigation groups, links, titles, and states for the sidebar and in-page navigation |
| `page` | Docs page headings, card grids, detail pages, and empty states |
| `preview` | The single example frame renderer used by details and themes |
| `prose` | Markdown rendering and prose typography; tables use `spec-table` |
| `root` | Docs-wide theme aliases and shell tokens |
| `search` | Search state, trigger, and command-dialog integration |
| `sidebar` | Documentation navigation structure and placement |
| `spec` | Shared data tables and token/value typography |
| `table-head` | Table-header surface and corner styling, included by `spec` |
| `viewer` | Responsive outer shell grid |

Components with TypeScript renderers import their own styles. `ui.ts` loads the
global shell and shared page/table styles. Use the library's components and CSS
variables for base behavior and appearance; docs styles add only docs-specific
layout or presentation.

Do not redefine library classes such as `.page` or `.sidebar` in docs. The docs
page adds `.docs-page` to the library page; the navigation sidebar uses
`.docs-sidebar` because it is a sticky navigation column, not the library's
positioned sidebar. This keeps documentation styles out of live examples.
