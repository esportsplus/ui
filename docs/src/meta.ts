type Meta = {
    category: string;
    description: string;
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
    'announcement-banner': {
        category: 'Feedback',
        description: 'Dismissible announcement strip that slides in from the top and folds its space away when closed.'
    },
    'back-to-top': {
        category: 'Interactive',
        description: 'Floating scroll-to-top button that appears past a threshold, rings its progress, and lifts its arrow on the trip up.'
    },
    banner: {
        category: 'Display',
        description: 'Full-width promotional strip for announcements and notices.'
    },
    'bento-grid': {
        category: 'Layout',
        description: 'Feature grid of cards whose text lifts on hover to reveal a call to action over decorative background art (Magic UI).'
    },
    'bento-grid-spotlight': {
        category: 'Layout',
        description: 'Feature grid whose cards spring in on scroll, glow under the pointer, trace a border beam, and optionally tilt (Spectrum UI).'
    },
    'bookmark-button': {
        category: 'Interactive',
        description: 'Save toggle whose ribbon fills from the bottom up and lands with a small squash.'
    },
    breadcrumb: {
        category: 'Layout',
        description: 'Displays the path to the current resource using a hierarchy of links.'
    },
    breadcrumbs: {
        category: 'Layout',
        description: 'Path trail that folds middle segments into a menu as space runs out, sliding the rest to close the gap.'
    },
    button: {
        category: 'Interactive',
        description: 'Trigger actions with color and modifier variants, plus copy, loading, and hold-to-confirm feedback.'
    },
    card: {
        category: 'Layout',
        description: 'Rounded surface that groups related content and actions.'
    },
    'card-input': {
        category: 'Form Controls',
        description: 'Payment card form with a live card preview that flips for the CVC, brand detection, auto-formatting and Luhn validation.'
    },
    'carousel-3d': {
        category: 'Interactive',
        description: 'Draggable 3D card ring that spins on a spring, throws with momentum, and flattens for reduced motion.'
    },
    checkbox: {
        category: 'Form Controls',
        description: 'Binary and grouped selection control with an optional label.'
    },
    'checkbox-group': {
        category: 'Form Controls',
        description: 'Checklist with a select-all parent that goes mixed, drawn checkmarks, and Shift-click range selection.'
    },
    clipboard: {
        category: 'Interactive',
        description: 'Copy-to-clipboard affordance with click and programmatic variants.'
    },
    'code-morph': {
        category: 'Display',
        description: 'Stepped code walkthrough where tokens shared between steps glide to their new line and column, Magic Move style.'
    },
    'collapsible-sidebar': {
        category: 'Layout',
        description: 'Navigation rail that springs between labelled and icon-only widths, with a sliding highlight and tips while collapsed.'
    },
    'color-picker': {
        category: 'Form Controls',
        description: 'Saturation pad, hue and opacity sliders, a hex field, and a recent-colors row that reorders as you commit.'
    },
    'command-palette': {
        category: 'Overlay',
        description: 'Keyboard-first ⌘K launcher with fuzzy search, highlighted matches, grouped results, and arrow-key navigation.'
    },
    container: {
        category: 'Layout',
        description: 'Width-constrained wrapper that centers content within the page.'
    },
    'contribution-heatmap': {
        category: 'Display',
        description: 'GitHub-style year of activity squares that sweep in by column, with a hover label and arrow-key grid navigation.'
    },
    counter: {
        category: 'Display',
        description: 'Animated number display with currency and formatting support.'
    },
    datalist: {
        category: 'Form Controls',
        description: 'Scroll-snapped wheel picker where the scroll position is the selection.'
    },
    'date-range-picker': {
        category: 'Form Controls',
        description: 'Two-month calendar for picking a start and end date, with presets, a hover preview band, and full keyboard navigation.'
    },
    dock: {
        category: 'Interactive',
        description: 'macOS-style dock whose icons swell toward the cursor and launch with a bounce and a running light.'
    },
    'dynamic-island': {
        category: 'Display',
        description: 'Morphing black pill that springs between idle, timer, music, and ringer states.'
    },
    'email-typo-fix': {
        category: 'Form Controls',
        description: 'Email field that spots common domain typos after a pause and fixes them in one click with a letter-morph animation.'
    },
    'expanding-card': {
        category: 'Overlay',
        description: 'List of cards that each morph into a modal detail view and fly back into their slot on close.'
    },
    'feature-spotlight': {
        category: 'Display',
        description: 'Scroll-driven product tour whose screenshot camera pans, zooms, and spotlights the feature being read.'
    },
    'file-tree': {
        category: 'Interactive',
        description: 'Collapsible file and folder tree with guide lines, locked items, natural sorting, and expand or collapse all (Magic UI).'
    },
    'filter-grid': {
        category: 'Display',
        description: 'Filter chips over a card grid that rearranges with FLIP motion instead of blinking.'
    },
    'gradient-text': {
        category: 'Display',
        description: 'Text filled with a looping gradient that slides through the letters (Magic UI).'
    },
    grid: {
        category: 'Layout',
        description: 'Responsive auto-fit grid for arranging children.'
    },
    header: {
        category: 'Layout',
        description: 'Sticky site header with hover mega-menus that grow the bar to fit, a scroll-frosted surface, and a mobile drawer.'
    },
    highlight: {
        category: 'Interactive',
        description: 'Hover highlight that glides behind sibling items and rests on the active one.'
    },
    'hover-card': {
        category: 'Overlay',
        description: 'Delayed preview card for inline mentions that travels between triggers in a shared group and opens by hover, tap, or focus.'
    },
    icon: {
        category: 'Display',
        description: 'Sprite-backed SVG icon with accessible sizing.'
    },
    image: {
        category: 'Display',
        description: 'Blur-up image that develops from a low-quality placeholder into the full photo.'
    },
    'inline-edit': {
        category: 'Form Controls',
        description: 'Click-to-edit text that swaps to a field in place, saving on Enter or blur and cancelling on Escape.'
    },
    input: {
        category: 'Form Controls',
        description: 'Single-line text field with focus and validation states.'
    },
    json: {
        category: 'Display',
        description: 'Structured JSON viewer with download support.'
    },
    'kanban-board': {
        category: 'Interactive',
        description: 'Columns of cards you drag within and between lists, or move entirely from the keyboard.'
    },
    lightbox: {
        category: 'Overlay',
        description: 'Gesture-driven image viewer that zooms toward the pointer and flies back to its thumbnail on close.'
    },
    'line-shadow-text': {
        category: 'Display',
        description: 'Text with an offset drop shadow drawn in drifting diagonal hatch lines (Magic UI).'
    },
    link: {
        category: 'Layout',
        description: 'Inline and block navigation links with hover states.'
    },
    loading: {
        category: 'Display',
        description: 'Border-based loading indicator for surfaces.'
    },
    'long-press': {
        category: 'Interactive',
        description: 'Hold-to-confirm gesture that fires on time and cancels on release, drift, or blur.'
    },
    marquee: {
        category: 'Display',
        description: 'Infinitely scrolling logo strip that eases to a stop on hover or focus.'
    },
    modal: {
        category: 'Overlay',
        description: 'Centered dialog surface for focused tasks and confirmations.'
    },
    'morphing-button': {
        category: 'Interactive',
        description: 'Async save button that morphs into a spinner, confirms with a check, and shakes when it fails.'
    },
    'morphing-nav': {
        category: 'Layout',
        description: 'Navigation bar whose dropdown panel morphs size, position and caret between sections as the cursor moves.'
    },
    'multi-step-form': {
        category: 'Form Controls',
        description: 'Stepped form card with a progress bar, directional step transitions, and a height that springs to fit.'
    },
    'notification-bell': {
        category: 'Display',
        description: 'Bell button that swings on new notifications with a rolling unread badge.'
    },
    number: {
        category: 'Display',
        description: 'Locale-aware number formatting helper.'
    },
    'onboarding-checklist': {
        category: 'Display',
        description: 'Setup checklist with a progress ring, expandable task details, and a celebration once every step is done.'
    },
    overlay: {
        category: 'Overlay',
        description: 'Layered surface for modals, menus, and popovers.'
    },
    page: {
        category: 'Layout',
        description: 'Vertical page scaffold with title, suptitle, and subtitle slots.'
    },
    'page-dots': {
        category: 'Interactive',
        description: 'Scroll-linked page indicator whose active pill stretches between dots like a worm, with an optional autoplay countdown.'
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
        description: 'Single-choice selection from a grouped set of options.'
    },
    'radio-cards': {
        category: 'Form Controls',
        description: 'Native radio group laid out as cards, with a selection ring that glides to the option you pick.'
    },
    range: {
        category: 'Form Controls',
        description: 'Slider input for choosing a value along a track.'
    },
    'range-filter': {
        category: 'Form Controls',
        description: 'Dual-thumb price filter with rolling digits, a clear button, and a ghost preview of where a click would stretch the range (shadcn/space).'
    },
    'range-slider': {
        category: 'Form Controls',
        description: 'Dual-thumb slider for picking a min and max, with gliding thumbs, value tooltips, and editable fields.'
    },
    'reading-progress': {
        category: 'Display',
        description: 'Quantized scroll progress through an article with a minutes-remaining readout.'
    },
    'relative-time': {
        category: 'Display',
        description: 'Self-updating "5 min ago" time element that rolls its digits as they change, with the full date on hover.'
    },
    'scroll-fade': {
        category: 'Layout',
        description: 'Scroll panel whose edges wash and blur content as it leaves, with optional progressive blur and auto-hiding edges (componentry).'
    },
    'scroll-spine': {
        category: 'Layout',
        description: 'Table of contents drawn to scale, with bands that fill as you read and a marker that stretches between sections.'
    },
    'scroll-velocity': {
        category: 'Display',
        description: 'Looping rows of text or images that speed up and reverse with the page scroll (Magic UI).'
    },
    scrollbar: {
        category: 'Layout',
        description: 'Native scrollbar styling with thin, token-driven colors.'
    },
    'scrub-input': {
        category: 'Form Controls',
        description: 'Numeric field whose label scrubs the value on drag, with a tape measure, coarse and fine gears, and keyboard stepping.'
    },
    select: {
        category: 'Form Controls',
        description: 'Custom dropdown for choosing from a list of options.'
    },
    'select-menu': {
        category: 'Form Controls',
        description: 'macOS-style listbox that opens with the selected option over the trigger, with typeahead and hover scrolling.'
    },
    'selection-toolbar': {
        category: 'Interactive',
        description: 'Formatting toolbar that springs out of the current text selection and follows it.'
    },
    settings: {
        category: 'Overlay',
        description: 'Application settings dialog with a grouped navigation rail, scrolling pages, and a saved confirmation.'
    },
    'share-button': {
        category: 'Interactive',
        description: 'Share pill that reshapes into copy-link, X, email, and native share targets.'
    },
    sheet: {
        category: 'Overlay',
        description: 'Bottom sheet that drags to dismiss, with flick detection, rubber-band resistance, and a fading backdrop.'
    },
    'shiny-text': {
        category: 'Display',
        description: 'Muted text with a band of light that sweeps across it and rests (Magic UI).'
    },
    'shortcut-recorder': {
        category: 'Form Controls',
        description: 'Records a keyboard shortcut from the keys you hold, rejecting combinations already in use.'
    },
    'shortcut-sheet': {
        category: 'Overlay',
        description: 'Searchable keyboard-shortcut reference opened with ?, lighting up each listed shortcut as it is pressed.'
    },
    sidebar: {
        category: 'Layout',
        description: 'Floating side panel for navigation or filters.'
    },
    slider: {
        category: 'Form Controls',
        description: 'Single or range slider with edge-aligned thumbs, vertical orientation, value output, and hidden form fields (coss ui).'
    },
    'sliding-tabs': {
        category: 'Layout',
        description: 'Tab list whose underline stretches toward the new tab and gathers under it, with a hover pill and cross-sliding panels.'
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
    'status-picker': {
        category: 'Interactive',
        description: 'Avatar presence menu whose shaped status badge spins into the next one as you change it.'
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
        description: 'Toggle control for binary on and off settings.'
    },
    tabs: {
        category: 'Layout',
        description: 'Persistent tab panels with instant switching, horizontal sliding, or vertical scrolling.'
    },
    'tag-input': {
        category: 'Form Controls',
        description: 'Chip field that turns typed or pasted text into removable tags, with duplicate nudges and double-Backspace removal.'
    },
    'task-list': {
        category: 'Display',
        description: 'Streaming log of what an agent did: tasks and steps reveal one unit at a time, shimmer while running, then settle.'
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
        description: 'Contextual popover for hints, menus, and hover details.'
    },
    tree: {
        category: 'Interactive',
        description: 'Keyboard-navigable hierarchy of expandable branches for files, folders, and nested data.'
    },
    'tree-view': {
        category: 'Interactive',
        description: 'Nested file tree whose folders unfold in place while the selection glides to the picked file.'
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
    'waitlist-join': {
        category: 'Form Controls',
        description: 'Waitlist signup that drops you into a visible queue, rolls up your spot, and moves you ahead when you share.'
    },
    'web-search': {
        category: 'Display',
        description: 'Research trail of the queries an agent ran and the pages it opened, with sources stacked as site marks.'
    },
    'word-rotator': {
        category: 'Display',
        description: 'Rotating headline word whose shared letters glide into place while the rest blur out and in.'
    }
};


export { meta, order };
export type { Meta };
