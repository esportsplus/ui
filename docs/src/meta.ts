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
    button: {
        category: 'Interactive',
        description: 'Trigger actions with color, modifier, and hold-to-confirm variants.'
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
    tabs: {
        category: 'Layout',
        description: 'Persistent tab panels with instant switching, horizontal sliding, or vertical scrolling.'
    },
    grid: {
        category: 'Layout',
        description: 'Responsive auto-fit grid for arranging children.'
    },
    icon: {
        category: 'Display',
        description: 'Sprite-backed SVG icon with accessible sizing.'
    },
    input: {
        category: 'Form Controls',
        description: 'Single-line text field with focus and validation states.'
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
    modal: {
        category: 'Overlay',
        description: 'Centered dialog surface for focused tasks and confirmations.'
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
    scrollbar: {
        category: 'Layout',
        description: 'Native scrollbar styling with thin, token-driven colors.'
    },
    select: {
        category: 'Form Controls',
        description: 'Custom dropdown for choosing from a list of options.'
    },
    sidebar: {
        category: 'Layout',
        description: 'Floating side panel for navigation or filters.'
    },
    switch: {
        category: 'Form Controls',
        description: 'Toggle control for binary on and off settings.'
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
    truncate: {
        category: 'Display',
        description: 'Single-line text truncation with an ellipsis.'
    },
    typewriter: {
        category: 'Display',
        description: 'Sequenced typing animation for headline text.'
    }
};


export { meta, order };
export type { Meta };
