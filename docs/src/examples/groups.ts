import type { Variant } from 'docs/types';


type Group = { title: string; members: (string | [string, string])[] };

// Explicit families keep distinct examples separate. A tuple renames an option, not its example.
const groups: Record<string, Group[]> = {
    accordion: [{ title: 'show more', members: [['show more', 'Default'], ['max height', 'Max height'], ['fits', 'Fits']] }],
    announcement: [{ title: 'announcement', members: [['dashboard', 'Default'], 'blue, no link'] }],
    banner: [{ title: 'banner', members: ['gradient', 'blur', 'backdrop'] }],
    breadcrumb: [{ title: 'breadcrumb', members: [['default (drag the edge to resize)', 'Default'], ["separator: 'chevron'", 'Chevron'], 'no background', "no background, separator: 'chevron'", 'breadcrumb--compact'] }],
    button: [
        { title: 'fan', members: ['fan', 'fan directions', 'fan text'] },
        { title: 'hold', members: ['hold', 'hold text'] },
        { title: 'morph', members: ['morph', 'morph, observed state'] }
    ],
    capslock: [{ title: 'caps lock', members: [['toggle caps lock to show', 'Default'], 'active'] }],
    card: [{ title: 'card.expand', members: ['card.expand', 'card.expand controlled state', 'card.expand white surfaces, darker backdrop'] }],
    checkbox: [
        { title: 'checkbox', members: ['default', 'checked'] },
        { title: 'group', members: ['group', 'group without descriptions'] }
    ],
    'color-picker': [{ title: 'color picker', members: ['default', 'recent colors'] }],
    command: [{ title: 'command', members: [['default (⌘K / Ctrl+K)', 'Default'], 'centered + blur'] }],
    counter: [
        { title: 'USD (animated)', members: [['USD (animated)', 'Default'], 'shade', 'snap', 'spring'] },
        { title: 'ticker', members: ['ticker', 'ticker with blur'] }
    ],
    datalist: [{ title: 'options', members: [['options', 'Default'], 'pre-selected', 'flat (no drum)'] }],
    dock: [{ title: 'dock', members: ['default', 'group tooltip', 'dock--square'] }],
    error: [{ title: 'input', members: ['input', 'input, duration'] }],
    filter: [{ title: 'layout', members: [['Grid · 3 columns', 'Default'], ['Rows · Single column list', 'Rows'], ['Max rows · Scrolls past 2 rows', 'Max rows']] }],
    frame: [{ title: 'transition', members: [['Default · Instant', 'Default'], ['frame--slide · Horizontal', 'Slide'], ['frame--scroll · Vertical', 'Scroll'], ['frame--swap · Crossfade in place', 'Swap']] }],
    grid: [{ title: 'auto-fit', members: [['auto-fit (min 200px)', 'Default'], 'min-width 120px'] }],
    heatmap: [{ title: 'heatmap', members: [['default (GitHub contributions)', 'Default'], 'heatmap--blue, custom thresholds and tooltip template'] }],
    highlight: [{ title: 'tabs', members: [['tabs · background + line', 'Default'], ['tabs · line only', 'Line only'], ['vertical tabs · background + line', 'Vertical']] }],
    icon: [{ title: 'icon', members: [['default size', 'Default'], 'sized & coloured'] }],
    'inline-edit': [{ title: 'save status', members: ['save status', 'save status states'] }],
    input: [
        { title: 'focus animation', members: [['Halo · Expanding focus ring', 'Default'], ['Underline · Draw from center', 'Underline'], ['Lift · Soft spring elevation', 'Lift'], ['Wash · Tinted focus surface', 'Wash'], ['Bracket · Growing side accents', 'Bracket']] },
        { title: 'Board', members: [['Board · Label, icons and hint', 'Default'], ['Board · Sizes (medium, small)', 'Sizes'], ['Board · States (default, filled, disabled, invalid)', 'States']] },
        { title: 'Board OTP', members: [['Board OTP · Six digits', 'Default'], ['Board OTP · Four digit PIN', 'Four digit PIN'], ['Board OTP · Grouped (000 000)', 'Grouped'], ['Board OTP · Invalid', 'Invalid'], ['Board OTP · Disabled', 'Disabled']] }
    ],
    loading: [{ title: 'loading', members: ['default', 'small', 'tail', 'bar'] }],
    marquee: [{ title: 'marquee', members: ['default', 'right', 'marks', 'select', 'paused state', 'velocity (scroll the page to speed it up)'] }],
    metric: [{ title: 'flash', members: [['flash, price', 'Price'], ['flash, request rate', 'Request rate'], ['flash, large, long hold', 'Large, long hold']] }],
    'notification-bell': [{ title: 'notification bell', members: ['interactive', 'max overflow', 'custom max', 'dot', 'ring on mount'] }],
    overlay: [
        { title: 'placement', members: [['center', 'Default'], 'north', 'south', 'west', 'east', 'north-east', 'south-west', 'floating'] },
        { title: 'stacked', members: ['stacked', 'stacked, pushing back the page'] },
        { title: 'transition', members: [['slide', 'Default'], 'scale', 'spring', 'blur backdrop', 'alert'] }
    ],
    pagination: [{ title: 'pages', members: [['overflow', 'Default'], 'few pages', 'two siblings'] }],
    progress: [{ title: 'text · upload', members: [['text · upload', 'Default'], ['text · large, blue', 'Large, blue']] }],
    range: [
        { title: 'Heading · Value above the track', members: [['Heading · Value above the track', 'Default'], ['Heading · Value above the track · 10% ticks', '10% ticks'], ['Heading · Value above the track · 10% and 2% ticks', '10% and 2% ticks']] },
        { title: 'Inline · Label and value inside the track', members: [['Inline · Label and value inside the track', 'Default'], ['Inline · Label and value inside the track · 10% ticks', '10% ticks'], ['Inline · Label and value inside the track · 10% and 2% ticks', '10% and 2% ticks']] },
        { title: 'slider', members: [['slider', 'Default'], ['disabled slider', 'Disabled']] },
        { title: 'slider with two thumbs', members: [['slider with two thumbs', 'Default'], ['disabled dual-thumb slider', 'Disabled']] },
        { title: 'slider with label and value', members: [['slider with label and value', 'Default'], 'slider with reference labels', 'slider with ticks'] },
        { title: 'min and max fields', members: [['min and max fields', 'Default'], 'fields, custom colors'] }
    ],
    scrollbar: [
        { title: 'vertical bar', members: [['default bar', 'Default'], 'visible on hover or keyboard focus', 'hidden bar', 'thin bar', 'no arrows', 'width variable'] },
        { title: 'horizontal bar', members: [['horizontal bar', 'Default'], 'no arrows (auto, horizontal)', 'drag (horizontal)'] },
        { title: 'fade', members: ['fade', 'fade (content fits)'] }
    ],
    select: [{ title: 'options', members: [['options', 'Default'], 'pre-selected'] }],
    'shortcut-recorder': [{ title: 'keyboard shortcuts', members: [['keyboard shortcuts', 'Default'], 'empty', 'limit', 'callout, whole field shakes'] }],
    switch: [{ title: 'switch', members: ['default', 'squared', 'on'] }],
    tasklist: [{ title: 'plan', members: ['plan', 'plan with a step left open'] }],
    textarea: [
        { title: 'focus animation', members: [['Halo · Expanding focus ring', 'Default'], ['Underline · Draw from center', 'Underline'], ['Lift · Soft spring elevation', 'Lift'], ['Wash · Tinted focus surface', 'Wash'], ['Bracket · Growing side accents', 'Bracket']] },
        { title: 'Board', members: [['Board · Label, hint and resize handle', 'Default'], ['Board · Sizes (medium, small)', 'Sizes'], ['Board · Auto resize (1 to 8 lines)', 'Auto resize'], ['Board · Character count', 'Character count'], ['Board · States (default, filled, disabled, invalid)', 'States']] },
        { title: 'textarea', members: ['default', 'autoresize', 'tall'] }
    ],
    tooltip: [
        { title: 'onhover', members: [['onhover', 'Default'], 'scale', 'scale + spring', 'spring'] },
        { title: 'nestedMenu', members: [['nestedMenu (drill down)', 'Default'], ['nestedMenu (instant)', 'Instant']] },
        { title: 'expand: smooth dropdown', members: [['expand: smooth dropdown (se)', 'Default'], ['expand: smooth dropdown (sw)', 'South-west'], ['expand: smooth dropdown (ne)', 'North-east'], ['expand: smooth dropdown (es)', 'East-south']] },
        { title: 'shared.delegate (toolbar)', members: [['shared.delegate (toolbar, edge, n)', 'Default'], ['shared.delegate (toolbar, edge, s)', 'South']] }
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
