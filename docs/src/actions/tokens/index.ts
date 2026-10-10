import { html, uri } from 'docs/app';
import { cssValue, map, themes, themeTokens, tokenSources, WEIGHTS } from 'docs/data/scss';
import { clipboard, icon } from '@esportsplus/ui/components';
import check from '@esportsplus/ui/svg/check.svg';
import copy from '@esportsplus/ui/svg/copy.svg';
import toast from 'docs/components/toaster';
import header from 'docs/components/page/header';
import type { Renderable, Router } from 'docs/app';
import type { Page, TocItem } from 'docs/types';
import 'docs/actions/tokens/scss/index.scss';


type Group = {
    id: string;
    kind: 'border-radius' | 'border-width' | 'color' | 'font-size' | 'size';
    title: string;
    variable: string;
};

type Mode = 'dark' | 'light';

type Token = {
    label: string;
    name: string;
    value: string;
};


const MODES: Mode[] = ['light', 'dark'];

const SHADE_SUFFIX = /-\d+$/;


let groups: Group[] = [
        { id: 'border-radius', kind: 'border-radius', title: 'Border Radius', variable: 'border-radius' },
        { id: 'border-width', kind: 'border-width', title: 'Border Width', variable: 'border-width' },
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

    // Canvas resolves OKLCH and converts to sRGB for relative luminance. A translucent color is laid over the base it
    // sits on, so the ink reads against what actually shows.
    let luminance = (color: string, base?: string) => {
        context.clearRect(0, 0, 1, 1);

        if (base) {
            context.fillStyle = base;
            context.fillRect(0, 0, 1, 1);
        }

        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);

        let data = context.getImageData(0, 0, 1, 1).data;

        return linear(data[0]) * 0.2126 + linear(data[1]) * 0.7152 + linear(data[2]) * 0.0722;
    };
    // Swatches are painted colors that never change under the reader, so their ink is fixed too.
    let black = luminance(cssValue('--color-black-500')),
        white = luminance(cssValue('--color-white-400')),
        ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

    return (value: string, base?: string) => {
        let background = luminance(value, base);

        return ratio(background, white) > ratio(background, black) ? '--color-white-400' : '--color-black-500';
    };
}

function colorPalette(values: Token[]): Renderable<unknown> {
    let families = new Map<string, Token[]>(),
        contrast = colorContrast(),
        resolved = { dark: index(themed('dark')), light: index(themed('light')) },
        roles = themes(tokenSources.color).light ?? {};

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
            ${palettes.map(([name, shades], index) => html`
                <div class='token-colors-family'>
                    <h3 class='token-colors-heading'>
                        <span class='token-colors-number'>${String(index + 1).padStart(2, '0')}</span>
                        ${name}
                    </h3>
                    <div class='card token-colors-strip'>
                        ${shades.map((token) => swatch(token, token.label.slice(name.length + 1), contrast(token.value)))}
                    </div>
                </div>
            `)}
            ${Object.keys(roles).map((role, index) => html`
                <div class='token-colors-family'>
                    <h3 class='token-colors-heading'>
                        <span class='token-colors-number'>${String(palettes.length + index + 1).padStart(2, '0')}</span>
                        ${role}
                    </h3>
                    <div class='card token-colors-strip token-colors-strip--theme'>
                        <div aria-hidden='true' class='token-colors-modes'>
                            ${MODES.map((mode) => html`<span class='token-colors-mode'>${mode}</span>`)}
                        </div>
                        ${themeTokens({ [role]: roles[role] }).map(({ name, weight }) => html`
                            <div class='token-colors-pair'>
                                ${MODES.map((mode) => {
                                    let token = resolved[mode][name];

                                    return swatch(token, weight || role, contrast(token.value, resolved[mode]['--color-surface']?.value), mode);
                                })}
                            </div>
                        `)}
                    </div>
                </div>
            `)}
        </div>
    `;
}

function index(tokens: Token[]) {
    return Object.fromEntries(tokens.map((token) => [token.name, token]));
}

function preview(kind: Exclude<Group['kind'], 'color'>, { value }: Token): Renderable<unknown> {
    if (kind === 'size') {
        return html`<div style='background: var(--color-blue-400); border-radius: var(--border-radius-200); height: var(--size-300); width: ${value};'></div>`;
    }

    if (kind === 'border-radius') {
        return html`<div style='background: var(--color-blue-400); border-radius: ${value}; height: var(--size-700); width: var(--size-700);'></div>`;
    }

    if (kind === 'border-width') {
        return html`<div style='border: ${value} solid var(--color-blue-400); border-radius: var(--border-radius-300); height: var(--size-600); width: var(--size-600);'></div>`;
    }

    return html`<span style='font-size: ${value};'>Aa</span>`;
}

// The colors that change with the mode, each resolved through a probe pinned to it: a token reads back as its
// unresolved 'light-dark()', so the probe's own color resolves it.
// A click-to-copy swatch; a mode pins it to that side of 'light-dark()' and paints it over that mode's page, so
// translucent shadows show as they would there.
function swatch(token: Token, shade: string, ink: string, mode?: Mode) {
    return clipboard.copy({
        class: 'token-colors-swatch',
        'data-theme': mode,
        style: mode
            ? `background: linear-gradient(var(${token.name}), var(${token.name})), var(--color-surface); color: var(${ink});`
            : `background: var(${token.name}); color: var(${ink});`,
        'aria-label': `Copy ${token.name}${mode ? ` (${mode})` : ''}: ${token.value}`,
        oncopied: () => toast(() => 'Color copied.'),
        onerror: () => toast(() => 'Could not copy color.'),
        timeout: 3000,
        value: token.value
    }, (state) => html`
            <span class='token-colors-value ${state.copied && '--copied'}'>
                ${icon({ class: 'token-colors-copy', 'aria-hidden': 'true' }, state.copied ? check : copy)}
                <span class='token-colors-text'>${token.value}</span>
            </span>
            <span class='token-colors-shade'>${shade}</span>
    `);
}

function themed(mode: Mode): Token[] {
    let out: Token[] = [],
        probe = document.createElement('div');

    probe.dataset.theme = mode;
    document.body.append(probe);

    let style = getComputedStyle(probe);

    for (let { name, role, weight } of themeTokens(themes(tokenSources.color)[mode] ?? {})) {
        probe.style.color = `var(${name})`;
        out.push({ label: weight ? `${role}-${weight}` : role, name, value: style.color });
    }

    probe.remove();

    return out;
}

function tokens(group: Group): Token[] {
    let node = map(tokenSources[group.variable], group.variable);

    if (node === null) {
        return [];
    }

    let out: Token[] = [];

    for (let key in node) {
        let value = node[key];

        // Palette colors are written once and weighted at the root.
        if (typeof value === 'string' && group.kind === 'color') {
            for (let weight of WEIGHTS) {
                let name = `--${group.variable}-${key}-${weight}`;

                out.push({ label: `${key}-${weight}`, name, value: cssValue(name) });
            }
        }
        else if (typeof value === 'string') {
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
                ${header({
                    breadcrumb: [{ href: uri('installation'), label: 'Getting Started' }, { href: uri('tokens'), label: 'Tokens' }],
                    description: 'The design tokens that every component and utility is built from, read directly from the source SCSS with their current resolved values.',
                    note: html`Font weights are defined per font family. See the <a class='page-note-link link link--underline' href='/fonts'>Fonts reference</a> for available families and weights.`,
                    title: 'Tokens'
                })}

                ${rendered.map(({ group: { id, kind, title }, tokens: values }) => html`
                    <section class='page-section' id='${id}'>
                        <h2>${title}</h2>

                        ${kind === 'color' ? colorPalette(values) : html`<div class='card spec-table-scroll'><table class='spec-table token-table token-table--${id}'>
                            <thead class='spec-table-head'>
                                <tr>
                                    <th class='spec-table-heading'>Token</th>
                                    <th class='spec-table-heading token-table-preview'>Preview</th>
                                    <th class='spec-table-heading token-table-value'>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${values.map((token) => html`
                                    <tr class='spec-table-row'>
                                        <td class='spec-table-cell spec-name'>${token.name}</td>
                                        <td class='spec-table-cell token-table-preview'>${preview(kind, token)}</td>
                                        <td class='spec-table-cell spec-value token-table-value'>
                                            ${token.value || '—'}
                                        </td>
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
