import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
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

const CONTENT_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const FOCUSABLE = 'a[href], button:not([disabled])';

const NAVIGATION_MENU_POPUP = Symbol.for('@esportsplus/ui/navigation-menu.popup');

const NAVIGATION_MENU_TRIGGER = Symbol.for('@esportsplus/ui/navigation-menu.trigger');

// Short enough to feel immediate, long enough that sweeping past the bar doesn't flash a panel open.
const OPEN_INTENT = 50;

const SIDE_OFFSET = 8;

// How far the old and new content slide when the panel switches, in px.
const SLIDE = 32;


let uid = 0;


function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}


const navigationMenu = ({ align = 'start', items, label = 'Main', state, ...attributes }: A) => {
    let closeTimer: ReturnType<typeof setTimeout> | undefined,
        current = -1,
        hiding: Animation | undefined,
        id = `navigation-menu-${++uid}`,
        // True while the pointer is over the bar; the pill then follows it rather than the open trigger.
        inside = false,
        layers: (HTMLElement | undefined)[] = [],
        list: HTMLElement | undefined,
        nav: HTMLElement | undefined,
        observer: ResizeObserver | undefined,
        openTimer: ReturnType<typeof setTimeout> | undefined,
        pill: HTMLElement | undefined,
        popup: HTMLElement | undefined,
        running = new Map<HTMLElement, Animation>(),
        s = state ?? reactive({ active: -1 }),
        triggers: HTMLElement[] = [];

    function animate(element: HTMLElement, keyframes: Keyframe[], duration: number, easing = CONTENT_EASE) {
        running.get(element)?.cancel();

        let animation = element.animate(keyframes, { duration, easing });

        running.set(element, animation);

        return animation;
    }

    function close(refocus = false) {
        clearTimeout(openTimer);
        clearTimeout(closeTimer);

        let previous = current;

        if (previous === -1) {
            return;
        }

        current = -1;
        s.active = -1;
        hide();

        if (refocus) {
            triggers[previous]?.focus();
        }

        if (!inside) {
            settle();
        }
    }

    function focusables() {
        let layer = current === -1 ? undefined : layers[current];

        return layer ? [...layer.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
    }

    function hide() {
        let element = popup;

        if (!element) {
            return;
        }

        hiding?.cancel();

        let animation = element.animate(
            [{}, reduced() ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.96)' }],
            { duration: 160, easing: EASE_OUT, fill: 'forwards' }
        );

        hiding = animation;
        animation.finished.then(() => {
            element.classList.remove('--active');
            animation.cancel();

            for (let layer of layers) {
                if (layer) {
                    layer.classList.remove('--active', '--leaving');
                    layer.inert = true;
                }
            }
        }, () => {});
    }

    function open(index: number) {
        clearTimeout(openTimer);
        clearTimeout(closeTimer);

        let previous = current;

        if (previous === index || !layers[index]) {
            return;
        }

        current = index;
        s.active = index;
        swap(previous, index);
        place(previous === -1);

        if (!inside) {
            settle();
        }
    }

    // Moves the hover pill onto an item. A fresh pill appears in place instead of sliding in from where it last
    // left.
    function pillTo(item: HTMLElement) {
        if (!list || !pill) {
            return;
        }

        let bounds = list.getBoundingClientRect(),
            box = item.getBoundingClientRect(),
            element = pill,
            style = element.style;

        style.height = `${box.height}px`;
        style.top = `${box.top - bounds.top}px`;
        style.translate = `${box.left - bounds.left}px 0`;
        style.width = `${box.width}px`;

        if (!element.classList.contains('--active')) {
            element.getBoundingClientRect();
            element.classList.add('--active');
        }
    }

    function place(fresh: boolean) {
        if (!nav || !popup || current === -1) {
            return;
        }

        let layer = layers[current],
            trigger = triggers[current];

        if (!layer || !trigger) {
            return;
        }

        let box = trigger.getBoundingClientRect(),
            height = layer.offsetHeight,
            rect = nav.getBoundingClientRect(),
            viewport = document.documentElement.clientWidth,
            width = layer.offsetWidth,
            x = align === 'start'
                ? box.left
                : align === 'end'
                    ? box.right - width
                    : box.left + (box.width - width) / 2;

        x = Math.max(COLLISION_PADDING, Math.min(x, viewport - COLLISION_PADDING - width));

        let element = popup,
            style = element.style,
            update = () => {
                style.height = `${height}px`;
                // Grows out of the trigger it belongs to.
                style.transformOrigin = `${box.left + box.width / 2 - x}px ${-SIDE_OFFSET}px`;
                style.translate = `${x - rect.left}px ${box.bottom - rect.top + SIDE_OFFSET}px`;
                style.width = `${width}px`;
            };

        if (!fresh) {
            update();
            return;
        }

        hiding?.cancel();
        hiding = undefined;

        // Each open starts where it lands, so reopening never slides over from a stale spot.
        element.classList.add('--instant');
        update();
        element.getBoundingClientRect();
        element.classList.remove('--instant');
        element.classList.add('--active');

        if (reduced()) {
            animate(element, [{ opacity: 0 }, { opacity: 1 }], 160, EASE_OUT);
            return;
        }

        running.get(element)?.cancel();
        running.set(element, element.animate(
            [
                { opacity: 0, offset: 0, transform: 'perspective(600px) rotateX(-20deg) scale(0.94)' },
                { opacity: 1, offset: 0.53 },
                { opacity: 1, transform: 'none' }
            ],
            { duration: 300, easing: EASE_OUT }
        ));
    }

    // With the pointer gone, the pill rests on the open trigger, or fades out if nothing is open.
    function settle() {
        let trigger = current === -1 ? undefined : triggers[current];

        if (trigger) {
            pillTo(trigger);
        }
        else {
            pill?.classList.remove('--active');
        }
    }

    function swap(previous: number, next: number) {
        let dir = next > previous ? 1 : -1,
            incoming = layers[next],
            outgoing = previous === -1 ? undefined : layers[previous],
            reduce = reduced();

        for (let i = 0, n = layers.length; i < n; i++) {
            let layer = layers[i];

            if (!layer || layer === incoming || layer === outgoing) {
                continue;
            }

            running.get(layer)?.cancel();
            layer.classList.remove('--active', '--leaving');
            layer.inert = true;
        }

        if (outgoing) {
            let layer = outgoing;

            layer.classList.remove('--active');
            layer.classList.add('--leaving');
            layer.inert = true;
            animate(layer, [
                { opacity: 1, translate: '0 0' },
                { opacity: 0, translate: `${reduce ? 0 : -dir * SLIDE}px 0` }
            ], 200).onfinish = () => layer.classList.remove('--leaving');
        }

        if (!incoming) {
            return;
        }

        incoming.classList.remove('--leaving');
        incoming.classList.add('--active');
        incoming.inert = false;

        if (!outgoing) {
            running.get(incoming)?.cancel();
            return;
        }

        animate(incoming, [
            { opacity: 0, translate: `${reduce ? 0 : dir * SLIDE}px 0` },
            { opacity: 1, translate: '0 0' }
        ], 200);
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
        hiding?.cancel();
        observer?.disconnect();
        stop();

        for (let animation of running.values()) {
            animation.cancel();
        }
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
                    observer = new ResizeObserver(() => place(false));
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
            <ul
                class='navigation-menu-list'
                ${{
                    onpointerleave: () => {
                        inside = false;
                        settle();
                    },
                    onrender: (element: HTMLElement) => {
                        list = element;
                    }
                }}
            >
                <li aria-hidden='true' class='navigation-menu-pill' ${{ onrender: (element: HTMLElement) => { pill = element; } }}></li>
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
                                        onfocus: (e: FocusEvent) => {
                                            pillTo(e.currentTarget as HTMLElement);

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

                                            inside = true;
                                            pillTo(e.currentTarget as HTMLElement);
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
                                    <svg aria-hidden='true' class='navigation-menu-chevron' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
                                        <path d='m8 9 4-4 4 4M16 15l-4 4-4-4' />
                                    </svg>
                                </button>
                            `
                            : html`
                                <a
                                    class='navigation-menu-trigger navigation-menu-trigger--link'
                                    href='${item.href ?? '#'}'
                                    ${attributes[NAVIGATION_MENU_TRIGGER]}
                                    ${{
                                        onfocus: (e: FocusEvent) => pillTo(e.currentTarget as HTMLElement),
                                        onkeydown: (e: KeyboardEvent) => trigger(index, e),
                                        onpointerenter: (e: PointerEvent) => {
                                            if (e.pointerType === 'touch') {
                                                return;
                                            }

                                            inside = true;
                                            pillTo(e.currentTarget as HTMLElement);
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

            <div
                class='navigation-menu-popup'
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
                <div class='navigation-menu-viewport'>
                    ${items.map((item, index) => item.content && html`
                        <div
                            class='navigation-menu-content'
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


export default Object.assign(navigationMenu, { popup: NAVIGATION_MENU_POPUP, trigger: NAVIGATION_MENU_TRIGGER } as const);
export type { Align, Item, State };
