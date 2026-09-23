import { html, type Renderable } from '@esportsplus/template';

import type { Utility } from '../types';


const COLORS = ['blue', 'green', 'purple', 'red', 'grey', 'yellow'];

const order = [
    'Layout',
    'Surface',
    'State',
    'Scroll'
];


function boxStyle() {
    return 'align-items: center; background: var(--color-blue-400); border-radius: var(--border-radius-300); color: var(--color-white-400); display: flex; justify-content: center; min-height: var(--size-700); min-width: var(--size-700); padding: var(--size-300);';
}

function box(label: Renderable<unknown>) {
    return html`<div style='${boxStyle()}'>${label}</div>`;
}

function boxes(count: number) {
    let out: Renderable<unknown>[] = [];

    for (let i = 1; i <= count; i++) {
        out.push(box(i));
    }

    return out;
}

function gap(key: number) {
    return `--gap-horizontal: var(--size-${key}); --gap-vertical: var(--size-${key});`;
}

function note(text: string) {
    return html`<p class='docs-page-note'>${text}</p>`;
}


const utilities: Utility[] = [
    {
        category: 'Layout',
        description: 'Absolutely position an element and pin it to an edge or center it within its nearest positioned ancestor.',
        name: 'absolute',
        variants: [
            {
                render: () => html`
                    <div style='background: var(--color-grey-500); border-radius: var(--border-radius-400); height: var(--size-900); position: relative; width: 100%;'>
                        <div class='--absolute-center' style='${boxStyle()}'>center</div>
                    </div>
                `,
                title: 'center'
            },
            {
                render: () => html`
                    <div style='background: var(--color-grey-500); border-radius: var(--border-radius-400); height: var(--size-900); position: relative; width: 100%;'>
                        <div class='--absolute-top' style='${boxStyle()}'>top</div>
                    </div>
                `,
                title: 'top'
            }
        ]
    },
    {
        category: 'Layout',
        description: 'Flexbox layouts with alignment and direction modifiers; set --gap-horizontal and --gap-vertical to space children.',
        name: 'flex',
        variants: [
            {
                render: () => html`<div class='--flex-center' style='${gap(400)}'>${boxes(3)}</div>`,
                title: 'center'
            },
            {
                render: () => html`<div class='--flex-column' style='${gap(300)}'>${boxes(3)}</div>`,
                title: 'column'
            },
            {
                render: () => html`<div class='--flex-horizontal-space-between' style='${gap(400)} width: 100%;'>${boxes(3)}</div>`,
                title: 'space-between'
            }
        ]
    },
    {
        category: 'Layout',
        description: 'Inline and inline-flex display helpers for laying elements out along the text baseline.',
        name: 'inline',
        variants: [
            {
                render: () => html`<div>Text flows around <span class='--inline' style='${boxStyle()} display: inline-flex;'>inline</span> content on the same line.</div>`,
                title: 'inline'
            }
        ]
    },
    {
        category: 'Surface',
        description: 'Apply token background colors to any surface via --background-* classes.',
        name: 'background',
        variants: [
            {
                render: () => html`<div class='--flex-center' style='${gap(400)}'>${COLORS.map((c) => html`
                    <div class='--flex-column' style='${gap(100)} align-items: center;'>
                        <div class='--background-default --background-${c}' style='background: var(--background); border: 1px solid var(--color-border-500); border-radius: var(--border-radius-300); height: var(--size-800); width: var(--size-800);'></div>
                        <span style='font-size: var(--font-size-200);'>${c}</span>
                    </div>
                `)}</div>`,
                title: 'colors'
            }
        ]
    },
    {
        category: 'Surface',
        description: 'Border color helpers built from the color tokens via --border-* classes.',
        name: 'border',
        variants: [
            {
                render: () => html`<div class='--flex-center' style='${gap(400)}'>${['--border-blue', '--border-red', '--border-green'].map((c) => html`<div class='--border-default ${c}' style='--border-width: var(--border-width-400); border: var(--border-width) solid var(--border-color); border-radius: var(--border-radius-300); padding: var(--size-400);'>${c.replace('--border-', '')}</div>`)}</div>`,
                title: 'colors'
            }
        ]
    },
    {
        category: 'Surface',
        description: 'Apply token text colors to any element via --color-* classes.',
        name: 'color',
        variants: [
            {
                render: () => html`<div class='--flex-center' style='${gap(400)} font-weight: var(--font-weight-500);'>${COLORS.map((c) => html`<span class='--color-default --color-${c}' style='color: var(--color);'>${c}</span>`)}</div>`,
                title: 'colors'
            }
        ]
    },
    {
        category: 'Surface',
        description: 'Frosted glass surface with backdrop blur and a translucent background.',
        name: 'glass',
        variants: [
            {
                render: () => html`
                    <div style='background: linear-gradient(120deg, var(--color-blue-400), var(--color-purple-400)); border-radius: var(--border-radius-500); padding: var(--size-700);'>
                        <div class='--glass' style='border-radius: var(--border-radius-400); color: var(--color-white-400); padding: var(--size-500);'>Frosted glass</div>
                    </div>
                `,
                title: 'glass'
            }
        ]
    },
    {
        category: 'Surface',
        description: 'Typography helpers for cropping and truncating text.',
        name: 'text',
        variants: [
            {
                render: () => html`<div class='--text-truncate' style='max-width: 240px;'>This sentence is intentionally long so it gets truncated with an ellipsis.</div>`,
                title: 'truncate'
            }
        ]
    },
    {
        category: 'State',
        description: 'Dim an element and block interaction to signal a disabled state.',
        name: 'disabled',
        variants: [
            {
                render: () => html`<div class='button button--primary --disabled' style='--width: auto;'>Disabled</div>`,
                title: 'disabled'
            }
        ]
    },
    {
        category: 'State',
        description: 'Hide elements from layout and assistive technology with --hidden.',
        name: 'hidden',
        variants: [
            {
                render: () => html`
                    <div class='--flex-center' style='${gap(400)}'>
                        ${box('visible')}
                        <div class='--hidden' style='${boxStyle()}'>hidden</div>
                        ${note('The second box uses --hidden and is removed from layout.')}
                    </div>
                `,
                title: 'hidden'
            }
        ]
    },
    {
        category: 'State',
        description: 'Set the not-allowed cursor to communicate a blocked interaction.',
        name: 'not-allowed',
        variants: [
            {
                render: () => html`<div class='button button--tertiary --not-allowed' style='--width: auto;'>Hover me</div>`,
                title: 'not-allowed'
            }
        ]
    },
    {
        category: 'State',
        description: 'Animated shimmer placeholder for loading and skeleton states.',
        name: 'skeleton',
        variants: [
            {
                render: () => html`<div class='--skeleton' style='--from: var(--color-border-500); --to: var(--color-grey-400); border: 1px solid var(--color-border-400); border-radius: var(--border-radius-400); height: var(--size-800); width: 240px;'></div>`,
                title: 'skeleton'
            }
        ]
    },
    {
        category: 'Scroll',
        description: 'Thin, token-colored scrollbar styling for scrollable containers.',
        name: 'scrollbar',
        variants: [
            {
                render: () => html`
                    <div class='--scrollbar' style='background: var(--color-grey-500); border-radius: var(--border-radius-400); height: var(--size-900); padding: var(--size-400); width: 100%;'>
                        <div style='height: 480px;'>Scroll me — the container uses --scrollbar for a thin, token-colored scrollbar.</div>
                    </div>
                `,
                title: 'scrollbar'
            }
        ]
    }
];


export { order, utilities };
