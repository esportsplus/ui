import { pageHead } from 'docs/components/page/head';
import { html } from 'docs/app';
import { cssValue, map, tokenSources } from 'docs/data/scss';
import { clipboard, icon } from '@esportsplus/ui/components';
import check from '@esportsplus/ui/svg/check.svg';
import copy from '@esportsplus/ui/svg/copy.svg';
import toast from 'docs/components/toaster';
import type { Renderable, Router } from 'docs/app';
import type { Page, TocItem } from 'docs/types';
import 'docs/actions/tokens/scss/index.scss';


type Group = {
    id: string;
    kind: 'box-shadow' | 'border-radius' | 'border-width' | 'color' | 'font-size' | 'size';
    title: string;
    variable: string;
};

type Token = {
    label: string;
    name: string;
    value: string;
};


const SHADE_SUFFIX = /-\d+$/;


const groups: Group[] = [
    { id: 'border-radius', kind: 'border-radius', title: 'Border Radius', variable: 'border-radius' },
    { id: 'border-width', kind: 'border-width', title: 'Border Width', variable: 'border-width' },
    { id: 'box-shadow', kind: 'box-shadow', title: 'Box Shadow', variable: 'box-shadow' },
    { id: 'colors', kind: 'color', title: 'Colors', variable: 'color' },
    { id: 'font-size', kind: 'font-size', title: 'Font Size', variable: 'font-size' },
    { id: 'sizing', kind: 'size', title: 'Sizing', variable: 'size' },
    { id: 'spacing', kind: 'size', title: 'Spacing', variable: 'spacer' }
];


function colorContrast() {
    let context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;

    let linear = (value: number) => {
        let channel = value / 255;

        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    };

    // Canvas resolves OKLCH and converts to sRGB for relative luminance.
    let luminance = (color: string) => {
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);

        let data = context.getImageData(0, 0, 1, 1).data;

        return linear(data[0]) * 0.2126 + linear(data[1]) * 0.7152 + linear(data[2]) * 0.0722;
    };
    let white = luminance(cssValue('--color-white-400')),
        text = luminance(cssValue('--color-text-400')),
        ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

    return (value: string) => {
        let background = luminance(value);
        return ratio(background, white) > ratio(background, text) ? '--color-white-400' : '--color-text-400';
    };
}

function colorPalette(values: Token[]): Renderable<unknown> {
    let families = new Map<string, Token[]>(),
        contrast = colorContrast();

    for (let token of values) {
        let family = token.label.replace(SHADE_SUFFIX, ''),
            shades = families.get(family);

        if (!shades) {
            families.set(family, shades = []);
        }

        shades.push(token);
    }

    let palettes = [...families];

    return html`
        <div class='token-colors'>
            <div class='token-colors-toolbar'>
                <div class='token-colors-navigation' aria-label='Color palettes'>
                    <span class='token-colors-caption'>Palettes</span>
                    ${palettes.map(([name, shades]) => html`
                        <a class='token-colors-dot' href='#palette-${name}' aria-label='${name} palette'
                            title='${name}' style='background: var(${shades[Math.floor(shades.length / 2)].name});'></a>
                    `)}
                </div>
                <span class='token-colors-caption'>Click a shade to copy</span>
            </div>

            ${palettes.map(([name, shades], index) => html`
                <div class='token-colors-family' id='palette-${name}'>
                    <h3 class='token-colors-heading'>
                        <span class='token-colors-number'>${String(index + 1).padStart(2, '0')}</span>
                        ${name}
                    </h3>
                    <div class='token-colors-strip'>
                        ${shades.map((token) => clipboard.copy({
                            class: 'token-colors-swatch',
                            style: `background: var(${token.name}); color: var(${contrast(token.value)});`,
                            'aria-label': `Copy ${token.name}: ${token.value}`,
                            oncopied: () => toast(() => 'Color copied.'),
                            onerror: () => toast(() => 'Could not copy color.'),
                            timeout: 3000,
                            value: token.value
                        }, (state) => html`
                                <span class='token-colors-value ${state.copied && '--copied'}'>
                                    ${icon({ class: 'token-colors-copy', 'aria-hidden': 'true' }, state.copied ? check : copy)}
                                    <span class='token-colors-text'>${token.value}</span>
                                </span>
                                <span class='token-colors-shade'>${token.label.slice(name.length + 1)}</span>
                        `))}
                    </div>
                </div>
            `)}
        </div>
    `;
}


function preview(kind: Exclude<Group['kind'], 'color'>, value: string): Renderable<unknown> {
    if (kind === 'size') {
        return html`<div style='background: var(--color-blue-400); border-radius: var(--border-radius-200); height: var(--size-300); width: ${value};'></div>`;
    }

    if (kind === 'border-radius') {
        return html`<div style='background: var(--color-blue-400); border-radius: ${value}; height: var(--size-700); width: var(--size-700);'></div>`;
    }

    if (kind === 'border-width') {
        return html`<div style='border: ${value} solid var(--color-blue-400); border-radius: var(--border-radius-300); height: var(--size-600); width: var(--size-600);'></div>`;
    }

    if (kind === 'box-shadow') {
        return html`<div style='background: var(--background); border-radius: var(--border-radius-300); box-shadow: ${value}; height: var(--size-600); width: var(--size-600);'></div>`;
    }

    return html`<span style='font-size: ${value};'>Aa</span>`;
}

function tokens(group: Group): Token[] {
    let node = map(tokenSources[group.variable], group.variable);

    if (node === null) {
        return [];
    }

    let out: Token[] = [];

    for (let key in node) {
        let value = node[key];

        if (typeof value === 'string') {
            let name = `--${group.variable}-${key}`;

            out.push({ label: key, name, value: cssValue(name) });
        }
        else {
            for (let subkey in value) {
                let name = `--${group.variable}-${key}-${subkey}`;

                out.push({ label: `${key}-${subkey}`, name, value: cssValue(name) });
            }
        }
    }

    return out;
}


const responder = (): Page => {
    let rendered = groups
            .map((group) => ({ group, tokens: tokens(group) }))
            .filter((entry) => entry.tokens.length > 0),
        toc: TocItem[] = rendered.map((entry) => ({ id: entry.group.id, label: entry.group.title }));

    return {
        render: () => html`
            <div class='page'>
                ${pageHead({ title: 'Tokens', description: 'The design tokens that every component and utility is built from, read directly from the source SCSS with their current resolved values.' })}

                <p class='page-note'>Font weights are defined per font family. See the <a href='/fonts'>Fonts reference</a> for available families and weights.</p>

                ${rendered.map(({ group: { id, kind, title }, tokens: values }) => html`
                    <section id='${id}'>
                        <h2 class='page-section-title'>${title}</h2>

                        ${kind === 'color' ? colorPalette(values) : html`<div class='spec-table-scroll'><table class='spec-table'>
                            <thead class='spec-table-head'>
                                <tr><th class='spec-table-heading'>Token</th><th class='spec-table-heading'>Preview</th><th class='spec-table-heading'>Value</th></tr>
                            </thead>
                            <tbody>
                                ${values.map((token) => html`
                                    <tr class='spec-table-row'>
                                        <td class='spec-table-cell spec-name'>${token.name}</td>
                                        <td class='spec-table-cell'>${preview(kind, token.value)}</td>
                                        <td class='spec-table-cell spec-value'>${token.value || '—'}</td>
                                    </tr>
                                `)}
                            </tbody>
                        </table></div>`}
                    </section>
                `)}
            </div>
        `,
        toc
    };
};


export default (r: Router) => r
    .get({ name: 'tokens', path: '/tokens', responder });
