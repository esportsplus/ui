import { component, html, on, type Attributes, type Element } from '@esportsplus/template';
import { onCleanup, reactive } from '@esportsplus/reactivity';
import tooltip from '~/components/tooltip';
import chevron from '@esportsplus/ui/svg/chevron-right.svg';
import dots from '@esportsplus/ui/svg/dots.svg';
import folder from '@esportsplus/ui/svg/folder.svg';
import slash from '@esportsplus/ui/svg/slash.svg';
import './scss/index.scss';


type A = Attributes & {
    [BREADCRUMB_LINK]?: Attributes;
    [BREADCRUMB_MENU]?: Attributes;
    items: Crumb[];
    label?: string;
    onnavigate?: (item: Crumb, index: number) => void;
    separator?: Separator;
    state?: State;
};

type Crumb = {
    href: string;
    label: string;
};

type Separator = 'chevron' | 'slash';

type State = {
    active: boolean;
    hidden: number;
};


const BREADCRUMB_LINK = Symbol.for('@esportsplus/ui/breadcrumb.link');

const BREADCRUMB_MENU = Symbol.for('@esportsplus/ui/breadcrumb.menu');

const SEPARATORS: Record<Separator, string> = { chevron, slash };


let uid = 0;


function separator(kind: Separator) {
    return html`
        <svg aria-hidden='true' class='breadcrumb-separator'><use href='#${SEPARATORS[kind]}' /></svg>
    `;
}


/*
 * Fitting works off a hidden copy of the full trail, so the widths never depend on what is currently folded
 * and the decision can't oscillate. The first segment and the current page always stay; middle segments fold
 * into the menu from the left, so the nearest parents stay visible longest.
 */
const breadcrumb = ({ items, label = 'Breadcrumb', onnavigate, separator: kind = 'slash', state, ...attributes }: A) => {
    let id = `breadcrumb-${++uid}`,
        last = items.length - 1,
        observer: ResizeObserver | undefined,
        root: HTMLElement | undefined,
        ruler: HTMLElement | undefined,
        s = state ?? reactive({ active: false, hidden: 0 }),
        view = reactive({ instant: true });

    function fit() {
        if (!root || !ruler) {
            return;
        }

        let widths: number[] = [];

        for (let child of ruler.children) {
            widths.push(child.getBoundingClientRect().width);
        }

        let space = widths.pop() ?? 0,
            available = root.clientWidth,
            n = widths.length,
            next = Math.max(n - 1, 1),
            tail = 0;

        for (let i = 1; i < n; i++) {
            tail += widths[i];
        }

        for (let k = 1; k < n; k++) {
            // Half a pixel of slack absorbs subpixel rounding between the ruler and the live row.
            if (widths[0] + (k > 1 ? space : 0) + tail <= available + 0.5) {
                next = k;
                break;
            }

            tail -= widths[k];
        }

        next = Math.min(next, Math.max(last, 1));

        if (next === s.hidden + 1) {
            return;
        }

        s.hidden = next - 1;

        if (next <= 1) {
            s.active = false;
        }
    }

    // Bound on the anchor itself rather than delegated, so the default is prevented before any router
    // listening on the document sees the click.
    function navigate(e: MouseEvent, item: Crumb, index: number) {
        if (!onnavigate) {
            return;
        }

        e.preventDefault();
        onnavigate(item, index);
    }

    onCleanup(() => observer?.disconnect());

    return html`
        <nav
            class='breadcrumb'
            ${attributes}
            ${{
                'aria-label': label,
                class: () => view.instant && 'breadcrumb--instant',
                onconnect: (element: HTMLElement) => {
                    root = element;
                    fit();

                    // Also catches webfonts landing late, since they resize the ruler.
                    observer = new ResizeObserver(fit);
                    observer.observe(element);

                    if (ruler) {
                        observer.observe(ruler);
                    }
                },
                // The first fit lands after the trail has been styled once, so 'breadcrumb--instant' holds until that
                // fit has painted or it would play the fold.
                onfirstpaint: () => {
                    view.instant = false;
                }
            }}
        >
            <ol
                aria-hidden='true'
                class='breadcrumb-ruler'
                inert
                ${{ onconnect: (element: HTMLElement) => { ruler = element; } }}
            >
                ${items.map((item, index) => html`
                    <li class='breadcrumb-segment'>
                        ${index > 0 && separator(kind)}
                        <span class='breadcrumb-text ${index === last && 'breadcrumb-text--current'}'>${item.label}</span>
                    </li>
                `)}
                <li class='breadcrumb-segment'>
                    ${separator(kind)}
                    <span class='breadcrumb-space'></span>
                </li>
            </ol>

            <ol class='breadcrumb-list'>
                ${items.map((item, index) => html`
                    <li class='breadcrumb-segment ${index === last && 'breadcrumb-segment--current'} ${() => index > 0 && index < last && index <= s.hidden && 'breadcrumb-segment--hidden'}'>
                        <div class='breadcrumb-segment-body'>
                            ${index > 0 && separator(kind)}
                            ${index === last
                                ? html`<span aria-current='page' class='breadcrumb-current'>${item.label}</span>`
                                : html`
                                    <a
                                        class='breadcrumb-link'
                                        href='${item.href}'
                                        ${attributes[BREADCRUMB_LINK]}
                                        ${{
                                            onconnect: (element: Element) => {
                                                on(element, 'click', (e) => navigate(e, item, index));
                                            }
                                        }}
                                    >
                                        ${item.label}
                                    </a>
                                `}
                        </div>
                    </li>
                    ${index === 0 && html`
                        <li class='breadcrumb-segment breadcrumb-fold ${() => s.hidden <= 0 && 'breadcrumb-segment--hidden'}'>
                            <div class='breadcrumb-segment-body'>
                                ${separator(kind)}
                                ${tooltip.menu(
                                    {
                                        class: 'breadcrumb-menu-root',
                                        options: items.slice(1, last).map((item, i) => ({
                                            content: html`
                                                <svg aria-hidden='true'><use href='#${folder}' /></svg>
                                                <span>${item.label}</span>
                                            `,
                                            hidden: () => i >= s.hidden,
                                            href: item.href,
                                            onconnect: (element: Element) => {
                                                on(element, 'click', (e) => navigate(e, item, i + 1));
                                            },
                                            target: '_self'
                                        })),
                                        state: s,
                                        toggle: true,
                                        [tooltip.menu.option]: { class: 'breadcrumb-option' },
                                        [tooltip.menu.tooltipContent]: {
                                            ...attributes[BREADCRUMB_MENU],
                                            'aria-label': 'Hidden folders',
                                            class: ['breadcrumb-menu', attributes[BREADCRUMB_MENU]?.class ?? []].flat(),
                                            direction: 'sw',
                                            id: `${id}-menu`
                                        }
                                    },
                                    html`
                                        <button
                                            aria-haspopup='menu'
                                            class='breadcrumb-trigger'
                                            type='button'
                                            ${{
                                                'aria-controls': `${id}-menu`,
                                                'aria-expanded': () => String(s.active),
                                                'aria-label': () => `Show ${s.hidden} hidden ${s.hidden === 1 ? 'folder' : 'folders'}`
                                            }}
                                        >
                                            <svg aria-hidden='true'><use href='#${dots}' /></svg>
                                        </button>
                                    `
                                )}
                            </div>
                        </li>
                    `}
                `)}
            </ol>
        </nav>
    `;
};


export default component(breadcrumb, { link: BREADCRUMB_LINK, menu: BREADCRUMB_MENU });
export type { Crumb, Separator, State };
