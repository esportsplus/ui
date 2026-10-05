type Meta = {
    description: string;
    // Display name, for slugs that don't read right capitalized (e.g. acronyms).
    label?: string;
};


const meta: Record<string, Meta> = {
    accordion: {
        description: 'Vertically stacked, collapsible panels for revealing sections of content on demand.'
    },
    announcement: {
        description: 'Animated container that slides announcement content in from the top and folds its space away when state.active turns off.'
    },
    banner: {
        description: 'Full-width promotional strip for announcements and notices.'
    },
    breadcrumb: {
        description: 'Path trail that folds middle segments into a menu as space runs out, sliding the rest to close the gap.'
    },
    button: {
        description: 'Trigger actions with color and modifier variants, plus copy, loading, and hold-to-confirm feedback that fills the whole button or just its label, and an async save that morphs into a spinner, confirms with a check, and shakes on failure.'
    },
    capslock: {
        description: 'Keycap warning that fades in beside "Caps Lock is on" while the lock is engaged, read from any key or pointer event on the page.',
        label: 'Caps Lock'
    },
    card: {
        description: 'Rounded surface that groups related content and actions, plus cards that morph into a detail dialog and fly back into their slot.'
    },
    cc: {
        description: 'Payment card form with a live card preview that flips for the CVC, brand detection, auto-formatting and Luhn validation.',
        label: 'CC'
    },
    'chat-minimap': {
        description: 'A rail of lines mapping a conversation, one per turn: the hovered line swells its neighbours, a card previews the turn, the turns in view stay lit as the thread scrolls, and the rail grows with the chat.',
        label: 'Chat Minimap'
    },
    checkbox: {
        description: 'Binary selection control, plus checklist groups with a select-all header that goes mixed and Shift-click range selection.'
    },
    clipboard: {
        description: 'Copy-to-clipboard affordance with click and programmatic variants.'
    },
    'code-editor': {
        description: 'Source editor with syntax colors for TypeScript, CSS, HTML, JSON, Python and Markdown, undo and redo, find and replace, multiple and rectangular selections, folding, wrap and a minimap; language services add completion, hover and diagnostics, the Markdown editor renders in place one block at a time, and the workspace adds a file explorer, tabs and quick open.',
        label: 'Code Editor'
    },
    'color-picker': {
        description: 'Saturation pad, hue and opacity sliders, a hex field, and a recent-colors row that reorders as you commit.'
    },
    command: {
        description: 'Keyboard-first ⌘K command palette with fuzzy search, highlighted matches, grouped results, and arrow-key navigation.'
    },
    container: {
        description: 'Width-constrained wrapper that centers content within the page.'
    },
    counter: {
        description: 'Animated number display with currency and formatting support.'
    },
    datalist: {
        description: 'Scroll-snapped wheel picker where the scroll position is the selection.'
    },
    dock: {
        description: 'macOS-style dock whose icons swell toward the cursor and launch with a bounce and a running light.'
    },
    error: {
        description: 'Wraps any control that keeps its error in state.error: the control shakes and turns red, and the message grows out of it in the morph tooltip on any side.'
    },
    'file-tree': {
        description: 'Collapsible file and folder tree with guide lines, locked items, natural sorting, and expand or collapse all (Magic UI).'
    },
    filter: {
        description: 'Headless filter controller: bring your own triggers and layout, and matching items shift, scale, and fade into place.'
    },
    frame: {
        description: 'Sibling frames sharing one spot, one shown at a time: instant, horizontal slide, vertical scroll, or an in-place swap that drifts in from its side (the tooltip.shared swap), shareable by any component.'
    },
    grid: {
        description: 'Responsive auto-fit grid for arranging children.'
    },
    heatmap: {
        description: 'Calendar heatmap of daily values that sweeps in by column, with a templated floating tooltip, drag-to-scroll and arrow-key grid navigation.'
    },
    highlight: {
        description: 'Hover highlight that glides behind sibling items and rests on the active one, as a fill or a line along one edge that can stretch toward the next item.'
    },
    icon: {
        description: 'Sprite-backed SVG icon with accessible sizing.'
    },
    image: {
        description: 'Image previews with rounded framing, overlapping stacks, and status indicators, plus lazyloaded images that fade their placeholder out over the decoded full image.'
    },
    'inline-edit': {
        description: 'Click-to-edit text that swaps to a field in place, saving on Enter or blur and cancelling on Escape; the rich variant edits markdown in place, with a per-field whitelist of formatting in a toolbar that follows the selection.'
    },
    input: {
        description: 'Single-line text field with focus and validation states, a chip field that turns typed or pasted text into tags, and a numeric field whose label scrubs the value on drag.'
    },
    json: {
        description: 'Structured JSON viewer with download support.'
    },
    link: {
        description: 'Inline and block navigation links with hover states.'
    },
    loading: {
        description: 'Border-based loading indicator for surfaces.'
    },
    marquee: {
        description: 'Infinitely scrolling logo strip that eases to a stop on hover or focus, and can speed up and reverse with the page scroll.'
    },
    metric: {
        description: 'Metric card with a line chart that draws itself in and redraws to fit its container, with a scrubbable readout for pointer, touch, and arrow keys, plus a live value that marks each change with a directional roll, tint, and arrow.'
    },
    'notification-bell': {
        description: 'Bell button that swings on new notifications with a rolling unread badge.'
    },
    number: {
        description: 'Locale-aware number formatting helper.'
    },
    overlay: {
        description: 'Native dialog that centers or docks to any edge, covering modals, sheets, and drawers; every one drags to dismiss, and stacked ones push back the layers beneath them.'
    },
    page: {
        description: 'Vertical page scaffold with title, suptitle, and subtitle slots.'
    },
    pagination: {
        description: 'Numbered page navigation that folds overflow into ellipses, plus a scroll-linked dots indicator whose active pill stretches between dots like a worm, with an optional autoplay countdown.'
    },
    progress: {
        description: 'Progress bar with an optional label, percentage, and a status line derived from the value, plus progress shown in the label itself: ink fills the letters, digits roll, and a drawn check lands when done.'
    },
    'pull-to-refresh': {
        description: 'Rubber-band pull gesture for touch and mouse that spins a stepped indicator and slides new items in from the top.'
    },
    radio: {
        description: 'Single-choice selection from a grouped set of options, including option cards built from radio and card.'
    },
    range: {
        description: 'Slider input for choosing a value along a track, plus single and dual-thumb range filters with rolling digits, a ghost preview, and optional min/max fields. Add range--slider for a compact track and thumb style; orientation: vertical supports vertical single and dual thumbs.'
    },
    'relative-time': {
        description: 'Self-updating "5 min ago" time element that rolls its digits as they change, with the full date on hover.'
    },
    scrollbar: {
        description: 'Native scrollbar styling with thin, token-driven colors, plus edge fades and blurs that track the scroll position.'
    },
    select: {
        description: 'Custom dropdown for choosing from a list of options, plus a macOS-style listbox that opens with the selected option over the trigger, with typeahead and hover scrolling.'
    },
    'shortcut-recorder': {
        description: 'Records a keyboard shortcut from the keys you hold, rejecting combinations already in use.'
    },
    sortable: {
        description: 'Drag-and-drop reordering of a reactive list\'s items, within one list or across a group.'
    },
    'sticky-header': {
        description: 'Scroll panel whose header condenses from its before content into its after content as a compact bar.'
    },
    story: {
        description: 'Auto-advancing stories of any content with segmented progress bars, tap or drag to navigate, and press-and-hold to pause.'
    },
    'surface-field': {
        description: 'Canvas field of dots and lines lit by the pointer, rippling on press and bending around draggable, resizable, inline-editable surfaces of any shape, with links drawn through the field, a camera it follows as a parallax floor, and an optional worker to draw in (Surface Field).'
    },
    switch: {
        description: 'Toggle control for binary on and off settings, plus switch groups with a select-all header and Shift-click ranges.'
    },
    text: {
        description: 'Typographic primitives for headings, body copy, and captions.'
    },
    textarea: {
        description: 'Multi-line text field for longer form input.'
    },
    toast: {
        description: 'Independent toasters that stack your content: a close button, swipe-to-dismiss, a capped stack that fans out on hover, and a CSS clock that runs only on the front toast.'
    },
    tooltip: {
        description: 'Contextual popover for hints, menus, and hover details, including one shared tooltip that glides between the triggers bound to it, down to a navigation bar of dropdown panels.'
    },
    truncate: {
        description: 'Single-line text truncation with an ellipsis.'
    },
    typewriter: {
        description: 'Sequenced typing animation for headline text, plus a headline word that gets selected and typed over with a human rhythm, like a person editing a text field, and a rotating word whose shared letters glide into place while the rest blur out and in.'
    }
};


export { meta };
export type { Meta };
