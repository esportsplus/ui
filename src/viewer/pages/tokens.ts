import { html, type Renderable } from '@esportsplus/template';
import { cssValue, map, tokenSources } from '~/viewer/data/scss';
import type { Page, TocItem } from '~/viewer/types';


type Group = {
    file: string;
    id: string;
    kind: 'box-shadow' | 'border-radius' | 'border-width' | 'color' | 'font-size' | 'font-weight' | 'line-height' | 'size';
    prefix: string;
    title: string;
    variable: string;
};

type Token = {
    label: string;
    name: string;
    value: string;
};


const groups: Group[] = [
    { file: '/src/tokens/scss/color.scss', id: 'colors', kind: 'color', prefix: 'color', title: 'Colors', variable: 'color' },
    { file: '/src/tokens/scss/size.scss', id: 'sizing', kind: 'size', prefix: 'size', title: 'Sizing', variable: 'size' },
    { file: '/src/tokens/scss/spacer.scss', id: 'spacing', kind: 'size', prefix: 'spacer', title: 'Spacing', variable: 'spacer' },
    { file: '/src/tokens/scss/font-size.scss', id: 'font-size', kind: 'font-size', prefix: 'font-size', title: 'Font Size', variable: 'font-size' },
    { file: '/src/tokens/scss/font-weight.scss', id: 'font-weight', kind: 'font-weight', prefix: 'font-weight', title: 'Font Weight', variable: 'font-weight' },
    { file: '/src/tokens/scss/line-height.scss', id: 'line-height', kind: 'line-height', prefix: 'line-height', title: 'Line Height', variable: 'line-height' },
    { file: '/src/tokens/scss/border-radius.scss', id: 'border-radius', kind: 'border-radius', prefix: 'border-radius', title: 'Border Radius', variable: 'border-radius' },
    { file: '/src/tokens/scss/border-width.scss', id: 'border-width', kind: 'border-width', prefix: 'border-width', title: 'Border Width', variable: 'border-width' },
    { file: '/src/tokens/scss/box-shadow.scss', id: 'box-shadow', kind: 'box-shadow', prefix: 'box-shadow', title: 'Box Shadow', variable: 'box-shadow' }
];


function preview(kind: Group['kind'], value: string): Renderable<unknown> {
    if (kind === 'color') {
        return html`<div class='swatch' style='background: ${value};'></div>`;
    }

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

    if (kind === 'font-weight') {
        return html`<span style='font-weight: ${value};'>Aa</span>`;
    }

    if (kind === 'font-size') {
        return html`<span style='font-size: ${value};'>Aa</span>`;
    }

    return html`<span style='line-height: ${value};'>Aa</span>`;
}

function tokens(group: Group): Token[] {
    let node = map(tokenSources[group.file], group.variable);

    if (node === null) {
        return [];
    }

    let out: Token[] = [];

    for (let key in node) {
        let value = node[key];

        if (typeof value === 'string') {
            let name = `--${group.prefix}-${key}`;

            out.push({ label: key, name, value: cssValue(name) });
        }
        else {
            for (let subkey in value) {
                let name = `--${group.prefix}-${key}-${subkey}`;

                out.push({ label: `${key}-${subkey}`, name, value: cssValue(name) });
            }
        }
    }

    return out;
}


const page = (): Page => {
    let rendered = groups
            .map((group) => ({ group, tokens: tokens(group) }))
            .filter((entry) => entry.tokens.length > 0),
        toc: TocItem[] = rendered.map((entry) => ({ id: entry.group.id, label: entry.group.title }));

    return {
        render: () => html`
            <div class='page'>
                <div class='page-head'>
                    <div class='page-eyebrow'>Design System</div>
                    <h1 class='page-title'>Tokens</h1>
                    <p class='page-lede'>The design tokens that every component and utility is built from, read directly from the source SCSS with their current resolved values.</p>
                </div>

                ${rendered.map((entry) => html`
                    <section id='${entry.group.id}'>
                        <h2 class='page-section-title'>${entry.group.title}</h2>

                        <table class='spec-table'>
                            <thead>
                                <tr><th>Token</th><th>Preview</th><th>Value</th></tr>
                            </thead>
                            <tbody>
                                ${entry.tokens.map((token) => html`
                                    <tr>
                                        <td class='spec-name'>${token.name}</td>
                                        <td>${preview(entry.group.kind, token.value)}</td>
                                        <td class='spec-value'>${token.value || '—'}</td>
                                    </tr>
                                `)}
                            </tbody>
                        </table>
                    </section>
                `)}
            </div>
        `,
        toc
    };
};


export default page;
