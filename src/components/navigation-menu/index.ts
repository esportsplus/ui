import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import highlight from '~/components/highlight';
import chevrons from '@esportsplus/ui/svg/chevrons-up-down.svg';
import '~/components/card/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    [NAVIGATION_MENU_POPUP]?: Attributes;
    [NAVIGATION_MENU_TRIGGER]?: Attributes;
    align?: Align;
    items: Item[];
    label?: string;
    state?: State;
};

type Align = 'center' | 'end' | 'start';

// With content it's a trigger that opens a panel; without, a plain link in the bar.
type Item = {
    content?: Renderable<unknown>;
    href?: string;
    label: string;
};

type State = {
    active: number;
};


// Grace before closing, so a cursor crossing the gap between the bar and the panel doesn't lose it.
const CLOSE_GRACE = 150;

// Keeps the panel this far from the viewport edges.
const COLLISION_PADDING = 16;

const FOCUSABLE = 'a[href], button:not([disabled])';

const NAVIGATION_MENU_POPUP = Symbol.for('@esportsplus/ui/navigation-menu.popup');

const NAVIGATION_MENU_TRIGGER = Symbol.for('@esportsplus/ui/navigation-menu.trigger');

// Short enough to feel immediate, long enough that sweeping past the bar doesn't flash a panel open.
const OPEN_INTENT = 50;

const SIDE_OFFSET = 8;


let uid = 0;


const navigationMenu = ({ align = 'start', items, label = 'Main', state, ...attributes }: A) => {
    let closeTimer: ReturnType<typeof setTimeout> | undefined,
        current = -1,
        id = `navigation-menu-${++uid}`,
        layers: (HTMLElement | undefined)[] = [],
        nav: HTMLElement | undefined,
        observer: ResizeObserver | undefined,
        openTimer: ReturnType<typeof setTimeout> | undefined,
        popup: HTMLElement | undefined,
        s = state ?? reactive({ active: -1 }),
        triggers: HTMLElement[] = [];

    function close(refocus = false) {
        clearTimeout(openTimer);
        clearTimeout(closeTimer);

        let previous = current;

        if (previous === -1) {
            return;
        }

        current = -1;
        s.active = -1;
        popup?.classList.remove('--active');

        if (refocus) {
            triggers[previous]?.focus();
        }

        // Stays shown while the panel fades out, but out of reach.
        let layer = layers[previous];

        if (layer) {
            layer.inert = true;
        }
    }

    function focusables() {
        let layer = current === -1 ? undefined : layers[current];

        return layer ? [...layer.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
    }

    function open(index: number) {
        clearTimeout(openTimer);
        clearTimeout(closeTimer);

        if (current === index || !layers[index] || !popup) {
            return;
        }

        let element = popup,
            fresh = current === -1;

        current = index;
        s.active = index;

        // Each open starts where it lands, so reopening never slides over from a stale spot.
        if (fresh) {
            element.classList.add('--instant');
        }

        select(index);
        place();

        if (fresh) {
            element.getBoundingClientRect();
            element.classList.remove('--instant');
            element.classList.add('--active');
        }
    }

    function place() {
        if (!nav || !popup || current === -1) {
            return;
        }

        let layer = layers[current],
            trigger = triggers[current];

        if (!layer || !trigger) {
            return;
        }

        let box = trigger.getBoundingClientRect(),
            rect = nav.getBoundingClientRect(),
            style = popup.style,
            viewport = document.documentElement.clientWidth,
            width = layer.offsetWidth,
            x = align === 'start'
                ? box.left
                : align === 'end'
                    ? box.right - width
                    : box.left + (box.width - width) / 2;

        x = Math.max(COLLISION_PADDING, Math.min(x, viewport - COLLISION_PADDING - width));

        style.setProperty('--morph-height', `${layer.offsetHeight}px`);
        style.setProperty('--morph-width', `${width}px`);
        // Grows out of the trigger it belongs to.
        style.transformOrigin = `${box.left + box.width / 2 - x}px ${-SIDE_OFFSET}px`;
        style.translate = `${x - rect.left}px ${box.bottom - rect.top + SIDE_OFFSET}px`;
    }

    function select(index: number) {
        for (let i = 0, n = layers.length; i < n; i++) {
            let layer = layers[i];

            if (!layer) {
                continue;
            }

            layer.classList.toggle('--active', i === index);
            layer.classList.toggle('--before', i < index);
            layer.inert = i !== index;
        }
    }

    function trigger(index: number, e: KeyboardEvent) {
        let key = e.key;

        if (key === 'ArrowDown' && layers[index]) {
            e.preventDefault();
            open(index);
            focusables()[0]?.focus();
        }
        else if (key === 'ArrowLeft' || key === 'ArrowRight') {
            let n = triggers.length;

            e.preventDefault();
            triggers[(index + (key === 'ArrowRight' ? 1 : -1) + n) % n]?.focus();
        }
        else if (key === 'Escape' && current !== -1) {
            e.preventDefault();
            close();
        }
        else if (key === 'Tab' && !e.shiftKey && current === index) {
            // The panel sits after the whole list in the DOM; Tab goes into it from its own trigger, as if it
            // followed the trigger directly.
            let first = focusables()[0];

            if (first) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    // Returns nothing on purpose: an effect's value is a dependency of whatever renders this menu, so returning the
    // active index would re-render that parent on every open.
    let stop = effect(() => {
        let active = s.active;

        untrack(() => {
            if (active === current) {
                return;
            }

            if (active === -1) {
                close();
            }
            else {
                open(active);
            }
        });
    });

    onCleanup(() => {
        clearTimeout(closeTimer);
        clearTimeout(openTimer);
        observer?.disconnect();
        stop();
    });

    return html`
        <nav
            class='navigation-menu'
            ${attributes}
            ${{
                'aria-label': label,
                ondocumentpointerdown: (e: PointerEvent) => {
                    // Taps outside close it on touch, where there's no pointer to leave.
                    if (current !== -1 && nav && !nav.contains(e.target as Node | null)) {
                        close();
                    }
                },
                onconnect: (element: HTMLElement) => {
                    nav = element;
                    observer = new ResizeObserver(place);
                    observer.observe(element);

                    for (let layer of layers) {
                        if (layer) {
                            observer.observe(layer);
                        }
                    }
                },
                onfocusout: (e: FocusEvent) => {
                    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
                        close();
                    }
                },
                onpointerenter: (e: PointerEvent) => {
                    if (e.pointerType !== 'touch') {
                        clearTimeout(closeTimer);
                    }
                },
                onpointerleave: (e: PointerEvent) => {
                    if (e.pointerType === 'touch') {
                        return;
                    }

                    clearTimeout(openTimer);

                    if (current !== -1) {
                        clearTimeout(closeTimer);
                        closeTimer = setTimeout(() => close(), CLOSE_GRACE);
                    }
                }
            }}
        >
            <div class='navigation-menu-bar'>
                ${highlight({ class: 'navigation-menu-highlight', target: '.navigation-menu-trigger' })}
                <ul class='navigation-menu-list'>
                    ${items.map((item, index) => html`
                        <li class='navigation-menu-item'>
                            ${item.content
                                ? html`
                                    <button
                                        class='navigation-menu-trigger'
                                        type='button'
                                        ${attributes[NAVIGATION_MENU_TRIGGER]}
                                        ${{
                                            'aria-controls': () => s.active === index && `${id}-popup`,
                                            'aria-expanded': () => String(s.active === index),
                                            class: () => s.active === index && '--active',
                                            onclick: (e: MouseEvent) => {
                                                // detail is 0 for Enter and Space; those toggle, like a tap.
                                                if (current === index && (e.detail === 0 || (e as PointerEvent).pointerType === 'touch')) {
                                                    close();
                                                }
                                                else {
                                                    open(index);
                                                }
                                            },
                                            onfocus: () => {
                                                // With a panel open, focus moving along the list moves it too.
                                                if (current !== -1 && current !== index) {
                                                    open(index);
                                                }
                                            },
                                            onkeydown: (e: KeyboardEvent) => trigger(index, e),
                                            onpointerenter: (e: PointerEvent) => {
                                                if (e.pointerType === 'touch') {
                                                    return;
                                                }

                                                clearTimeout(openTimer);

                                                // Already open: follow the cursor at once. Closed: wait a beat to be sure it means it.
                                                if (current !== -1) {
                                                    open(index);
                                                }
                                                else {
                                                    openTimer = setTimeout(() => open(index), OPEN_INTENT);
                                                }
                                            },
                                            onpointerleave: () => {
                                                if (current === -1) {
                                                    clearTimeout(openTimer);
                                                }
                                            },
                                            onrender: (element: HTMLElement) => {
                                                triggers[index] = element;
                                            }
                                        }}
                                    >
                                        ${item.label}
                                        <svg aria-hidden='true' class='navigation-menu-chevron'><use href='#${chevrons}' /></svg>
                                    </button>
                                `
                                : html`
                                    <a
                                        class='navigation-menu-trigger navigation-menu-trigger--link'
                                        href='${item.href ?? '#'}'
                                        ${attributes[NAVIGATION_MENU_TRIGGER]}
                                        ${{
                                            onkeydown: (e: KeyboardEvent) => trigger(index, e),
                                            onpointerenter: (e: PointerEvent) => {
                                                if (e.pointerType === 'touch') {
                                                    return;
                                                }

                                                clearTimeout(openTimer);

                                                // A plain link has no panel; the open one belongs to someone else.
                                                if (current !== -1) {
                                                    clearTimeout(closeTimer);
                                                    closeTimer = setTimeout(() => close(), CLOSE_GRACE);
                                                }
                                            },
                                            onrender: (element: HTMLElement) => {
                                                triggers[index] = element;
                                            }
                                        }}
                                    >
                                        ${item.label}
                                    </a>
                                `}
                        </li>
                    `)}
                </ul>
            </div>

            <div
                class='card card--morph navigation-menu-popup'
                id='${id}-popup'
                ${attributes[NAVIGATION_MENU_POPUP]}
                ${{
                    onclick: (e: MouseEvent) => {
                        if ((e.target as HTMLElement).closest('a')) {
                            close();
                        }
                    },
                    onkeydown: (e: KeyboardEvent) => {
                        if (current === -1) {
                            return;
                        }

                        let list = focusables(),
                            at = list.indexOf(document.activeElement as HTMLElement),
                            key = e.key;

                        if (key === 'Escape') {
                            e.preventDefault();
                            close(true);
                        }
                        else if (key === 'ArrowDown' || key === 'ArrowUp') {
                            let n = list.length;

                            e.preventDefault();
                            list[(at + (key === 'ArrowDown' ? 1 : -1) + n) % n]?.focus();
                        }
                        else if (key === 'Tab' && e.shiftKey && at === 0) {
                            e.preventDefault();
                            triggers[current]?.focus();
                        }
                        else if (key === 'Tab' && !e.shiftKey && at === list.length - 1) {
                            let next = triggers[current + 1];

                            // Closed first, so focus landing on the next trigger doesn't open its panel.
                            close();

                            if (next) {
                                e.preventDefault();
                                next.focus();
                            }
                        }
                    },
                    onrender: (element: HTMLElement) => {
                        popup = element;
                    }
                }}
            >
                <div class='card-morph-viewport'>
                    ${items.map((item, index) => item.content && html`
                        <div
                            class='card-morph-layer navigation-menu-content'
                            ${{
                                onrender: (element: HTMLElement) => {
                                    element.inert = true;
                                    layers[index] = element;
                                }
                            }}
                        >
                            ${item.content}
                        </div>
                    `)}
                </div>
            </div>
        </nav>
    `;
};


export default component(navigationMenu, { popup: NAVIGATION_MENU_POPUP, trigger: NAVIGATION_MENU_TRIGGER });
export type { Align, Item, State };
