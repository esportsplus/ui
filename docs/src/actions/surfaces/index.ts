import header from 'docs/components/page/header';
import { html, reactive, uri } from 'docs/app';
import { range } from '@esportsplus/ui/components';
import { preview } from 'docs/components/preview';
import type { Renderable, Router } from 'docs/app';
import type { Page, TocItem } from 'docs/types';
import 'docs/actions/surfaces/scss/index.scss';


type Mode = (typeof MODES)[number];


const DEPTHS = [
    { label: 'On the page', wrap: (menu: Renderable<unknown>) => menu },
    { label: 'Inside a card', wrap: (menu: Renderable<unknown>) => html`<div class='surfaces-card'>${menu}</div>` },
    { label: 'Inside a dialog', wrap: (menu: Renderable<unknown>) => html`<div class='surfaces-dialog'>${menu}</div>` }
];

const HIGHEST = 6;

const LOWEST = -3;

const MODES = ['light', 'dark'] as const;

const SCSS = `// Counts a level above whatever it sits in, and paints that level's background and shadow.
.menu {
    @extend %surface-raised;
}

// Counts a level below; a sunken layer casts no shadow.
.toolbar {
    @extend %surface-sunken;
}

// Counts only, for a component that routes its colors through its own variables.
.tooltip {
    @extend %surface-raised-level;
    --tooltip-background: var(--surface-background-default);
    --tooltip-shadow: var(--surface-shadow-default);
}

// A fresh stack wherever it opens: level 1, with the deepest shadow.
.dialog {
    @extend %surface-root;
}`;

const TOC: TocItem[] = [
    { id: 'ladder', label: 'The ladder' },
    { id: 'levels', label: 'Move through levels' },
    { id: 'depth', label: 'Any depth' },
    { id: 'usage', label: 'Usage' },
    { id: 'tokens', label: 'Tokens' }
];

const TOKENS: [string, string][] = [
    ['--surface-level', 'The layer\'s level: 0 the page, each surface one above or below the one it sits in.'],
    ['--surface-background-{state}', 'The level\'s background, and the step hover, active and pressed move it.'],
    ['--surface-border-{state}', 'The primary color mixed into the background, for lines, rings and edges.'],
    ['--surface-secondary-{state}', 'The theme\'s secondary, kept the same distance off every level\'s background.'],
    ['--surface-shadow-{state}', 'The shadow at the layer\'s elevation, lifting on hover and settling when pressed.'],
    ['--surface-shadow-{0-6}', 'Each elevation\'s shadow: a raised layer takes its level\'s, sunken 0, dialogs 6.']
];


// A layer pinned to a level skips the style queries that pick its shadow, so it pins that too.
function pin(level: number) {
    let elevation = Math.min(Math.max(level, 0), HIGHEST);

    return `--surface-level: ${level}; --surface-shadow-default: var(--surface-shadow-${elevation});`;
}

function ladder(mode: Mode) {
    let levels: number[] = [];

    for (let level = LOWEST; level <= HIGHEST; level++) {
        levels.push(level);
    }

    return html`
        <div class='surfaces-mode' data-theme='${mode}' style='--surface-level: 0;'>
            <strong class='surfaces-mode-title'>${mode}</strong>
            <div class='surfaces-ladder'>
                ${levels.map((level) => html`<div class='surfaces-swatch' style='${pin(level)}'></div>`)}
            </div>
        </div>
    `;
}

function menu() {
    return html`
        <div class='surfaces-menu'>
            <span class='surfaces-menu-item surfaces-menu-item--active'>Favorites</span>
            <span class='surfaces-menu-item surfaces-menu-item--hover'>Recents</span>
            <span class='surfaces-menu-item'>Archived</span>
        </div>
    `;
}

// The slice 'low' to 'high', each layer a surface counting one above the one it sits in.
function nest(level: number, high: number): Renderable<unknown> {
    return html`
        <div class='surfaces-layer'>
            ${level < high ? nest(level + 1, high) : ''}
        </div>
    `;
}

// In the page's own mode, so the whole width goes to the nest; the theme picker flips it.
function viewer(state: { high: number, low: number }) {
    return html`
        <div class='surfaces-mode' style='--surface-level: 0;'>
            <div class='surfaces-stage'>
                ${() => html`
                    <div class='surfaces-layer' style='${pin(state.low)}'>
                        ${state.low < state.high ? nest(state.low + 1, state.high) : ''}
                    </div>
                `}
            </div>
        </div>
    `;
}


const responder = (): Page => {
    let state = reactive({ high: 4, low: 0 });

    return {
        render: () => html`
            <div class='page surfaces'>
                ${header({ breadcrumb: [{ href: uri('installation'), label: 'Getting Started' }, { href: uri('surfaces'), label: 'Surfaces' }], title: 'Surfaces', description: 'Layers count their level from whatever they sit in and paint themselves from it, so menus, popovers and dialogs stay distinct at any depth, in light and dark.' })}

                <section class='page-section' id='ladder'>
                    <h2>The ladder</h2>
                    <p>
                        Every layer sits on a level: <code>0</code> is the page, each raised surface one above whatever
                        holds it and each sunken one below. Light mode climbs to white in half-point steps and then leaves
                        elevation to the shadow; dark mode lightens 2.25 points a level up to 6 above the page. Sunken
                        levels step darker in both, and cast no shadow.
                    </p>
                    ${preview({ node: html`<div class='surfaces-modes surfaces-modes--stack'>${MODES.map(ladder)}</div>` })}
                </section>

                <section class='page-section' id='levels'>
                    <h2>Move through levels</h2>
                    <p>
                        Drag both knobs to choose which slice of the ladder to nest. The outer layer is pinned to the low
                        knob; every layer inside is an ordinary surface that counts one above the one it sits in. Switch
                        the theme to see the same slice in the other mode.
                    </p>
                    ${preview({
                        node: html`
                            <div class='surfaces-viewer'>
                                ${viewer(state)}
                                ${range.filter({
                                    format: (value: number) => String(value),
                                    label: 'Levels',
                                    max: HIGHEST,
                                    min: LOWEST,
                                    prefix: '',
                                    state,
                                    step: 1,
                                    ticks: HIGHEST - LOWEST + 1,
                                    value: [state.low, state.high]
                                })}
                            </div>
                        `
                    })}
                </section>

                <section class='page-section' id='depth'>
                    <h2>Any depth</h2>
                    <p>
                        A component never names its level. The same menu opened on the page, inside a card or inside a
                        dialog lifts one step off whatever it opened in, and its hover and selected rows step from that.
                    </p>
                    ${preview({
                        node: html`
                            <div class='surfaces-modes'>
                                ${MODES.map((mode) => html`
                                    <div class='surfaces-mode' data-theme='${mode}' style='--surface-level: 0;'>
                                        <strong class='surfaces-mode-title'>${mode}</strong>
                                        <div class='surfaces-depths'>
                                            ${DEPTHS.map(({ label, wrap }) => html`
                                                <div class='surfaces-depth'>
                                                    <span class='surfaces-depth-label'>${label}</span>
                                                    ${wrap(menu())}
                                                </div>
                                            `)}
                                        </div>
                                    </div>
                                `)}
                            </div>
                        `
                    })}
                </section>

                <section class='page-section' id='usage'>
                    <h2>Usage</h2>
                    <p>
                        Components reach a level by extending a placeholder: <code>%surface-raised</code> and
                        <code>%surface-sunken</code> count and paint, their <code>-level</code> variants only count, and
                        <code>%surface-root</code> starts a fresh stack for dialogs.
                    </p>
                    ${preview({ code: { language: 'scss', value: SCSS }, title: 'menu.scss' })}
                </section>

                <section class='page-section' id='tokens'>
                    <h2>Tokens</h2>
                    <p>
                        Each surface sets these for its own level, so whatever sits inside reads its colors from the level it
                        shows. States follow the names components use: <code>default</code>, <code>hover</code>,
                        <code>active</code> and <code>pressed</code>.
                    </p>
                    <div class='card spec-table-scroll'><table class='spec-table'>
                        <thead class='spec-table-head'>
                            <tr>
                                <th class='spec-table-heading'>Token</th>
                                <th class='spec-table-heading'>Meaning</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${TOKENS.map(([name, meaning]) => html`
                                <tr class='spec-table-row'>
                                    <td class='spec-table-cell spec-name'>${name}</td>
                                    <td class='spec-table-cell'>${meaning}</td>
                                </tr>
                            `)}
                        </tbody>
                    </table></div>
                </section>
            </div>
        `,
        toc: TOC
    };
};


export default (r: Router) => r
    .get({ name: 'surfaces', path: '/surfaces', responder });
