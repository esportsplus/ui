import header from 'docs/components/page/header';
import { html, uri } from 'docs/app';
import { themes, themeTokens, tokenSources, WEIGHTS } from 'docs/data/scss';
import { pickers } from 'docs/actions/themes/pickers';
import { preview } from 'docs/components/preview';
import type { Router } from 'docs/app';
import type { Page, TocItem } from 'docs/types';
import 'docs/actions/themes/scss/index.scss';


type Mode = 'dark' | 'light';


const MODES: Mode[] = ['light', 'dark'];

const SCSS = `.badge {
    background: light-dark(var(--color-white-300), var(--color-black-300));
    border: 1px solid var(--surface-border-default);
    color: var(--color-text-400);
}`;

const TOC: TocItem[] = [
    { id: 'how-it-works', label: 'How it works' },
    { id: 'tokens', label: 'Tokens' },
    { id: 'setup', label: 'Setup' },
    { id: 'usage', label: 'Usage' },
    { id: 'pickers', label: 'Pickers' }
];

const TYPESCRIPT = `import theme from '@esportsplus/ui/theme';

// Pass a @esportsplus/web-storage Local store to keep the preference across reloads.
let mode = theme();

mode.set('dark');       // 'dark' | 'light' | 'system'
mode.preference;        // what the user picked
mode.mode;              // what is showing: 'system' resolves through prefers-color-scheme`;


function sample(mode: Mode) {
    return html`
        <div data-theme='${mode}' style='background: var(--color-surface); border-radius: var(--border-radius-400); display: grid; flex: 1; gap: var(--size-300); min-width: 220px; padding: var(--size-500);'>
            <strong style='color: var(--color-text-500); text-transform: capitalize;'>${mode}</strong>
            ${WEIGHTS.map((weight) => html`
                <div style='background: light-dark(var(--color-white-300), var(--color-black-300)); border: 1px solid light-dark(var(--color-grey-300), var(--color-black-300)); border-radius: var(--border-radius-300); color: var(--color-text-${weight}); padding: var(--size-300);'>
                    --color-text-${weight}
                </div>
            `)}
        </div>
    `;
}

// Read through a probe pinned to each mode, so the table shows exactly what the stylesheet ships. A token reads back as
// its unresolved 'light-dark()', so each is resolved through the probe's own color.
function values(mode: Mode) {
    let out: Record<string, string> = {},
        probe = document.createElement('div');

    probe.dataset.theme = mode;
    document.body.append(probe);

    let style = getComputedStyle(probe);

    for (let name of tokens()) {
        probe.style.color = `var(${name})`;
        out[name] = style.color;
    }

    probe.remove();

    return out;
}

// The values as written in '$themes', where token references survive; computed values resolve them away.
function sources(mode: Mode) {
    let out: Record<string, string> = {};

    for (let token of themeTokens(themes(tokenSources.color)[mode] ?? {})) {
        if (token.value.includes('var(')) {
            out[token.name] = token.value;
        }
    }

    return out;
}

function tokens() {
    return themeTokens(themes(tokenSources.color).light ?? {}).map((token) => token.name);
}


const responder = (): Page => {
    let resolved = { dark: values('dark'), light: values('light') },
        source = { dark: sources('dark'), light: sources('light') };

    return {
        render: () => html`
            <div class='page themes'>
                ${header({ breadcrumb: [{ href: uri('installation'), label: 'Getting Started' }, { href: uri('themes'), label: 'Themes' }], title: 'Themes', description: 'One attribute switches the page between light and dark. Text and shadows follow it on their own; every component picks its own pair of palette colors for the two modes.' })}

                <section class='page-section' id='how-it-works'>
                    <h2>How it works</h2>
                    <p>
                        Five roles change with the mode, each declared once on <code>:root</code> as a
                        <code>light-dark()</code> of its two values: <code>--color-surface</code> the page,
                        <code>--color-primary-{weight}</code> its opposite (black on a light page, white on a dark one),
                        <code>--color-secondary</code> the quiet fill as it sits on the page, <code>--color-text-{weight}</code>
                        text (300 muted to 500 strongest) and <code>--color-shadow</code>, the one shadow color every shadow
                        scales. Layers step their backgrounds from the page, keep secondary's distance from the page off their
                        own, and mix the primary into their borders and states, so they follow the mode without naming
                        colors. Everything else comes
                        from the fixed palette, and a component that needs its own pair wraps two palette colors in
                        <code>light-dark()</code>.
                    </p>
                    <p>
                        Which side shows is decided where a color is used, by that element's <code>color-scheme</code>. The root
                        sets <code>color-scheme: light dark</code>, so with nothing else the page follows the operating system
                        in CSS alone. <code>data-theme='light'</code> or <code>data-theme='dark'</code> pins the mode: the theme
                        sets it on <code>&lt;html&gt;</code> when the user picks one, and any element can carry it to render its
                        subtree in the other mode. <code>--background</code> and <code>--color</code> read the page's background
                        and text, and native controls and scrollbars follow <code>color-scheme</code> too.
                    </p>
                    ${preview({ node: html`<div style='display: flex; flex-wrap: wrap; gap: var(--size-400); width: 100%;'>${MODES.map(sample)}</div>` })}
                </section>

                <section class='page-section' id='tokens'>
                    <h2>Tokens</h2>
                    <div class='card spec-table-scroll'><table class='spec-table'>
                        <thead class='spec-table-head'>
                            <tr>
                                <th class='spec-table-heading'>Token</th>
                                ${MODES.map((mode) => html`<th class='spec-table-heading'>data-theme='${mode}'</th>`)}
                            </tr>
                        </thead>
                        <tbody>
                            ${tokens().map((name) => html`
                                <tr class='spec-table-row'>
                                    <td class='spec-table-cell spec-name'>${name}</td>
                                    ${MODES.map((mode) => html`
                                        <td class='spec-table-cell spec-value'>
                                            <span data-theme='${mode}' style='background: linear-gradient(var(${name}), var(${name})), var(--color-surface); border: 1px solid light-dark(var(--color-grey-500), var(--color-black-300)); border-radius: var(--border-radius-200); display: inline-block; height: 12px; margin-right: var(--size-200); vertical-align: middle; width: 12px;'></span>${resolved[mode][name]}
                                            ${source[mode][name] && html`
                                                <span style='color: var(--color-text-300); display: block; font-size: var(--font-size-200); margin-top: var(--size-100);'>${source[mode][name]}</span>
                                            `}
                                        </td>
                                    `)}
                                </tr>
                            `)}
                        </tbody>
                    </table></div>
                </section>

                <section class='page-section' id='setup'>
                    <h2>Setup</h2>
                    <p>
                        Create one theme instance at startup. It follows the operating system until the user picks a mode, then
                        writes <code>data-theme</code> to <code>&lt;html&gt;</code>; picking <code>'system'</code> removes it again.
                    </p>
                    ${preview({ code: { language: 'typescript', value: TYPESCRIPT }, title: 'theme.ts' })}
                </section>

                <section class='page-section' id='usage'>
                    <h2>Usage</h2>
                    <p>
                        Use <code>--color-text-*</code> for text and the surface tokens for layers; both follow the mode on
                        their own. For anything else, wrap two palette colors in <code>light-dark()</code>, the light
                        mode's first: <code>--color-white-*</code> or <code>--color-grey-*</code> on a light page,
                        <code>--color-black-*</code> on a dark one. A color that should look the same in both, such as text on a
                        brand fill, uses its palette token alone. Brand colors such as <code>--color-accent-*</code> are not
                        part of the theme.
                    </p>
                    ${preview({ code: { language: 'scss', value: SCSS }, title: 'badge.scss' })}
                </section>

                ${pickers()}
            </div>
        `,
        toc: TOC
    };
};


export default (r: Router) => r
    .get({ name: 'themes', path: '/themes', responder });
