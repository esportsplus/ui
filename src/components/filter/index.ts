import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import { timing } from '~/shared/animation';
import type { Attributes } from '@esportsplus/template';
import './scss/index.scss';


type Filter<T> = {
    id: string;
    label: string;
    match: (item: T) => boolean;
};

type Options<T> = {
    filters: Filter<T>[];
    height?: boolean;
    items: T[];
    label: string;
    state?: { active: string };
};

type Origin = {
    left: number;
    top: number;
};


// Items further than this outside the viewport snap into place instead of animating.
const OVERSCAN = 200;


let instance = 0;


function near(rect: DOMRect) {
    return rect.bottom > -OVERSCAN
        && rect.right > -OVERSCAN
        && rect.left < innerWidth + OVERSCAN
        && rect.top < innerHeight + OVERSCAN;
}


export default <T>({ filters, height = false, items, label, state = reactive({ active: filters[0]?.id ?? '' }) }: Options<T>) => {
    let animations = new Map<HTMLElement, Animation>(),
        buttons: (HTMLElement | undefined)[] = [],
        counts: Record<string, number> = {},
        elements: (HTMLElement | undefined)[] = [],
        // How items come, go and move, from the list's CSS; null where it has no duration.
        enter: KeyframeAnimationOptions | null = null,
        heldFocus = false,
        id = `filter-${++instance}`,
        leave: KeyframeAnimationOptions | null = null,
        leaving = new Map<HTMLElement, string>(),
        list: HTMLElement | undefined,
        move: KeyframeAnimationOptions | null = null,
        resize: Animation | undefined,
        shown: boolean[] = [],
        status = reactive({ visible: 0 });

    for (let i = 0, n = filters.length; i < n; i++) {
        let filter = filters[i];

        counts[filter.id] = items.filter((item) => filter.match(item)).length;
    }

    function cancel(element: HTMLElement) {
        animations.get(element)?.cancel();
        animations.delete(element);
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

        buttons[next]?.focus();
        select(filters[next].id);
    }

    function play(element: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
        let animation = element.animate(keyframes, options);

        animation.onfinish = () => {
            if (animations.get(element) === animation) {
                animations.delete(element);
            }
        };
        animations.set(element, animation);

        return animation;
    }

    // Restores the inline style the element had before it was lifted out of flow.
    function release(element: HTMLElement) {
        let style = leaving.get(element);

        if (style === undefined) {
            return;
        }

        element.style.cssText = style;
        leaving.delete(element);
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

    // FLIP: read every box, apply the filter, read again, then animate from old boxes to new ones.
    function update(animate: boolean) {
        let filter = current(),
            first = new Map<HTMLElement, DOMRect>(),
            from = 0,
            lifts = new Map<HTMLElement, Origin>(),
            parents = new Map<Element, Origin>(),
            visible = 0;

        // Reads are batched ahead of any write so the browser lays out once per phase.
        if (animate && list) {
            from = list.getBoundingClientRect().height;

            for (let i = 0, n = elements.length; i < n; i++) {
                let element = elements[i];

                if (!element || (!shown[i] && !leaving.has(element))) {
                    continue;
                }

                let rect = element.getBoundingClientRect();

                first.set(element, rect);

                if (!shown[i] || !filter || filter.match(items[i]) || !near(rect)) {
                    continue;
                }

                let parent = element.offsetParent as HTMLElement | null;

                if (!parent) {
                    continue;
                }

                let origin = parents.get(parent);

                if (!origin) {
                    let bounds = parent.getBoundingClientRect();

                    origin = {
                        left: bounds.left + parent.clientLeft - parent.scrollLeft,
                        top: bounds.top + parent.clientTop - parent.scrollTop
                    };
                    parents.set(parent, origin);
                }

                lifts.set(element, origin);
            }
        }

        for (let i = 0, n = items.length; i < n; i++) {
            let element = elements[i];

            if (!filter || filter.match(items[i])) {
                visible++;
                shown[i] = true;

                if (element) {
                    cancel(element);
                    release(element);
                    element.style.removeProperty('display');
                }

                continue;
            }

            if (!element) {
                shown[i] = false;
                continue;
            }

            // Already fading out from a previous change; let it finish.
            if (!shown[i]) {
                continue;
            }

            shown[i] = false;
            cancel(element);

            let origin = lifts.get(element),
                rect = first.get(element);

            if (!leave || !origin || !rect || !near(rect)) {
                element.style.display = 'none';
                continue;
            }

            // Pop out of flow at its current spot so the remaining items can close the gap.
            leaving.set(element, element.style.cssText);
            element.style.boxSizing = 'border-box';
            element.style.height = `${rect.height}px`;
            element.style.left = `${rect.left - origin.left}px`;
            element.style.margin = '0';
            element.style.pointerEvents = 'none';
            element.style.position = 'absolute';
            element.style.top = `${rect.top - origin.top}px`;
            element.style.width = `${rect.width}px`;

            play(element, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.98)' }], leave).onfinish = () => {
                animations.delete(element);
                release(element);
                element.style.display = 'none';

                if (leaving.size === 0) {
                    settle();
                }
            };
        }

        status.visible = visible;

        if (leaving.size === 0) {
            settle();
        }

        if (!animate || !list) {
            return;
        }

        if (height && move) {
            resize?.cancel();

            let to = list.getBoundingClientRect().height;

            if (Math.abs(from - to) > 0.5) {
                let keyframes: Keyframe[] = [
                    { boxSizing: 'border-box', height: `${from}px` },
                    { boxSizing: 'border-box', height: `${to}px` }
                ];

                if (getComputedStyle(list).overflowY === 'visible') {
                    keyframes[0].overflow = keyframes[1].overflow = 'hidden';
                }

                resize = list.animate(keyframes, move);
            }
        }

        for (let i = 0, n = elements.length; i < n; i++) {
            let element = elements[i];

            if (!element || !shown[i]) {
                continue;
            }

            let last = element.getBoundingClientRect(),
                rect = first.get(element);

            if (!rect) {
                if (enter && near(last)) {
                    play(element, [{ opacity: 0, transform: 'scale(0.97)' }, { opacity: 1, transform: 'scale(1)' }], enter);
                }

                continue;
            }

            if (!move || (!near(last) && !near(rect))) {
                continue;
            }

            let h = last.height ? rect.height / last.height : 1,
                w = last.width ? rect.width / last.width : 1,
                x = rect.left - last.left,
                y = rect.top - last.top;

            if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5 && Math.abs(w - 1) < 0.005 && Math.abs(h - 1) < 0.005) {
                continue;
            }

            play(element, [
                { transform: `translate(${x}px, ${y}px) scale(${w}, ${h})`, transformOrigin: '0 0' },
                { transform: 'none', transformOrigin: '0 0' }
            ], move);
        }
    }

    let stop = effect(() => state.active, () => {
        let computed = list && getComputedStyle(list);

        enter = computed ? timing(computed, 'enter') : null;
        leave = computed ? timing(computed, 'leave') : null;
        move = computed ? timing(computed, 'move') : null;
        update(!!(enter || leave || move));
    });

    onCleanup(() => {
        resize?.cancel();
        stop();

        for (let animation of animations.values()) {
            animation.cancel();
        }
    });

    return {
        announcer: {
            'aria-live': 'polite',
            class: 'filter-announcer',
            textContent: () => `${current()?.label ?? ''}: ${status.visible} of ${items.length} shown`
        } as Attributes,
        counts,
        item: (index: number): Attributes => ({
            onconnect: (element: HTMLElement) => {
                elements[index] = element;

                if (!shown[index]) {
                    element.style.display = 'none';
                }
            },
            ondisconnect: (element: HTMLElement) => {
                if (elements[index] !== element) {
                    return;
                }

                cancel(element);
                release(element);
                elements[index] = undefined;
            }
        }),
        list: {
            class: 'filter',
            id,
            onconnect: (element: HTMLElement) => {
                list = element;

                // Leaving items are positioned against the nearest positioned ancestor.
                if (getComputedStyle(element).position === 'static') {
                    element.style.position = 'relative';
                }
            },
            tabindex: '-1'
        } as Attributes,
        select,
        state,
        status,
        trigger: (filter: Filter<T>, index: number): Attributes => ({
            'aria-checked': () => String(state.active === filter.id),
            'aria-label': `${filter.label}, ${counts[filter.id]} of ${items.length}`,
            class: () => state.active === filter.id && '--active',
            onclick: () => select(filter.id),
            onconnect: (element: HTMLElement) => {
                buttons[index] = element;
            },
            onkeydown: (event: KeyboardEvent) => keydown(event, index),
            role: 'radio',
            tabindex: () => state.active === filter.id ? '0' : '-1',
            type: 'button'
        }),
        triggers: {
            'aria-controls': id,
            'aria-label': label,
            role: 'radiogroup'
        } as Attributes
    };
};


export type { Filter };
