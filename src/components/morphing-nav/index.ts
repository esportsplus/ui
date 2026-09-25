import { html, on, type Attributes, type Element, type Renderable } from '@esportsplus/template';
import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type A = Attributes & {
    [MORPHING_NAV_LINK]?: Attributes;
    [MORPHING_NAV_PANEL]?: Attributes;
    [MORPHING_NAV_TRIGGER]?: Attributes;
    action?: Renderable<unknown>;
    brand?: Renderable<unknown>;
    label?: string;
    onnavigate?: (link: Link, section: Section) => void;
    sections: Section[];
    state?: State;
};

type Link = {
    description: string;
    href?: string;
    icon: Renderable<unknown>;
    title: string;
};

type Section = {
    columns?: 1 | 2;
    label: string;
    links: Link[];
};

type State = {
    active: number;
};


const CARET = 16;

// Keeps the caret off the panel's rounded corners.
const CARET_INSET = 12;

// Grace before closing, so a cursor that clips the edge on its way into the panel doesn't lose it.
const CLOSE_GRACE = 180;

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const MORPHING_NAV_LINK = Symbol.for('@esportsplus/ui/morphing-nav.link');

const MORPHING_NAV_PANEL = Symbol.for('@esportsplus/ui/morphing-nav.panel');

const MORPHING_NAV_TRIGGER = Symbol.for('@esportsplus/ui/morphing-nav.trigger');

// Long enough that sweeping across the bar on the way elsewhere doesn't flash a panel open, short enough to feel immediate.
const OPEN_INTENT = 80;

// How far the old and new content slide during a morph, in px.
const SLIDE = 48;


let uid = 0;


function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}


const morphingNav = ({ action, brand, label = 'Main', onnavigate, sections, state, ...attributes }: A) => {
    let after: HTMLElement | undefined,
        closeTimer: ReturnType<typeof setTimeout> | undefined,
        current = -1,
        id = `morphing-nav-${++uid}`,
        layers: HTMLElement[] = [],
        nav: HTMLElement | undefined,
        observer: ResizeObserver | undefined,
        openTimer: ReturnType<typeof setTimeout> | undefined,
        panel: HTMLElement | undefined,
        popover: HTMLElement | undefined,
        running = new Map<HTMLElement, Animation>(),
        s = state ?? reactive({ active: -1 }),
        triggers: HTMLElement[] = [];

    function animate(layer: HTMLElement, keyframes: Keyframe[], duration: number) {
        running.get(layer)?.cancel();
        running.set(layer, layer.animate(keyframes, { duration, easing: EASE_OUT }));
    }

    function center(index: number) {
        let box = triggers[index]?.getBoundingClientRect(),
            rect = nav?.getBoundingClientRect();

        return box && rect ? box.left - rect.left + box.width / 2 : 0;
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
        popover?.classList.remove('--active');

        if (refocus) {
            triggers[previous]?.focus();
        }
    }

    // Only the incoming section: during a morph the outgoing one is still visible, and keyboard focus must
    // never land on links that are leaving.
    function links() {
        return current === -1 ? [] : [...(layers[current]?.querySelectorAll<HTMLElement>('a') ?? [])];
    }

    function open(index: number) {
        clearTimeout(openTimer);
        clearTimeout(closeTimer);

        let previous = current;

        if (previous === index || !sections[index]) {
            return;
        }

        current = index;
        s.active = index;
        swap(previous, index);
        place(previous === -1);
    }

    function place(fresh: boolean) {
        if (!nav || !panel || !popover || current === -1) {
            return;
        }

        let layer = layers[current],
            max = nav.offsetWidth;

        panel.style.setProperty('--nav-width', `${max}px`);

        let middle = center(current),
            width = Math.min(layer.offsetWidth, max),
            x = Math.max(0, Math.min(middle - width / 2, max - width)),
            caret = Math.max(CARET_INSET, Math.min(middle - x - CARET / 2, width - CARET - CARET_INSET)),
            element = popover,
            style = element.style,
            update = () => {
                style.height = `${layer.offsetHeight}px`;
                style.setProperty('--caret-x', `${caret}px`);
                // Grows out of the caret, which points at the trigger.
                style.transformOrigin = `${caret + CARET / 2}px 0`;
                style.translate = `${x}px 0`;
                style.width = `${width}px`;
            };

        if (!fresh) {
            update();
            return;
        }

        // Each open starts where it lands, so reopening never morphs from a stale spot.
        element.classList.add('--opening');
        update();
        element.getBoundingClientRect();
        element.classList.remove('--opening');
        element.classList.add('--active');
    }

    function swap(previous: number, next: number) {
        let dir = next > previous ? 1 : -1,
            incoming = layers[next],
            outgoing = previous === -1 ? undefined : layers[previous],
            reduce = reduced();

        for (let i = 0, n = layers.length; i < n; i++) {
            let layer = layers[i];

            if (layer === incoming || layer === outgoing) {
                continue;
            }

            running.get(layer)?.cancel();
            layer.classList.remove('--active');
            layer.inert = true;
        }

        if (outgoing) {
            outgoing.classList.remove('--active');
            outgoing.inert = true;
            animate(outgoing, reduce
                ? [{ opacity: 1, visibility: 'visible' }, { opacity: 0, visibility: 'visible' }]
                : [
                    { filter: 'blur(0px)', opacity: 1, translate: '0 0', visibility: 'visible' },
                    { filter: 'blur(4px)', opacity: 0, translate: `${-dir * SLIDE}px 0`, visibility: 'visible' }
                ], reduce ? 150 : 180);
        }

        if (!incoming) {
            return;
        }

        incoming.classList.add('--active');
        incoming.inert = false;

        if (!outgoing) {
            running.get(incoming)?.cancel();
            return;
        }

        animate(incoming, reduce
            ? [{ opacity: 0 }, { opacity: 1 }]
            : [
                { filter: 'blur(4px)', opacity: 0, translate: `${dir * SLIDE}px 0` },
                { filter: 'blur(0px)', opacity: 1, translate: '0 0' }
            ], reduce ? 200 : 250);
    }

    function trigger(index: number, e: KeyboardEvent) {
        let key = e.key;

        if (key === 'ArrowDown') {
            e.preventDefault();
            open(index);
            links()[0]?.focus();
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
            // The panel sits after the whole bar in the DOM; Tab goes into it from its own trigger, as if it
            // followed the trigger directly.
            let first = links()[0];

            if (first) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    let stop = effect(() => s.active, (active) => {
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

    onCleanup(() => {
        clearTimeout(closeTimer);
        clearTimeout(openTimer);
        observer?.disconnect();
        stop();

        for (let animation of running.values()) {
            animation.cancel();
        }
    });

    return html`
        <nav
            class='morphing-nav'
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
            <div class='morphing-nav-bar'>
                ${brand && html`<div class='morphing-nav-brand'>${brand}</div>`}
                <ul class='morphing-nav-list'>
                    ${sections.map((section, index) => html`
                        <li>
                            <button
                                class='morphing-nav-trigger'
                                type='button'
                                ${attributes[MORPHING_NAV_TRIGGER]}
                                ${{
                                    'aria-controls': () => s.active === index && `${id}-panel`,
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
                                        // With the panel open, focus moving along the bar moves it too.
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
                                ${section.label}
                                <svg aria-hidden='true' class='morphing-nav-chevron' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 12 12'>
                                    <path d='m3 4.75 3 3 3-3' />
                                </svg>
                            </button>
                        </li>
                    `)}
                </ul>
                ${action && html`
                    <div class='morphing-nav-action' ${{ onrender: (element: HTMLElement) => { after = element; } }}>
                        ${action}
                    </div>
                `}
            </div>

            <div class='morphing-nav-popover' ${{ onrender: (element: HTMLElement) => { popover = element; } }}>
                <div aria-hidden='true' class='morphing-nav-bridge'></div>
                <svg aria-hidden='true' class='morphing-nav-caret' height='9' viewBox='0 0 16 9' width='16'>
                    <path d='M0 9 8 1l8 8' stroke-width='1' />
                </svg>
                <div
                    class='morphing-nav-panel'
                    id='${id}-panel'
                    ${attributes[MORPHING_NAV_PANEL]}
                    ${{
                        onkeydown: (e: KeyboardEvent) => {
                            if (current === -1) {
                                return;
                            }

                            let list = links(),
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
                                let next = triggers[current + 1],
                                    target = after?.querySelector<HTMLElement>('a, button');

                                if (next) {
                                    e.preventDefault();
                                    next.focus();
                                }
                                else if (target) {
                                    e.preventDefault();
                                    close();
                                    target.focus();
                                }
                                else {
                                    close();
                                }
                            }
                        },
                        onrender: (element: HTMLElement) => {
                            panel = element;
                        }
                    }}
                >
                    ${sections.map((section, index) => html`
                        <div
                            class='morphing-nav-section ${section.columns === 2 && 'morphing-nav-section--columns'}'
                            data-section='${index}'
                            ${{
                                onrender: (element: HTMLElement) => {
                                    element.inert = true;
                                    layers[index] = element;
                                }
                            }}
                        >
                            <ul class='morphing-nav-links'>
                                ${section.links.map((link) => html`
                                    <li>
                                        <a
                                            class='morphing-nav-link'
                                            href='${link.href ?? '#'}'
                                            ${attributes[MORPHING_NAV_LINK]}
                                            ${{
                                                onclick: () => close(),
                                                // Bound on the anchor itself rather than delegated, so the default is
                                                // prevented before any router listening on the document sees the click.
                                                onrender: (element: Element) => {
                                                    on(element, 'click', (e) => {
                                                        if (onnavigate) {
                                                            e.preventDefault();
                                                            onnavigate(link, section);
                                                        }
                                                        else if (!link.href) {
                                                            e.preventDefault();
                                                        }
                                                    });
                                                }
                                            }}
                                        >
                                            <span class='morphing-nav-icon'>${link.icon}</span>
                                            <span class='morphing-nav-text'>
                                                <span class='morphing-nav-title'>${link.title}</span>
                                                <span class='morphing-nav-description'>${link.description}</span>
                                            </span>
                                        </a>
                                    </li>
                                `)}
                            </ul>
                        </div>
                    `)}
                </div>
            </div>
        </nav>
    `;
};


export default Object.assign(morphingNav, { link: MORPHING_NAV_LINK, panel: MORPHING_NAV_PANEL, trigger: MORPHING_NAV_TRIGGER } as const);
export type { Link, Section, State };
