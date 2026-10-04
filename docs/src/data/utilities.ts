import { html, type Renderable } from '@esportsplus/template';
import glass from '@esportsplus/ui/css-utilities/glass';

import type { Utility } from 'docs/types';


const COLORS = ['blue', 'green', 'purple', 'red', 'grey', 'yellow'];

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


const utilities: Utility[] = [
    {
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
        description: 'Uniform or progressive backdrop blur; glass() adds a uniform overlay, glass(\'progressive\') adds seven masked layers, and --blur sets the blur radius.',
        name: 'glass',
        variants: [
            {
                render: () => html`
                    <div style='background: linear-gradient(120deg, var(--color-blue-400), var(--color-purple-400)); border-radius: var(--border-radius-500); padding: var(--size-700);'>
                        <div ${glass()} style='border-radius: var(--border-radius-400); color: var(--color-white-400); padding: var(--size-500);'>Frosted glass</div>
                    </div>
                `,
                title: 'uniform'
            },
            {
                render: () => html`
                    <div style='background: linear-gradient(120deg, var(--color-blue-400), var(--color-purple-400)); border-radius: var(--border-radius-500); padding: var(--size-700);'>
                        <div ${glass('progressive')} style='border-radius: var(--border-radius-400); color: var(--color-white-400); padding: var(--size-500);'>Progressive frosted glass</div>
                    </div>
                `,
                title: 'progressive'
            }
        ]
    },
    {
        description: 'Typography helpers for cropping, truncating, filling text with a looping gradient, hatching a drifting drop shadow and sweeping a band of light across muted text; set --color-from, --color-to, --duration and --speed to tune --text-gradient, give --text-line-shadow its text in data-text (--shadow-color, --line-size, --offset, --duration tune it), and tune --text-shiny with --shine-color, --shine-duration, --shine-text-color and --shine-width.',
        name: 'text',
        variants: [
            {
                render: () => html`<p class='--text-gradient' style='font-size: 36px; font-weight: var(--font-weight-600); letter-spacing: -0.025em; margin: 0;'>Introducing Magic UI</p>`,
                title: 'gradient'
            },
            {
                render: () => html`<p class='--text-gradient' style='--color-from: #4ade80; --color-to: #06b6d4; --speed: 2; font-size: 36px; font-weight: var(--font-weight-600); letter-spacing: -0.025em; margin: 0;'>Fast Gradient</p>`,
                title: 'gradient, custom colors, speed 2'
            },
            {
                render: () => html`<h1 style='font-size: clamp(48px, 9vw, 96px); font-weight: var(--font-weight-600); letter-spacing: -0.05em; line-height: 1; margin: 0;'>Ship <span class='--text-line-shadow' data-text='Fast' style='font-style: italic;'>Fast</span></h1>`,
                title: 'line shadow'
            },
            {
                render: () => html`<h1 class='--text-line-shadow' data-text='Colored' style='--shadow-color: var(--color-blue-400); font-size: clamp(48px, 9vw, 96px); font-weight: var(--font-weight-600); letter-spacing: -0.05em; line-height: 1; margin: 0;'>Colored</h1>`,
                title: 'line shadow, custom color'
            },
            {
                render: () => html`<p class='--text-shiny' style='font-size: 16px; margin: 0;'>✨ Introducing Magic UI</p>`,
                title: 'shiny'
            },
            {
                render: () => html`<p class='--text-shiny' style='--shine-width: 200px; font-size: 32px; font-weight: var(--font-weight-600); letter-spacing: -0.025em; margin: 0;'>Shimmering across a headline</p>`,
                title: 'shiny, wide band'
            },
            {
                render: () => html`<div class='--text-truncate' style='max-width: 240px;'>This sentence is intentionally long so it gets truncated with an ellipsis.</div>`,
                title: 'truncate'
            }
        ]
    },
    {
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


export { utilities };
