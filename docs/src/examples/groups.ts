import type { Variant } from 'docs/types';


type Group = { title: string; members: (string | [string, string])[] };

// Explicit families keep distinct examples separate. A tuple renames an option, not its example.
const groups: Record<string, Group[]> = {
    accordion: [{ title: 'show more', members: [['show more', 'Default'], ['max height', 'Max height'], ['fits', 'Fits']] }],
    announcement: [{ title: 'announcement', members: [['dashboard', 'Default'], 'blue, no link'] }],
    banner: [{ title: 'banner', members: ['gradient', 'blur', 'backdrop'] }],
    breadcrumb: [{ title: 'breadcrumb', members: [['default (drag the edge to resize)', 'Default'], ["separator: 'chevron'", 'Chevron'], ['no background', 'No background'], ["no background, separator: 'chevron'", 'No background, chevron'], ['breadcrumb--compact', 'Compact'], ['onnavigate', 'Navigation callback']] }],
    button: [
        { title: 'fan', members: ['fan', 'fan directions', 'fan text'] },
        { title: 'hold', members: ['hold', 'hold text'] },
        { title: 'morph', members: ['morph', 'morph, observed state'] }
    ],
    capslock: [{ title: 'caps lock', members: [['toggle caps lock to show', 'Default'], 'active'] }],
    card: [
        { title: 'card', members: ['default', ['card--morph', 'Morph']] },
        { title: 'card.expand', members: ['card.expand', ['card.expand controlled state', 'Controlled state'], ['card.expand white surfaces, darker backdrop', 'White surface, dark backdrop']] }
    ],
    cc: [{ title: 'card details', members: ['default', ['prefilled amex + onvalid', 'Prefilled Amex, validation callback']] }],
    checkbox: [
        { title: 'checkbox', members: ['default', 'checked'] },
        { title: 'group', members: ['group', 'group without descriptions'] }
    ],
    'color-picker': [{ title: 'color picker', members: ['default', ['recent colors', 'Recent colors'], ['controlled state', 'Controlled state']] }],
    command: [{ title: 'command', members: [['default (⌘K / Ctrl+K)', 'Default'], 'centered + blur'] }],
    counter: [
        { title: 'USD (animated)', members: [['USD (animated)', 'Default'], 'shade', 'snap', 'spring'] },
        { title: 'number format', members: [['plain number', 'Plain number'], ['suffix', 'Suffix']] },
        { title: 'ticker', members: ['ticker', 'ticker with blur'] }
    ],
    datalist: [{ title: 'options', members: [['options', 'Default'], ['pre-selected', 'Pre-selected'], ['flat (no drum)', 'Flat'], ['reactive state', 'Reactive state']] }],
    dock: [{ title: 'dock', members: ['default', ['group tooltip', 'Group tooltip'], ['dock--square', 'Square'], ['controlled running state + onlaunch', 'Controlled state, launch callback']] }],
    error: [{ title: 'input', members: ['input', 'input, duration'] }],
    'file-tree': [
        { title: 'file tree', members: ['default', ['locked items, natural sort, no indicator', 'Locked items, no indicator'], ['guides on hover, named folders, path tooltip, scope colors', 'Guides, tooltips and scope colors'], ['sticky scroll, three folders deep', 'Sticky scroll']] },
        { title: 'large tree', members: [['virtualized, 10,000 files', 'Default'], ['find in 10,000 files, highlight mode', 'Find and highlight']] }
    ],
    filter: [{ title: 'layout', members: [['Grid · 3 columns', 'Default'], ['Rows · Single column list', 'Rows'], ['Max rows · Scrolls past 2 rows', 'Max rows']] }],
    frame: [{ title: 'transition', members: [['Default · Instant', 'Default'], ['frame--slide · Horizontal', 'Slide'], ['frame--scroll · Vertical', 'Scroll'], ['frame--swap · Crossfade in place', 'Swap']] }],
    grid: [{ title: 'auto-fit', members: [['auto-fit (min 200px)', 'Default'], 'min-width 120px'] }],
    heatmap: [{ title: 'heatmap', members: [['default (GitHub contributions)', 'Default'], ['heatmap--blue, custom thresholds and tooltip template', 'Blue, custom thresholds and tooltip'], ['controlled state', 'Controlled state']] }],
    highlight: [
        { title: 'highlight', members: [['horizontal button group', 'Default'], ['vertical link list', 'Vertical links'], ['rests on --active', 'Active selection'], ['--background-blue utility', 'Blue background']] },
        { title: 'tabs', members: [['tabs · background + line', 'Default'], ['tabs · line only', 'Line only'], ['vertical tabs · background + line', 'Vertical']] }
    ],
    icon: [{ title: 'icon', members: [['default size', 'Default'], 'sized & coloured'] }],
    image: [
        { title: 'avatars', members: [['gradient fills', 'Default'], ['stack', 'Stack'], ['status', 'Status']] },
        { title: 'lazy loading', members: [['lazyload', 'Default'], ['error', 'Error']] }
    ],
    'inline-edit': [
        { title: 'rich text', members: [['every feature', 'Every feature'], ['one line, bold + italic only', 'One line, bold and italic'], ['seamless', 'Seamless']] },
        { title: 'save status', members: ['save status', ['save status states', 'Status states']] }
    ],
    input: [
        { title: 'focus animation', members: [['Halo · Expanding focus ring', 'Default'], ['Underline · Draw from center', 'Underline'], ['Lift · Soft spring elevation', 'Lift'], ['Wash · Tinted focus surface', 'Wash'], ['Bracket · Growing side accents', 'Bracket']] },
        { title: 'Board', members: [['Board · Label, icons and hint', 'Default'], ['Board · Sizes (medium, small)', 'Sizes'], ['Board · States (default, filled, disabled, invalid)', 'States'], ['Board · Compact icon fields', 'Compact icons']] },
        { title: 'Board OTP', members: [['Board OTP · Six digits', 'Default'], ['Board OTP · Four digit PIN', 'Four digit PIN'], ['Board OTP · Grouped (000 000)', 'Grouped'], ['Board OTP · Invalid', 'Invalid'], ['Board OTP · Disabled', 'Disabled']] },
        { title: 'tags', members: [['tag · topics', 'Default'], ['tag · paste + observed state', 'Paste and observed state']] },
        { title: 'scrub', members: [['scrub · transform', 'Default'], ['scrub · bounded + observed state', 'Bounds and observed state'], ['scrub · pointer lock', 'Pointer lock']] }
    ],
    loading: [{ title: 'loading', members: ['default', 'small', 'tail', 'bar'] }],
    marquee: [{ title: 'marquee', members: ['default', 'right', 'marks', 'select', 'paused state', 'velocity (scroll the page to speed it up)'] }],
    metric: [
        { title: 'metric', members: ['default', ['metric--accent, currency format', 'Accent, currency format'], ['resizable container (drag the corner)', 'Resizable'], ['controlled state', 'Controlled state']] },
        { title: 'grid', members: [['small cards in a grid', 'Default'], ['live data (push to a ReactiveArray)', 'Live data']] },
        { title: 'flash', members: [['flash, price', 'Price'], ['flash, request rate', 'Request rate'], ['flash, large, long hold', 'Large, long hold']] }
    ],
    notification: [
        { title: 'bubble', members: ['interactive', 'max overflow', 'custom max', 'without counter', ['sizes', 'Sizes']] },
        { title: 'bell', members: [['bell, interactive', 'Interactive'], ['bell, max overflow', 'Max overflow'], ['bell, without counter', 'Without counter'], ['bell, ring on mount', 'Ring on mount'], ['bell, sizes', 'Sizes']] }
    ],
    overlay: [
        { title: 'placement', members: [['center', 'Default'], 'north', 'south', 'west', 'east', 'north-east', 'south-west', 'floating', ['non-modal', 'Non-modal']] },
        { title: 'stacked', members: ['stacked', 'stacked, pushing back the page'] },
        { title: 'transition', members: [['slide', 'Default'], 'scale', 'spring', 'blur backdrop', 'alert'] }
    ],
    pagination: [
        { title: 'pages', members: [['overflow', 'Default'], ['few pages', 'Few pages'], ['two siblings', 'Two siblings']] },
        { title: 'dots', members: [['dots: autoplay carousel', 'Autoplay carousel'], ['dots: scroll-linked', 'Scroll-linked'], ['dots: large (click to jump)', 'Large, click to jump']] }
    ],
    progress: [
        { title: 'progress', members: [['status', 'Status'], ['static values', 'Static values']] },
        { title: 'text · upload', members: [['text · upload', 'Default'], ['text · large, blue', 'Large, blue'], ['text · controlled (drag to scrub)', 'Controlled state']] }
    ],
    range: [
        { title: 'Heading · Value above the track', members: [['Heading · Value above the track', 'Default'], ['Heading · Value above the track · 10% ticks', '10% ticks'], ['Heading · Value above the track · 10% and 2% ticks', '10% and 2% ticks']] },
        { title: 'Inline · Label and value inside the track', members: [['Inline · Label and value inside the track', 'Default'], ['Inline · Label and value inside the track · 10% ticks', '10% ticks'], ['Inline · Label and value inside the track · 10% and 2% ticks', '10% and 2% ticks']] },
        { title: 'vertical sliders', members: [['vertical sliders — single and dual thumb', 'Default'], ['vertical slider with label, value and ticks', 'Label, value and ticks'], ['disabled vertical slider', 'Disabled']] },
        { title: 'slider', members: [['slider', 'Default'], ['disabled slider', 'Disabled'], ['slider with decimal steps, shared state and form field', 'Decimal steps, shared state and form field']] },
        { title: 'slider with two thumbs', members: [['slider with two thumbs', 'Default'], ['disabled dual-thumb slider', 'Disabled']] },
        { title: 'slider with label and value', members: [['slider with label and value', 'Default'], 'slider with reference labels', 'slider with ticks'] },
        { title: 'min and max fields', members: [['min and max fields', 'Default'], ['fields, custom colors', 'Custom colors'], ['fields, controlled state, fractional step', 'Controlled state, fractional step']] },
        { title: 'range filter', members: [['price range (hover outside the selection)', 'Default'], ['stepped price range', 'Stepped'], ['single value', 'Single value'], ['disabled', 'Disabled'], ['custom unit, shared state', 'Custom unit, shared state'], ['larger numbers', 'Larger numbers']] }
    ],
    'relative-time': [{ title: 'relative time', members: ['default', ['every unit, live seconds', 'Every unit'], ['unknown until set (placeholder)', 'Placeholder']] }],
    scrollbar: [
        { title: 'vertical bar', members: [['default bar', 'Default'], 'visible on hover or keyboard focus', 'hidden bar', 'color states', 'rail color', 'centered growth', 'square thumb', 'width variable'] },
        { title: 'horizontal bar', members: [['horizontal bar', 'Default'], ['auto (horizontal)', 'Platform width'], ['drag (horizontal)', 'Drag horizontally'], ['drag (both)', 'Drag both axes']] },
        { title: 'edge effects', members: [['fade', 'Fade'], ['fade (content fits)', 'Fade, content fits'], ['blur', 'Blur'], ['fade (horizontal)', 'Fade, horizontal'], ['blur (horizontal)', 'Blur, horizontal']] }
    ],
    select: [
        { title: 'options', members: [['options', 'Default'], ['pre-selected', 'Pre-selected'], ['font picker', 'Font picker'], ['settings', 'Settings'], ['controlled state', 'Controlled state']] }
    ],
    'shortcut-recorder': [{ title: 'keyboard shortcuts', members: [['keyboard shortcuts', 'Default'], 'empty', 'limit', 'callout, whole field shakes'] }],
    'sticky-header': [{ title: 'sticky header', members: [['title and subtitle', 'Default'], ['custom content', 'Custom content']] }],
    story: [{ title: 'stories', members: [['stories', 'Default'], ['any content', 'Custom content'], ['controlled, 2s per story', 'Controlled state, 2s duration']] }],
    switch: [{ title: 'switch', members: ['default', 'squared', 'on'] }],
    tasklist: [
        { title: 'tasks', members: ['default', ['sortable', 'Sortable']] },
        { title: 'plan', members: ['plan', ['plan with a step left open', 'Step left open']] }
    ],
    textarea: [
        { title: 'focus animation', members: [['Halo · Expanding focus ring', 'Default'], ['Underline · Draw from center', 'Underline'], ['Lift · Soft spring elevation', 'Lift'], ['Wash · Tinted focus surface', 'Wash'], ['Bracket · Growing side accents', 'Bracket']] },
        { title: 'Board', members: [['Board · Label, hint and resize handle', 'Default'], ['Board · Sizes (medium, small)', 'Sizes'], ['Board · Auto resize (1 to 8 lines)', 'Auto resize'], ['Board · Character count', 'Character count'], ['Board · States (default, filled, disabled, invalid)', 'States']] },
        { title: 'textarea', members: ['default', 'autoresize', 'tall'] }
    ],
    tooltip: [
        { title: 'tooltip', members: [['onhover', 'Hover'], ['onclick', 'Click'], 'scale', 'scale + spring', 'spring'] },
        { title: 'menu', members: [['menu', 'Flat'], ['menu (drill down)', 'Nested'], ['menu (instant)', 'Nested (instant)'], ['menu (onhover)', 'Hover'], ['menu (expand, se)', 'Expand (south-east)'], ['menu (expand, sw)', 'Expand (south-west)'], ['menu (expand, ne)', 'Expand (north-east)'], ['menu (expand, es)', 'Expand (east-south)']] },
        { title: 'morph', members: [['morph (onhover, s)', 'Hover (south)'], ['morph (onclick, n)', 'Click (north)'], ['morph message (onhover, e)', 'Message (east)']] },
        { title: 'shared', members: [
            ['shared.delegate (toolbar, edge, n)', 'Toolbar (north)'],
            ['shared.delegate (toolbar, edge, s)', 'Toolbar (south)'],
            ['shared.delegate (vertical, edge, e)', 'Vertical toolbar'],
            ['shared.delegate (grid, template)', 'Color grid'],
            ['shared (labels, open delay)', 'Labels with delay'],
            ['shared (interactive cards, open + close delay)', 'Interactive cards'],
            ['shared (navigation: keep, dismiss, state.index)', 'Navigation']
        ] }
    ],
    typewriter: [
        { title: 'cycling text', members: [['cycling text', 'Default'], 'block caret, hard blink', 'underscore caret'] },
        { title: 'select and retype', members: [['select and retype', 'Default'], 'retype, block caret, hard blink', 'retype, underscore caret', 'retype, tinted caret and selection'] },
        { title: 'rotate', members: ['rotate', 'rotate, quick interval, pausable', 'rotate, inline, accent'] }
    ],
    uptime: [{ title: 'uptime', members: [['interactive (hover, or focus and use arrow keys)', 'Default'], 'incident today', 'controlled highlight'] }],
    'usage-meter': [
        { title: 'bar', members: [['bar', 'Default'], 'warning (over 75%)', 'critical (over 90%)'] },
        { title: 'inline', members: ['inline', 'inline without cost'] }
    ]
};


function groupVariants(name: string, variants: Variant[]): Variant[] {
    let families = groups[name] ?? [],
        consumed = new Set<string>();

    return variants.flatMap((variant, index) => {
        if (consumed.has(variant.title)) {
            return [];
        }

        let family = families.find(({ members }) => members.some((member) => (typeof member === 'string' ? member : member[0]) === variant.title));

        if (!family) {
            return [{ ...variant, id: `v-${index}` }];
        }

        let options = family.members.flatMap((member, position) => {
            let [title, label] = typeof member === 'string' ? [member, position === 0 ? 'Default' : member] : member,
                original = variants.findIndex((candidate) => candidate.title === title);

            if (original < 0) {
                return [];
            }

            consumed.add(title);

            return [{ id: `v-${original}`, label, render: variants[original].render, source: variants[original].source }];
        });

        return [{ id: options[0].id, options, render: options[0].render, source: options[0].source, title: family.title }];
    });
}


export { groupVariants };
