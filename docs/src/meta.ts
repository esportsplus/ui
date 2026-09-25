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
    banner: {
        category: 'Display',
        description: 'Full-width promotional strip for announcements and notices.'
    },
    breadcrumb: {
        category: 'Layout',
        description: 'Displays the path to the current resource using a hierarchy of links.'
    },
    button: {
        category: 'Interactive',
        description: 'Trigger actions with color and modifier variants, plus copy, loading, and hold-to-confirm feedback.'
    },
    card: {
        category: 'Layout',
        description: 'Rounded surface that groups related content and actions.'
    },
    checkbox: {
        category: 'Form Controls',
        description: 'Binary and grouped selection control with an optional label.'
    },
    clipboard: {
        category: 'Interactive',
        description: 'Copy-to-clipboard affordance with click and programmatic variants.'
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
    'filter-grid': {
        category: 'Display',
        description: 'Filter chips over a card grid that rearranges with FLIP motion instead of blinking.'
    },
    tabs: {
        category: 'Layout',
        description: 'Persistent tab panels with instant switching, horizontal sliding, or vertical scrolling.'
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
    icon: {
        category: 'Display',
        description: 'Sprite-backed SVG icon with accessible sizing.'
    },
    image: {
        category: 'Display',
        description: 'Blur-up image that develops from a low-quality placeholder into the full photo.'
    },
    input: {
        category: 'Form Controls',
        description: 'Single-line text field with focus and validation states.'
    },
    json: {
        category: 'Display',
        description: 'Structured JSON viewer with download support.'
    },
    lightbox: {
        category: 'Overlay',
        description: 'Gesture-driven image viewer that zooms toward the pointer and flies back to its thumbnail on close.'
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
        description: 'Layered surface for modals, menus, and popovers.'
    },
    page: {
        category: 'Layout',
        description: 'Vertical page scaffold with title, suptitle, and subtitle slots.'
    },
    radio: {
        category: 'Form Controls',
        description: 'Single-choice selection from a grouped set of options.'
    },
    range: {
        category: 'Form Controls',
        description: 'Slider input for choosing a value along a track.'
    },
    'reading-progress': {
        category: 'Display',
        description: 'Quantized scroll progress through an article with a minutes-remaining readout.'
    },
    scrollbar: {
        category: 'Layout',
        description: 'Native scrollbar styling with thin, token-driven colors.'
    },
    select: {
        category: 'Form Controls',
        description: 'Custom dropdown for choosing from a list of options.'
    },
    settings: {
        category: 'Overlay',
        description: 'Application settings dialog with a grouped navigation rail, scrolling pages, and a saved confirmation.'
    },
    sidebar: {
        category: 'Layout',
        description: 'Floating side panel for navigation or filters.'
    },
    'sticky-header': {
        category: 'Layout',
        description: 'Scroll panel whose header condenses from title and subtitle into a compact bar.'
    },
    'swipe-deck': {
        category: 'Interactive',
        description: 'Card stack decided by swiping, arrow keys, or buttons, with undo.'
    },
    switch: {
        category: 'Form Controls',
        description: 'Toggle control for binary on and off settings.'
    },
    'task-list': {
        category: 'Display',
        description: 'Streaming log of what an agent did: tasks and steps reveal one unit at a time, shimmer while running, then settle.'
    },
    text: {
        category: 'Display',
        description: 'Typographic primitives for headings, body copy, and captions.'
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
    truncate: {
        category: 'Display',
        description: 'Single-line text truncation with an ellipsis.'
    },
    typewriter: {
        category: 'Display',
        description: 'Sequenced typing animation for headline text.'
    },
    'value-flash': {
        category: 'Display',
        description: 'Marks what just changed with a directional roll, tint, and arrow.'
    },
    'web-search': {
        category: 'Display',
        description: 'Research trail of the queries an agent ran and the pages it opened, with sources stacked as site marks.'
    }
};


export { meta, order };
export type { Meta };
