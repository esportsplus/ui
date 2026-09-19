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

function note(text: string) {
    return html`<p class='docs-page-note'>${text}</p>`;
}


const utilities: Utility[] = [
    {
        category: 'Layout',
        description: 'Margin and padding steps on the size scale, applied uniformly or per side via --margin-* and --padding-* classes.',
        name: 'spacing',
        variants: [
            {
                render: () => html`<div class='--padding-700' style='background: var(--color-grey-500); border-radius: var(--border-radius-400);'>${box('--padding-700')}</div>`,
                title: 'padding'
            },
            {
                render: () => html`<div class='--flex-start'>${['--margin-200', '--margin-500', '--margin-800'].map((c) => html`<div class='${c}' style='${boxStyle()}'>${c.replace('--margin-', '')}</div>`)}</div>`,
                title: 'margin'
            }
        ]
    },
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
        description: 'Flexbox layouts with alignment and direction modifiers, plus token-based gaps.',
        name: 'flex',
        variants: [
            {
                render: () => html`<div class='--flex-center --gap-400'>${boxes(3)}</div>`,
                title: 'center'
            },
            {
                render: () => html`<div class='--flex-column --gap-300'>${boxes(3)}</div>`,
                title: 'column'
            },
            {
                render: () => html`<div class='--flex-horizontal-space-between --gap-400' style='width: 100%;'>${boxes(3)}</div>`,
                title: 'space-between'
            }
        ]
    },
    {
        category: 'Layout',
        description: 'Set the horizontal and vertical gap between flex or grid children using the size scale.',
        name: 'gap',
        variants: [
            {
                render: () => html`<div class='--flex-start --gap-200'>${boxes(4)}</div>`,
                title: 'gap-200'
            },
            {
                render: () => html`<div class='--flex-start --gap-600'>${boxes(4)}</div>`,
                title: 'gap-600'
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
        category: 'Layout',
        description: 'Square sizing helpers that set width and height together from the size scale.',
        name: 'size',
        variants: [
            {
                render: () => html`<div class='--flex-center --gap-400'>${['--size-500', '--size-700', '--size-900'].map((c) => html`<div class='${c}' style='background: var(--color-blue-400); border-radius: var(--border-radius-300); height: var(--size); width: var(--size);'></div>`)}</div>`,
                title: 'squares'
            }
        ]
    },
    {
        category: 'Layout',
        description: 'Width helpers for full and fractional block sizing.',
        name: 'width',
        variants: [
            {
                render: () => html`<div class='--flex-column --gap-300' style='width: 100%;'>${['--width-full', '--width-half'].map((c) => html`<div class='--width ${c}' style='${boxStyle()}'>${c.replace('--width-', '')}</div>`)}</div>`,
                title: 'full & half'
            }
        ]
    },
    {
        category: 'Layout',
        description: 'Viewport-relative sizing helper for full-height sections.',
        name: 'viewport',
        variants: [
            {
                render: () => html`
                    <div>
                        <div class='code'>--viewport</div>
                        ${note('Sets the element to fill the viewport height (100svh). Not shown at scale so it does not overflow this preview.')}
                    </div>
                `,
                title: 'viewport'
            }
        ]
    },
    {
        category: 'Surface',
        description: 'Apply token background colors to any surface via --background-* classes.',
        name: 'background',
        variants: [
            {
                render: () => html`<div class='--flex-center --gap-400'>${COLORS.map((c) => html`
                    <div class='--flex-column --gap-100' style='align-items: center;'>
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
        description: 'Border color, style, radius, and width helpers built from the border tokens.',
        name: 'border',
        variants: [
            {
                render: () => html`<div class='--flex-center --gap-400'>${['--border-blue', '--border-red', '--border-green'].map((c) => html`<div class='--border --border-default ${c}' style='border-radius: var(--border-radius-300); padding: var(--size-400);'>${c.replace('--border-', '')}</div>`)}</div>`,
                title: 'colors'
            },
            {
                render: () => html`<div class='--flex-center --gap-400'>${['--border-dashed', '--border-dotted'].map((c) => html`<div class='--border --border-default --border-blue ${c}' style='border-radius: var(--border-radius-300); padding: var(--size-400);'>${c.replace('--border-', '')}</div>`)}</div>`,
                title: 'styles'
            }
        ]
    },
    {
        category: 'Surface',
        description: 'Apply token text colors to any element via --color-* classes.',
        name: 'color',
        variants: [
            {
                render: () => html`<div class='--flex-center --gap-400' style='font-weight: var(--font-weight-500);'>${COLORS.map((c) => html`<span class='--color-default --color-${c}' style='color: var(--color);'>${c}</span>`)}</div>`,
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
        description: 'Line-height helpers mapped to the line-height token scale.',
        name: 'line-height',
        variants: [
            {
                render: () => html`<div class='--flex-column --gap-400'>${['--line-height-100', '--line-height-400'].map((c) => html`<p class='${c}' style='line-height: var(--line-height); max-width: 40ch;'><span class='code'>${c}</span> — The quick brown fox jumps over the lazy dog and keeps on running past the second line.</p>`)}</div>`,
                title: 'line-height'
            }
        ]
    },
    {
        category: 'Surface',
        description: 'Typography helpers for transform, alignment, weight, and decoration.',
        name: 'text',
        variants: [
            {
                render: () => html`<div class='--flex-column --gap-300'>${['--text-uppercase', '--text-bold', '--text-italic', '--text-underline', '--text-line-through'].map((c) => html`<div class='${c}'>${c.replace('--text-', '')} — sample text</div>`)}</div>`,
                title: 'styles'
            },
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
        description: 'Plays a brief shake animation to flag an errored element.',
        name: 'error',
        variants: [
            {
                render: () => html`<div class='--border --border-default --border-red --error' style='--animation-duration: 0.5s; border-radius: var(--border-radius-300); color: var(--color-red-400); padding: var(--size-400);'>Something went wrong</div>`,
                title: 'error'
            }
        ]
    },
    {
        category: 'State',
        description: 'Dims the non-active children of a container so the active one stands out.',
        name: 'focus',
        variants: [
            {
                render: () => html`<div class='--focus-active --flex-center --gap-400'>${[0, 1, 2].map((i) => html`<div class='${i === 1 ? '--active' : ''}' style='${boxStyle()}'>${i + 1}</div>`)}</div>`,
                title: 'focus-active'
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
                    <div class='--flex-center --gap-400'>
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
        description: 'Toggle pointer-events to make elements click-through or interactive.',
        name: 'pointer',
        variants: [
            {
                render: () => html`
                    <div>
                        <div class='--pointer-none button button--primary' style='--width: auto;'>Click-through</div>
                        ${note('--pointer-none disables pointer events; --pointer restores them.')}
                    </div>
                `,
                title: 'pointer'
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
        category: 'State',
        description: 'Subtle flicker animation for drawing attention to transient elements.',
        name: 'flicker',
        variants: [
            {
                render: () => html`<div class='--flicker' style='${boxStyle()} min-width: var(--size-900);'>flicker</div>`,
                title: 'flicker'
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
