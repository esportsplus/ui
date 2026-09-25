import { html, on, type Attributes, type Element } from '@esportsplus/template';
import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import tooltip from '~/components/tooltip';
import './scss/index.scss';


type A = Attributes & {
    [BREADCRUMBS_LINK]?: Attributes;
    [BREADCRUMBS_MENU]?: Attributes;
    items: Crumb[];
    label?: string;
    onnavigate?: (item: Crumb, index: number) => void;
    state?: State;
};

type Crumb = {
    href: string;
    label: string;
};

type State = {
    active: boolean;
    hidden: number;
};


const BREADCRUMBS_LINK = Symbol.for('@esportsplus/ui/breadcrumbs.link');

const BREADCRUMBS_MENU = Symbol.for('@esportsplus/ui/breadcrumbs.menu');

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

// Arriving segments fade in slower than leaving ones fade out, so the gap a leaving one opens is already
// closing by the time the eye looks for it.
const ENTER = 200;

const EXIT = 120;

const SLIDE = 310;

// Critically damped (no bounce) spring: a trail that overshoots reads as unstable.
const SPRING = 'linear(0, 0.0432 4.2%, 0.1402 8.3%, 0.2575 12.5%, 0.3764 16.7%, 0.4867 20.8%, 0.584 25%, 0.667 29.2%, 0.7361 33.3%, 0.7925 37.5%, 0.838 41.7%, 0.8743 45.8%, 0.9029 50%, 0.9254 54.2%, 0.9428 58.3%, 0.9564 62.5%, 0.9668 66.7%, 0.9748 70.8%, 0.9809 75%, 0.9856 79.2%, 0.9892 83.3%, 0.9918 87.5%, 0.9939 91.7%, 0.9954 95.8%, 1)';


let uid = 0;


function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function separator() {
    return html`
        <svg aria-hidden='true' class='breadcrumbs-separator' fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='1.5' viewBox='0 0 16 16'>
            <path d='M10 3 6 13' />
        </svg>
    `;
}


/*
 * Fitting works off a hidden copy of the full trail, so the widths never depend on what is currently folded
 * and the decision can't oscillate. The first segment and the current page always stay; middle segments fold
 * into the menu from the left, so the nearest parents stay visible longest.
 */
const breadcrumbs = ({ items, label = 'Breadcrumb', onnavigate, state, ...attributes }: A) => {
    let alive = true,
        exiting = new Map<HTMLElement, VoidFunction>(),
        fold: HTMLElement | undefined,
        folded = 1,
        id = `breadcrumbs-${++uid}`,
        keyboard = false,
        last = items.length - 1,
        list: HTMLElement | undefined,
        menu: HTMLElement | undefined,
        options: HTMLElement[] = [],
        observer: ResizeObserver | undefined,
        root: HTMLElement | undefined,
        ruler: HTMLElement | undefined,
        s = state ?? reactive({ active: false, hidden: 0 }),
        segments: HTMLElement[] = [],
        slides = new Map<HTMLElement, Animation>(),
        trigger: HTMLElement | undefined;

    function apply(next: number, animate: boolean) {
        if (!list || !fold) {
            return;
        }

        for (let cleanup of [...exiting.values()]) {
            cleanup();
        }

        let base = list.getBoundingClientRect(),
            before = new Map<HTMLElement, DOMRect>(),
            elements = [segments[0], fold, ...segments.slice(1)],
            reduce = reduced();

        for (let i = 0, n = elements.length; i < n; i++) {
            let element = elements[i];

            if (element && !element.classList.contains('--hidden')) {
                before.set(element, element.getBoundingClientRect());
            }
        }

        for (let animation of slides.values()) {
            animation.cancel();
        }

        slides.clear();
        folded = next;
        s.hidden = next - 1;

        if (next <= 1) {
            s.active = false;
        }

        for (let i = 1; i < last; i++) {
            segments[i]?.classList.toggle('--hidden', i < next);
        }

        fold.classList.toggle('--hidden', next <= 1);

        if (!animate) {
            return;
        }

        for (let i = 0, n = elements.length; i < n; i++) {
            let element = elements[i];

            if (!element) {
                continue;
            }

            let shown = !element.classList.contains('--hidden'),
                was = before.get(element);

            if (was && shown) {
                let dx = was.left - element.getBoundingClientRect().left;

                if (dx && !reduce) {
                    slides.set(element, element.animate([{ translate: `${dx}px 0` }, { translate: '0 0' }], { duration: SLIDE, easing: SPRING }));
                }
            }
            else if (shown) {
                element.animate([
                    { filter: reduce ? 'blur(0px)' : 'blur(4px)', opacity: 0 },
                    { filter: 'blur(0px)', opacity: 1 }
                ], { duration: ENTER, easing: EASE_OUT });
            }
            else if (was) {
                exit(element, was, base);
            }
        }
    }

    function close(refocus: boolean) {
        s.active = false;

        if (refocus) {
            trigger?.focus({ preventScroll: true });
        }
    }

    // Pops the leaving segment out of the flow where it stood, so the rest close the gap while it fades.
    function exit(element: HTMLElement, rect: DOMRect, base: DOMRect) {
        let style = element.style;

        element.classList.remove('--hidden');
        style.left = `${rect.left - base.left}px`;
        style.pointerEvents = 'none';
        style.position = 'absolute';
        style.top = `${rect.top - base.top}px`;

        let animation = element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: EXIT, easing: EASE_OUT, fill: 'forwards' }),
            cleanup = () => {
                animation.cancel();
                exiting.delete(element);
                element.classList.add('--hidden');
                style.removeProperty('left');
                style.removeProperty('pointer-events');
                style.removeProperty('position');
                style.removeProperty('top');
            };

        animation.onfinish = cleanup;
        exiting.set(element, cleanup);
    }

    function fit(animate: boolean) {
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

        if (next !== folded) {
            apply(next, animate);
        }
    }

    function focus(index: number) {
        let visible = options.slice(0, s.hidden),
            n = visible.length;

        visible[((index % n) + n) % n]?.focus({ preventScroll: true });
    }

    function move(step: number) {
        let at = options.indexOf(document.activeElement as HTMLElement);

        focus(at === -1 ? (step > 0 ? 0 : -1) : at + step);
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

    let stop = effect(() => s.active, (active) => {
        if (!menu) {
            return;
        }

        menu.inert = !active;

        if (!active) {
            return;
        }

        // Keyboard and assistive tech opens want the first item; pointer opens focus the menu itself.
        if (keyboard) {
            focus(0);
        }
        else {
            menu.focus({ preventScroll: true });
        }
    });

    onCleanup(() => {
        alive = false;
        observer?.disconnect();
        stop();

        for (let cleanup of [...exiting.values()]) {
            cleanup();
        }
    });

    return html`
        <nav
            class='breadcrumbs'
            ${attributes}
            ${{
                'aria-label': label,
                onconnect: (element: HTMLElement) => {
                    root = element;
                    fit(false);

                    observer = new ResizeObserver(() => fit(true));
                    observer.observe(element);

                    if (ruler) {
                        observer.observe(ruler);
                    }

                    // Webfonts can land after the first measure and change every width.
                    void document.fonts?.ready.then(() => {
                        if (alive) {
                            fit(true);
                        }
                    });
                }
            }}
        >
            <ol
                aria-hidden='true'
                class='breadcrumbs-ruler'
                inert
                ${{ onrender: (element: HTMLElement) => { ruler = element; } }}
            >
                ${items.map((item, index) => html`
                    <li class='breadcrumbs-segment'>
                        ${index > 0 && separator()}
                        <span class='breadcrumbs-text ${index === last && 'breadcrumbs-text--current'}'>${item.label}</span>
                    </li>
                `)}
                <li class='breadcrumbs-segment'>
                    ${separator()}
                    <span class='breadcrumbs-space'></span>
                </li>
            </ol>

            <ol class='breadcrumbs-list' ${{ onrender: (element: HTMLElement) => { list = element; } }}>
                ${items.map((item, index) => html`
                    <li
                        class='breadcrumbs-segment ${index === last && 'breadcrumbs-segment--current'}'
                        ${{ onrender: (element: HTMLElement) => { segments[index] = element; } }}
                    >
                        ${index > 0 && separator()}
                        ${index === last
                            ? html`<span aria-current='page' class='breadcrumbs-current'>${item.label}</span>`
                            : html`
                                <a
                                    class='breadcrumbs-link'
                                    href='${item.href}'
                                    ${attributes[BREADCRUMBS_LINK]}
                                    ${{
                                        onrender: (element: Element) => {
                                            on(element, 'click', (e) => navigate(e, item, index));
                                        }
                                    }}
                                >
                                    ${item.label}
                                </a>
                            `}
                    </li>
                    ${index === 0 && html`
                        <li
                            class='breadcrumbs-segment breadcrumbs-fold --hidden'
                            ${{
                                onfocusout: (e: FocusEvent) => {
                                    if (s.active && !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
                                        close(false);
                                    }
                                },
                                onrender: (element: HTMLElement) => { fold = element; }
                            }}
                        >
                            ${separator()}
                            ${tooltip.onclick(
                                { class: 'breadcrumbs-menu-root', state: s, toggle: true },
                                html`
                                    <button
                                        aria-haspopup='menu'
                                        class='breadcrumbs-trigger'
                                        type='button'
                                        ${{
                                            'aria-controls': `${id}-menu`,
                                            'aria-expanded': () => String(s.active),
                                            'aria-label': () => `Show ${s.hidden} hidden ${s.hidden === 1 ? 'folder' : 'folders'}`,
                                            onkeydown: (e: KeyboardEvent) => {
                                                keyboard = true;

                                                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                                    e.preventDefault();
                                                    s.active = true;
                                                }
                                            },
                                            onpointerdown: () => {
                                                keyboard = false;
                                            },
                                            onrender: (element: HTMLElement) => { trigger = element; }
                                        }}
                                    >
                                        <svg aria-hidden='true' fill='currentColor' viewBox='0 0 16 16'>
                                            <circle cx='3.5' cy='8' r='1.25' />
                                            <circle cx='8' cy='8' r='1.25' />
                                            <circle cx='12.5' cy='8' r='1.25' />
                                        </svg>
                                    </button>

                                    <div
                                        aria-label='Hidden folders'
                                        class='breadcrumbs-menu tooltip-content tooltip-content--sw'
                                        id='${id}-menu'
                                        role='menu'
                                        tabindex='-1'
                                        ${attributes[BREADCRUMBS_MENU]}
                                        ${{
                                            onkeydown: (e: KeyboardEvent) => {
                                                switch (e.key) {
                                                    case 'ArrowDown':
                                                        e.preventDefault();
                                                        move(1);
                                                        return;
                                                    case 'ArrowUp':
                                                        e.preventDefault();
                                                        move(-1);
                                                        return;
                                                    case 'End':
                                                        e.preventDefault();
                                                        focus(-1);
                                                        return;
                                                    case 'Escape':
                                                        e.preventDefault();
                                                        close(true);
                                                        return;
                                                    case 'Home':
                                                        e.preventDefault();
                                                        focus(0);
                                                        return;
                                                    case 'Tab':
                                                        // Focus moves on as usual; the menu just gets out of the way.
                                                        close(false);
                                                }
                                            },
                                            onrender: (element: HTMLElement) => {
                                                element.inert = true;
                                                menu = element;
                                            }
                                        }}
                                    >
                                        ${items.slice(1, last).map((item, i) => html`
                                            <a
                                                class='breadcrumbs-option'
                                                href='${item.href}'
                                                role='menuitem'
                                                tabindex='-1'
                                                ${{
                                                    hidden: () => i >= s.hidden,
                                                    // Also keeps the click from reaching the tooltip's own toggle.
                                                    onclick: () => close(true),
                                                    onpointermove: (e: PointerEvent) => {
                                                        let element = e.currentTarget as HTMLElement;

                                                        if (e.pointerType !== 'touch' && document.activeElement !== element) {
                                                            element.focus({ preventScroll: true });
                                                        }
                                                    },
                                                    onrender: (element: Element) => {
                                                        on(element, 'click', (e) => navigate(e, item, i + 1));
                                                        options[i] = element;
                                                    }
                                                }}
                                            >
                                                <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
                                                    <path d='M2.25 4.5c0-.69.56-1.25 1.25-1.25h2.6l1.4 1.5h5c.69 0 1.25.56 1.25 1.25v5.5c0 .69-.56 1.25-1.25 1.25h-9c-.69 0-1.25-.56-1.25-1.25Z' />
                                                </svg>
                                                <span>${item.label}</span>
                                            </a>
                                        `)}
                                    </div>
                                `
                            )}
                        </li>
                    `}
                `)}
            </ol>
        </nav>
    `;
};


export default Object.assign(breadcrumbs, { link: BREADCRUMBS_LINK, menu: BREADCRUMBS_MENU } as const);
export type { Crumb, State };
