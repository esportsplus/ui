import { flush, onCleanup, reactive } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { bridge, chevron, guide, progress, working, type Progress } from '~/components/log';
import { logo, type Brand } from './brands';
import './scss/index.scss';


type Context = {
    revealed: () => number;
    total: number;
};

type Source = {
    brand?: Brand;
    domain: string;
    href?: string;
    icon?: Renderable<unknown>;
    title: string;
};

type Step = {
    brand?: Brand;
    dwell?: number;
    heading?: boolean;
    icon?: Renderable<unknown>;
    label: string;
    meta?: string;
    query?: string;
    sources?: Source[];
};


// The step lands, then its Sources row follows this much later.
const SOURCES_DELAY = 900;

// Stiffness 420, damping 36: settles in ~0.45s with a hair of overshoot.
const SPRING = 'linear(0, 0.04, 0.132, 0.249, 0.371, 0.488, 0.594, 0.684, 0.76, 0.822, 0.87, 0.908, 0.937, 0.958, 0.974, 0.985, 0.992, 0.997, 1, 1.002, 1.003, 1.003, 1.003, 1.002, 1.002, 1.001, 1)';

const SPRING_DURATION = 450;

const STACK_LIMIT = 6;

const STAGGER = 100;


function badge({ brand, icon }: Source) {
    if (icon) {
        return html`<span class='web-search-badge-icon' aria-hidden='true'>${icon}</span>`;
    }

    if (brand) {
        return logo(brand);
    }

    return html`<span class='web-search-badge-dot' aria-hidden='true'></span>`;
}

function content({ brand, icon, label, meta, query }: Step, active: () => boolean) {
    return html`
        <div class='web-search-step'>
            <span class='web-search-glyph' aria-hidden='true'>${brand ? logo(brand) : icon}</span>
            <div class='web-search-label'><span class='${() => active() && 'log-shimmer'}'>${label}</span>${query && html`<span class='web-search-query'>${query}</span>`}</div>
            ${meta && html`<span class='web-search-meta'>${meta}</span>`}
        </div>
    `;
}

function heading(context: Context, step: Step) {
    return html`
        <div class='log-unit web-search-heading ${() => context.revealed() > 0 && '--active'}' ${{ inert: () => context.revealed() === 0 }}>
            <div class='log-unit-content'>
                <div class='web-search-heading-content'>
                    ${content(step, () => context.revealed() === 1 && context.total > 1)}
                </div>
            </div>
        </div>
    `;
}

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function row(context: Context, step: Step, unit: number, next: number, sourcesUnit: number) {
    let active = () => {
        let revealed = context.revealed();

        return revealed > unit && revealed <= next && revealed < context.total;
    };

    return html`
        <li class='log-row log-unit web-search-row ${() => context.revealed() > unit && '--active'}' ${{ inert: () => context.revealed() <= unit }}>
            ${guide()}
            <div class='log-unit-content'>
                <div class='web-search-row-content'>
                    ${content(step, active)}
                    ${sourcesUnit !== -1 && sources(() => context.revealed() > sourcesUnit, step.sources!)}
                </div>
            </div>
        </li>
    `;
}

function sources(shown: () => boolean, list: Source[]) {
    let count = list.length,
        items: HTMLElement[] = [],
        marks: HTMLElement[] = [],
        stack = list.slice(0, STACK_LIMIT),
        state = reactive({ moved: 0, open: false }),
        timer: ReturnType<typeof setTimeout> | undefined;

    // Sources move one at a time: the last leaves the stack first, the first returns first.
    let listed = (index: number) => state.moved > count - 1 - index,
        stacked = () => {
            let n = 0;

            for (let i = 0, m = stack.length; i < m; i++) {
                if (!listed(i)) {
                    n++;
                }
            }

            return n;
        };

    function move(delta: 1 | -1) {
        let index = delta > 0 ? count - 1 - state.moved : count - state.moved,
            from = (delta > 0 ? marks : items)[index],
            rect = from?.getBoundingClientRect(),
            to = (delta > 0 ? items : marks)[index];

        state.moved += delta;

        if (!rect || !to || reduced()) {
            return;
        }

        flush();

        let target = to.getBoundingClientRect();

        to.animate(
            [
                { transform: `translate(${rect.left - target.left}px, ${rect.top - target.top}px)` },
                { transform: 'none' }
            ],
            { duration: SPRING_DURATION, easing: SPRING }
        );
    }

    function schedule() {
        let delta: 1 | -1 = state.open ? 1 : -1,
            next = state.moved + delta;

        if (next < 0 || next > count) {
            return;
        }

        timer = setTimeout(() => {
            move(delta);
            schedule();
        }, reduced() ? 0 : STAGGER);
    }

    onCleanup(() => clearTimeout(timer));

    return html`
        <div class='web-search-sources ${() => shown() && '--active'}'>
            ${bridge(shown, 5, 7)}
            <ul class='web-search-sources-list'>
                <li class='log-row log-unit ${() => shown() && '--active'}' ${{ inert: () => !shown() }}>
                    ${guide()}
                    <div class='log-unit-content'>
                        <div class='web-search-sources-content'>
                            <button
                                class='web-search-sources-toggle'
                                aria-expanded='${() => String(state.open)}'
                                type='button'
                                onclick='${() => {
                                    state.open = !state.open;
                                    clearTimeout(timer);
                                    schedule();
                                }}'
                            >
                                <span>Sources</span>
                                <span class='web-search-stack' style='${() => `width: ${stacked() > 0 ? 14 * stacked() + 6 : 0}px;`}'>
                                    ${stack.map((source, i) => html`
                                        <span
                                            class='web-search-mark ${() => listed(i) && '--hidden'}'
                                            style='--z: ${stack.length - i};'
                                            title='${source.title} · ${source.domain}'
                                            ${{ onconnect: (element: HTMLElement) => { marks[i] = element; } }}
                                        >
                                            ${badge(source)}
                                        </span>
                                    `)}
                                </span>
                                ${count > STACK_LIMIT && html`
                                    <span class='web-search-more ${() => state.moved !== 0 && '--hidden'}'>+${count - STACK_LIMIT}</span>
                                `}
                                ${chevron()}
                            </button>

                            <ul class='web-search-source-list'>
                                ${list.map((source, i) => {
                                    let inner = () => html`
                                        <span
                                            class='web-search-mark'
                                            style='--z: ${count - i};'
                                            ${{ onconnect: (element: HTMLElement) => { items[i] = element; } }}
                                        >
                                            ${badge(source)}
                                        </span>
                                        <span class='web-search-source-text'>
                                            <span class='web-search-source-title'>${source.title}</span>
                                            <span class='web-search-source-domain'>${source.domain}</span>
                                        </span>
                                    `;

                                    return html`
                                        <li class='web-search-source ${() => listed(i) && '--active'}' ${{ inert: () => !listed(i) }}>
                                            <div class='web-search-source-content'>
                                                ${source.href
                                                    ? html`<a class='web-search-source-link' href='${source.href}' rel='noreferrer' target='_blank'>${inner()}</a>`
                                                    : html`<div class='web-search-source-link'>${inner()}</div>`}
                                            </div>
                                        </li>
                                    `;
                                })}
                            </ul>
                        </div>
                    </div>
                </li>
            </ul>
        </div>
    `;
}


const webSearch = ({
    onComplete,
    startDelay = 320,
    state,
    stepInterval = 850,
    steps,
    working: label = 'Working',
    ...attributes
}: Attributes & {
    onComplete?: VoidFunction;
    startDelay?: number;
    state?: Progress;
    stepInterval?: number;
    steps: Step[];
    working?: false | string;
}) => {
    let head = steps[0]?.heading ? steps[0] : undefined,
        owners: number[] = [],
        sourcesAt: number[] = [],
        stepAt: number[] = [];

    // One unit per row, so a step that found sources is two: the step, then its Sources row.
    for (let i = 0, n = steps.length; i < n; i++) {
        stepAt.push(owners.length);
        owners.push(i);

        if (steps[i].sources?.length && !steps[i].heading) {
            sourcesAt.push(owners.length);
            owners.push(i);
        }
        else {
            sourcesAt.push(-1);
        }
    }

    let { revealed, start, total } = progress({
            delay: (index) => {
                if (index === 0) {
                    return startDelay;
                }

                let owner = owners[index - 1];

                if (owner === undefined) {
                    return stepInterval;
                }

                if (stepAt[owner] === index - 1 && sourcesAt[owner] !== -1) {
                    return SOURCES_DELAY;
                }

                return steps[owner].dwell ?? stepInterval;
            },
            onComplete,
            state,
            units: owners.length
        }),
        context: Context = { revealed, total },
        offset = head ? 1 : 0;

    return html`
        <div class='log web-search ${head && 'web-search--heading'}' ${attributes} ${{ onconnect: start }}>
            ${head && heading(context, head)}
            <div class='web-search-trail'>
                ${head && bridge(() => revealed() > 1, 6, 7)}
                <ul class='web-search-rows' aria-live='polite'>
                    ${steps.slice(offset).map((step, i) => row(context, step, stepAt[i + offset], stepAt[i + offset + 1] ?? Infinity, sourcesAt[i + offset]))}
                </ul>
            </div>
            ${label !== false && working(label, () => revealed() > 0 && revealed() < total)}
        </div>
    `;
};


export default webSearch;
export type { Brand, Source, Step };
