type Meta = {
    category: string;
    description: string;
    // Display name, for slugs that don't read right capitalized (e.g. acronyms).
    label?: string;
};


const order = [
    'Form Controls',
    'Interactive',
    'Overlay',
    'Display',
    'Layout'
];


const meta: Record<string, Meta> = {
    accordion: {
        category: 'Interactive',
        description: 'Vertically stacked, collapsible panels for revealing sections of content on demand.'
    },
    anchor: {
        category: 'Layout',
        description: 'Compact in-page navigation list for jumping between document sections.'
    },
    announcement: {
        category: 'Feedback',
        description: 'Animated container that slides announcement content in from the top and folds its space away when state.active turns off.'
    },
    banner: {
        category: 'Display',
        description: 'Full-width promotional strip for announcements and notices.'
    },
    breadcrumb: {
        category: 'Layout',
        description: 'Path trail that folds middle segments into a menu as space runs out, sliding the rest to close the gap.'
    },
    button: {
        category: 'Interactive',
        description: 'Trigger actions with color and modifier variants, plus copy, loading, and hold-to-confirm feedback that fills the whole button or just its label, and an async save that morphs into a spinner, confirms with a check, and shakes on failure.'
    },
    capslock: {
        category: 'Feedback',
        description: 'Keycap warning that fades in beside "Caps Lock is on" while the lock is engaged, read from any key or pointer event on the page.',
        label: 'Caps Lock'
    },
    card: {
        category: 'Layout',
        description: 'Rounded surface that groups related content and actions, plus cards that morph into a detail dialog and fly back into their slot.'
    },
    cc: {
        category: 'Form Controls',
        description: 'Payment card form with a live card preview that flips for the CVC, brand detection, auto-formatting and Luhn validation.',
        label: 'CC'
    },
    checkbox: {
        category: 'Form Controls',
        description: 'Binary selection control, plus checklist groups with a select-all header that goes mixed and Shift-click range selection.'
    },
    clipboard: {
        category: 'Interactive',
        description: 'Copy-to-clipboard affordance with click and programmatic variants.'
    },
    'color-picker': {
        category: 'Form Controls',
        description: 'Saturation pad, hue and opacity sliders, a hex field, and a recent-colors row that reorders as you commit.'
    },
    command: {
        category: 'Overlay',
        description: 'Keyboard-first ⌘K command palette with fuzzy search, highlighted matches, grouped results, and arrow-key navigation.'
    },
    container: {
        category: 'Layout',
        description: 'Width-constrained wrapper that centers content within the page.'
    },
    counter: {
        category: 'Display',
        description: 'Animated number display with currency and formatting support.'
    },
    datalist: {
        category: 'Form Controls',
        description: 'Scroll-snapped wheel picker where the scroll position is the selection.'
    },
    dock: {
        category: 'Interactive',
        description: 'macOS-style dock whose icons swell toward the cursor and launch with a bounce and a running light.'
    },
    error: {
        category: 'Form Controls',
        description: 'Wraps any control that keeps its error in state.error: the control shakes and turns red, and the message grows out of it in the morph tooltip on any side.'
    },
    'file-tree': {
        category: 'Interactive',
        description: 'Collapsible file and folder tree with guide lines, locked items, natural sorting, and expand or collapse all (Magic UI).'
    },
    filter: {
        category: 'Interactive',
        description: 'Headless filter controller: bring your own triggers and layout, and matching items shift, scale, and fade into place.'
    },
    frame: {
        category: 'Layout',
        description: 'Sibling frames sharing one spot, one shown at a time: instant, horizontal slide, vertical scroll, or an in-place swap that drifts in from its side (the tooltip.shared swap), shareable by any component.'
    },
    grid: {
        category: 'Layout',
        description: 'Responsive auto-fit grid for arranging children.'
    },
    heatmap: {
        category: 'Display',
        description: 'Calendar heatmap of daily values that sweeps in by column, with a templated floating tooltip, drag-to-scroll and arrow-key grid navigation.'
    },
    highlight: {
        category: 'Interactive',
        description: 'Hover highlight that glides behind sibling items and rests on the active one, as a fill or a line along one edge that can stretch toward the next item.'
    },
    icon: {
        category: 'Display',
        description: 'Sprite-backed SVG icon with accessible sizing.'
    },
    image: {
        category: 'Display',
        description: 'Lazyloaded image that fades its placeholder out over the decoded full image, then removes it.'
    },
    'inline-edit': {
        category: 'Form Controls',
        description: 'Click-to-edit text that swaps to a field in place, saving on Enter or blur and cancelling on Escape; the rich variant edits markdown in place, with a per-field whitelist of formatting in a toolbar that follows the selection.'
    },
    input: {
        category: 'Form Controls',
        description: 'Single-line text field with focus and validation states, a chip field that turns typed or pasted text into tags, and a numeric field whose label scrubs the value on drag.'
    },
    json: {
        category: 'Display',
        description: 'Structured JSON viewer with download support.'
    },
    link: {
        category: 'Layout',
        description: 'Inline and block navigation links with hover states.'
    },
    loading: {
        category: 'Display',
        description: 'Border-based loading indicator for surfaces.'
    },
    marquee: {
        category: 'Display',
        description: 'Infinitely scrolling logo strip that eases to a stop on hover or focus, and can speed up and reverse with the page scroll.'
    },
    'notification-bell': {
        category: 'Display',
        description: 'Bell button that swings on new notifications with a rolling unread badge.'
    },
    number: {
        category: 'Display',
        description: 'Locale-aware number formatting helper.'
    },
    overlay: {
        category: 'Overlay',
        description: 'Native dialog that centers or docks to any edge, covering modals, sheets, and drawers, with drag to dismiss.'
    },
    page: {
        category: 'Layout',
        description: 'Vertical page scaffold with title, suptitle, and subtitle slots.'
    },
    pagination: {
        category: 'Interactive',
        description: 'Numbered page navigation that folds overflow into ellipses, plus a scroll-linked dots indicator whose active pill stretches between dots like a worm, with an optional autoplay countdown.'
    },
    progress: {
        category: 'Display',
        description: 'Progress bar with an optional label, percentage, and a status line derived from the value.'
    },
    'pull-to-refresh': {
        category: 'Interactive',
        description: 'Rubber-band pull gesture for touch and mouse that spins a stepped indicator and slides new items in from the top.'
    },
    radio: {
        category: 'Form Controls',
        description: 'Single-choice selection from a grouped set of options, including option cards built from radio and card.'
    },
    range: {
        category: 'Form Controls',
        description: 'Slider input for choosing a value along a track, plus single and dual-thumb range filters with rolling digits, a ghost preview, and optional min/max fields.'
    },
    'relative-time': {
        category: 'Display',
        description: 'Self-updating "5 min ago" time element that rolls its digits as they change, with the full date on hover.'
    },
    scrollbar: {
        category: 'Layout',
        description: 'Native scrollbar styling with thin, token-driven colors, plus edge fades and blurs that track the scroll position.'
    },
    select: {
        category: 'Form Controls',
        description: 'Custom dropdown for choosing from a list of options, plus a macOS-style listbox that opens with the selected option over the trigger, with typeahead and hover scrolling.'
    },
    'shortcut-recorder': {
        category: 'Form Controls',
        description: 'Records a keyboard shortcut from the keys you hold, rejecting combinations already in use.'
    },
    slider: {
        category: 'Form Controls',
        description: 'Single or range slider with edge-aligned thumbs, vertical orientation, value output, and hidden form fields (coss ui).'
    },
    'snap-carousel': {
        category: 'Interactive',
        description: 'Native scroll-snap card carousel with mouse flick, focus scaling, and edge-aware arrows.'
    },
    sortable: {
        category: 'Interactive',
        description: 'Drag-and-drop reordering of an element\'s children, within one container or across a group.'
    },
    sparkline: {
        category: 'Display',
        description: 'Inline line chart that draws itself in, with a scrubbable readout for pointer, touch, and arrow keys.'
    },
    'stacked-drawer': {
        category: 'Overlay',
        description: 'Stacked iOS-style sheets that push the page back and drag down to dismiss.'
    },
    'stat-counter': {
        category: 'Display',
        description: 'Metric cards whose numbers roll to their value, with trend chips and sparklines you can scrub back through time.'
    },
    'sticky-header': {
        category: 'Layout',
        description: 'Scroll panel whose header condenses from title and subtitle into a compact bar.'
    },
    'sticky-stack': {
        category: 'Layout',
        description: 'Scroll-driven stack of sticky cards that scale down and dim as the next card slides over them.'
    },
    'story-progress': {
        category: 'Interactive',
        description: 'Auto-advancing stories with segmented progress bars, tap-to-navigate, and press-and-hold to pause.'
    },
    'surface-field': {
        category: 'Display',
        description: 'Canvas field of dots and lines lit by the pointer, rippling on click and bending around draggable, resizable surfaces (Surface Field).'
    },
    'swipe-deck': {
        category: 'Interactive',
        description: 'Card stack decided by swiping, arrow keys, or buttons, with undo.'
    },
    switch: {
        category: 'Form Controls',
        description: 'Toggle control for binary on and off settings, plus switch groups with a select-all header and Shift-click ranges.'
    },
    text: {
        category: 'Display',
        description: 'Typographic primitives for headings, body copy, and captions.'
    },
    'text-animate': {
        category: 'Display',
        description: 'Text that enters by character, word, line, or whole with fade, blur, slide, and spring scale presets (Magic UI).'
    },
    'text-progress': {
        category: 'Display',
        description: 'Progress shown in the label itself: ink fills the letters, digits roll, and a drawn check lands when done.'
    },
    textarea: {
        category: 'Form Controls',
        description: 'Multi-line text field for longer form input.'
    },
    thumbnail: {
        category: 'Display',
        description: 'Compact image preview with rounded framing.'
    },
    toast: {
        category: 'Feedback',
        description: 'Stacked, auto-dismissing notifications with variants, actions, and swipe-to-dismiss.'
    },
    tooltip: {
        category: 'Interactive',
        description: 'Contextual popover for hints, menus, and hover details, including one shared tooltip that glides between the triggers bound to it, down to a navigation bar of dropdown panels.'
    },
    truncate: {
        category: 'Display',
        description: 'Single-line text truncation with an ellipsis.'
    },
    typewriter: {
        category: 'Display',
        description: 'Sequenced typing animation for headline text.'
    },
    'typewriter-retype': {
        category: 'Display',
        description: 'Headline word that gets selected and typed over with a human rhythm, like a person editing a text field.'
    },
    'undo-toast': {
        category: 'Feedback',
        description: 'Deletes that wait behind an Undo toast with a countdown ring before they commit.'
    },
    'value-flash': {
        category: 'Display',
        description: 'Marks what just changed with a directional roll, tint, and arrow.'
    },
    'word-rotator': {
        category: 'Display',
        description: 'Rotating headline word whose shared letters glide into place while the rest blur out and in.'
    }
};


export { meta, order };
export type { Meta };
