import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import './scss/index.scss';


type Filter<T> = {
    id: string;
    label: string;
    match: (item: T) => boolean;
};


const ENTER: KeyframeAnimationOptions = { duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' };

const LEAVE: KeyframeAnimationOptions = { duration: 140, easing: 'cubic-bezier(0.4, 0, 1, 1)' };

const MOVE: KeyframeAnimationOptions = { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };


let instance = 0;


function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}


export default <T>({
    columns = 3,
    emptyLabel = 'Nothing matches this filter',
    filters,
    gap = 8,
    items,
    label,
    maxRows = 4,
    render,
    rowHeight = 72,
    state = reactive({ active: filters[0]?.id ?? '' }),
    ...attributes
}: Attributes & {
    columns?: number;
    emptyLabel?: string;
    filters: Filter<T>[];
    gap?: number;
    items: T[];
    label: string;
    maxRows?: number;
    render: (item: T) => Renderable<unknown>;
    rowHeight?: number;
    state?: { active: string };
}) => {
    let cols = Math.max(1, Math.floor(columns)),
        counts: Record<string, number> = {},
        elements: HTMLElement[] = [],
        group: HTMLElement | undefined,
        heldFocus = false,
        id = `filter-grid-${++instance}`,
        leaving = new Set<HTMLElement>(),
        list: HTMLElement | undefined,
        observer: ResizeObserver | undefined,
        rows = Math.min(Math.max(1, Math.ceil(items.length / cols)), Math.max(1, maxRows)),
        status = reactive({ visible: 0 }),
        thumb: HTMLElement | undefined;

    for (let i = 0, n = filters.length; i < n; i++) {
        let count = 0,
            filter = filters[i];

        for (let j = 0, m = items.length; j < m; j++) {
            if (filter.match(items[j])) {
                count++;
            }
        }

        counts[filter.id] = count;
    }

    function current() {
        return filters.find((filter) => filter.id === state.active) ?? filters[0];
    }

    function keydown(event: KeyboardEvent, index: number) {
        let n = filters.length,
            next: number;

        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowRight':
                next = index + 1;
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                next = index - 1;
                break;
            case 'End':
                next = n - 1;
                break;
            case 'Home':
                next = 0;
                break;
            default:
                return;
        }

        event.preventDefault();
        next = (next + n) % n;

        group?.querySelectorAll<HTMLElement>('.filter-grid-filter')[next]?.focus();
        select(filters[next].id);
    }

    function place(animate: boolean) {
        // Look up by index; the chip's --active class binding may not have flushed yet.
        let chip = group?.querySelectorAll<HTMLElement>('.filter-grid-filter')[Math.max(0, filters.indexOf(current()))];

        if (!chip || !thumb) {
            return;
        }

        if (!animate) {
            thumb.style.transition = 'none';
        }

        thumb.style.setProperty('--height', `${chip.offsetHeight}px`);
        thumb.style.setProperty('--width', `${chip.offsetWidth}px`);
        thumb.style.setProperty('--x', `${chip.offsetLeft}px`);
        thumb.style.setProperty('--y', `${chip.offsetTop}px`);

        if (!animate) {
            thumb.offsetWidth;
            thumb.style.transition = '';
        }
    }

    function select(key: string) {
        heldFocus = !!list && list !== document.activeElement && list.contains(document.activeElement);
        state.active = key;
    }

    function settle() {
        if (!heldFocus || !list) {
            return;
        }

        heldFocus = false;

        if (!list.contains(document.activeElement)) {
            list.focus({ preventScroll: true });
        }
    }

    // FLIP: measure, reflow into the new filter, then animate each card from where it was.
    function update(animate: boolean) {
        if (!list) {
            return;
        }

        let bounds = list.getBoundingClientRect(),
            filter = current(),
            first = new Map<HTMLElement, DOMRect>(),
            visible = 0;

        for (let i = 0, n = elements.length; i < n; i++) {
            let element = elements[i];

            if (!element.hidden) {
                first.set(element, element.getBoundingClientRect());
            }
        }

        for (let i = 0, n = elements.length; i < n; i++) {
            let element = elements[i];

            if (!filter || filter.match(items[i])) {
                visible++;

                for (let animation of element.getAnimations()) {
                    animation.cancel();
                }

                element.classList.remove('--leaving');
                element.hidden = false;
                element.removeAttribute('style');
                leaving.delete(element);
                continue;
            }

            // Already fading out from a previous change; let it finish.
            if (leaving.has(element)) {
                continue;
            }

            let rect = first.get(element);

            if (!animate || !rect) {
                element.hidden = true;
                continue;
            }

            for (let animation of element.getAnimations()) {
                animation.cancel();
            }

            // Pop out of flow at its current spot so the remaining cards can close the gap.
            element.classList.add('--leaving');
            element.style.height = `${rect.height}px`;
            element.style.left = `${rect.left - bounds.left - list.clientLeft + list.scrollLeft}px`;
            element.style.top = `${rect.top - bounds.top - list.clientTop + list.scrollTop}px`;
            element.style.width = `${rect.width}px`;
            leaving.add(element);

            element.animate(
                [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.98)' }],
                LEAVE
            ).onfinish = () => {
                element.classList.remove('--leaving');
                element.hidden = true;
                element.removeAttribute('style');
                leaving.delete(element);

                if (leaving.size === 0) {
                    settle();
                }
            };
        }

        status.visible = visible;

        if (leaving.size === 0) {
            settle();
        }

        if (!animate) {
            return;
        }

        for (let i = 0, n = elements.length; i < n; i++) {
            let element = elements[i];

            if (element.hidden || leaving.has(element)) {
                continue;
            }

            let last = element.getBoundingClientRect(),
                rect = first.get(element);

            if (!rect) {
                element.animate([{ opacity: 0, transform: 'scale(0.97)' }, { opacity: 1, transform: 'scale(1)' }], ENTER);
                continue;
            }

            let x = rect.left - last.left,
                y = rect.top - last.top;

            if (x !== 0 || y !== 0) {
                element.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: 'none' }], MOVE);
            }
        }
    }

    let stop = effect(() => {
        state.active;

        untrack(() => {
            let animate = !reduced();

            place(animate);
            update(animate);
        });
    });

    onCleanup(() => {
        observer?.disconnect();
        stop();
    });

    return html`
        <div class='filter-grid' ${attributes}>
            <div
                class='filter-grid-filters'
                role='radiogroup'
                aria-controls='${id}'
                aria-label='${label}'
                ${{
                    onconnect: (element: HTMLElement) => {
                        group = element;
                        thumb = element.querySelector<HTMLElement>('.filter-grid-thumb') ?? undefined;
                        place(false);

                        // Chips can wrap onto new lines as the container resizes.
                        observer = new ResizeObserver(() => place(false));
                        observer.observe(element);
                    }
                }}
            >
                <span class='filter-grid-thumb' aria-hidden='true'></span>
                ${filters.map((filter, index) => html`
                    <button
                        class='filter-grid-filter ${() => state.active === filter.id ? '--active' : ''}'
                        type='button'
                        role='radio'
                        aria-checked='${() => String(state.active === filter.id)}'
                        aria-label='${filter.label}, ${counts[filter.id]} of ${items.length}'
                        tabindex='${() => state.active === filter.id ? 0 : -1}'
                        onclick='${() => select(filter.id)}'
                        onkeydown='${(event: KeyboardEvent) => keydown(event, index)}'
                    >
                        ${filter.label}
                        <span class='filter-grid-count'>${counts[filter.id]}</span>
                    </button>
                `)}
            </div>

            <div class='filter-grid-body'>
                <ul
                    class='filter-grid-items ${Math.ceil(items.length / cols) > Math.max(1, maxRows) ? 'filter-grid-items--capped' : ''}'
                    id='${id}'
                    tabindex='-1'
                    style='--columns: ${cols}; --gap: ${gap}px; --row-height: ${rowHeight}px; --rows: ${rows};'
                    ${{
                        onconnect: (element: HTMLElement) => {
                            elements = Array.from(element.children).filter((child): child is HTMLElement => child instanceof HTMLLIElement);
                            list = element;
                            update(false);
                        }
                    }}
                >
                    ${items.map((item) => html`<li class='filter-grid-item'>${render(item)}</li>`)}
                </ul>

                <div class='filter-grid-empty ${() => status.visible === 0 ? '--active' : ''}'>
                    ${emptyLabel}
                </div>
            </div>

            <p class='--hidden-offcanvas' aria-live='polite'>
                ${() => `${current()?.label ?? ''}: ${status.visible} of ${items.length} shown`}
            </p>
        </div>
    `;
};


export type { Filter };
