import { reactive } from '@esportsplus/reactivity';
import { observer, type Observer } from '~/shared/resize';
import { overlay } from '../glass';
import './scss/index.scss';


type Axis = 'both' | 'horizontal' | 'vertical';

// Mirrors tokens' '$colors', which generates a '--scrollbar-<color>' class for each.
type Color = 'black' | 'blue' | 'green' | 'grey' | 'primary' | 'purple' | 'red' | 'text' | 'white' | 'yellow';

// Blur and fade are both edge effects, so a scroller takes one or the other; drag combines with either.
type Options = {
    auto?: boolean;
    color?: Color;
    drag?: Axis | boolean;
    hidden?: boolean;
    horizontal?: boolean;
    hover?: boolean;
    snap?: boolean;
} & (
    { blur?: boolean; fade?: never } |
    { blur?: never; fade?: boolean }
);

type Press = {
    id: number;
    left: number;
    moved: boolean;
    top: number;
    x: number;
    y: number;
};


// Up to this many pixels a press is still a click.
const SLOP = 4;


// 'size' names the effect's registered length, which computes to pixels: like the scroll-driven animation ranges,
// each edge reaches full strength once the content has scrolled that far past it.
function edges(size: string, horizontal: boolean) {
    if (typeof CSS === 'undefined' || CSS.supports('animation-timeline: scroll()')) {
        return {};
    }

    let mutation: MutationObserver | undefined,
        overflow = { end: 0, start: 0 },
        ramp = 1,
        resize: Observer | undefined,
        state = reactive({ toggle: false });

    function measure(element: HTMLElement) {
        ramp = parseFloat(getComputedStyle(element).getPropertyValue(size)) || 1;
        update(element);
    }

    function update(element: HTMLElement) {
        let offset = horizontal ? Math.abs(element.scrollLeft) : element.scrollTop,
            range = horizontal ? element.scrollWidth - element.clientWidth : element.scrollHeight - element.clientHeight,
            end = range > 0 ? Math.min(1, (range - offset) / ramp) : 0,
            start = range > 0 ? Math.min(1, offset / ramp) : 0;

        // Both settle at 0 or 1 away from the ends, so most scroll events have nothing to rewrite.
        if (end === overflow.end && start === overflow.start) {
            return;
        }

        overflow.end = end;
        overflow.start = start;
        state.toggle = !state.toggle;
    }

    // Returned as a reactive style, not set imperatively, because the template rewrites the whole
    // style attribute whenever any other reactive style on the element changes.
    return {
        onconnect: (element: HTMLElement) => {
            mutation?.disconnect();
            resize?.disconnect();
            resize = observer(() => measure(element));
            resize.observe(element);

            for (let i = 0, n = element.children.length; i < n; i++) {
                resize.observe(element.children[i]);
            }

            // Content rendered after connecting changes the range too, so it joins the observed children.
            mutation = new MutationObserver((records) => {
                for (let i = 0, n = records.length; i < n; i++) {
                    let { addedNodes, removedNodes } = records[i];

                    for (let j = 0, m = addedNodes.length; j < m; j++) {
                        let node = addedNodes[j];

                        if (node instanceof Element) {
                            resize?.observe(node);
                        }
                    }

                    for (let j = 0, m = removedNodes.length; j < m; j++) {
                        let node = removedNodes[j];

                        if (node instanceof Element) {
                            resize?.unobserve(node);
                        }
                    }
                }

                update(element);
            });
            mutation.observe(element, { childList: true });
        },
        ondisconnect: () => {
            mutation?.disconnect();
            mutation = undefined;
            resize?.disconnect();
            resize = undefined;
        },
        onscroll: function(this: HTMLElement) {
            update(this);
        },
        style: () => state.toggle !== undefined && `--scrollbar-overflow-end: ${overflow.end}; --scrollbar-overflow-start: ${overflow.start};`
    };
}


function blur(horizontal: boolean) {
    let scroll = edges('--scrollbar-blur-size', horizontal);

    return {
        ...scroll,
        onconnect: (element: HTMLElement) => {
            if (!element.querySelector(':scope > .--scrollbar-blur-start')) {
                element.prepend(overlay('progressive', '--scrollbar-blur-edge --scrollbar-blur-start'));
            }

            if (!element.querySelector(':scope > .--scrollbar-blur-end')) {
                element.appendChild(overlay('progressive', '--scrollbar-blur-edge --scrollbar-blur-end'));
            }

            scroll.onconnect?.(element);
        }
    };
}

// Mouse only: touch, pen and trackpads already scroll natively, with their own momentum. The pointer is
// captured only once the press moves past the slop, so a plain click still reaches whatever it landed on.
function drag(axis: Axis) {
    let press: Press | null = null,
        state = reactive({ dragging: false });

    function end(e: PointerEvent) {
        if (press?.id !== e.pointerId) {
            return;
        }

        press = null;
        state.dragging = false;
    }

    return {
        class: ['--scrollbar-drag', () => state.dragging && '--dragging'],
        // Links and images would otherwise start a native drag-and-drop mid-scroll.
        ondragstart: (e: DragEvent) => {
            e.preventDefault();
        },
        onpointercancel: end,
        onpointerdown: function(this: HTMLElement, e: PointerEvent) {
            if (e.button !== 0 || e.pointerType !== 'mouse') {
                return;
            }

            press = { id: e.pointerId, left: this.scrollLeft, moved: false, top: this.scrollTop, x: e.clientX, y: e.clientY };
        },
        onpointermove: function(this: HTMLElement, e: PointerEvent) {
            if (press?.id !== e.pointerId) {
                return;
            }

            // Released outside the window before the capture, so no pointerup arrived.
            if (!e.buttons) {
                end(e);
                return;
            }

            let dx = axis === 'vertical' ? 0 : e.clientX - press.x,
                dy = axis === 'horizontal' ? 0 : e.clientY - press.y;

            if (!press.moved) {
                if (Math.abs(dx) <= SLOP && Math.abs(dy) <= SLOP) {
                    return;
                }

                press.moved = true;
                getSelection()?.removeAllRanges();
                state.dragging = true;
                this.setPointerCapture(e.pointerId);
            }

            if (axis !== 'vertical') {
                this.scrollLeft = press.left - dx;
            }

            if (axis !== 'horizontal') {
                this.scrollTop = press.top - dy;
            }
        },
        onpointerup: end
    };
}


// One scroller's attributes: the bar and its variants, an edge effect if asked for, and mouse drag along 'drag''s axis,
// both when true.
const scrollbar = ({
    auto,
    blur: blurred,
    color,
    drag: dragged,
    fade: faded,
    hidden,
    horizontal = false,
    hover,
    snap
}: Options = {}) => {
    let classes: (string | (() => false | string))[] = ['--scrollbar'],
        effect = blurred
            ? blur(horizontal)
            : faded
                ? edges('--scrollbar-fade-size', horizontal)
                : {},
        grab = dragged ? drag(dragged === true ? 'both' : dragged) : null;

    if (auto) {
        classes.push('--scrollbar-auto');
    }

    if (blurred) {
        classes.push('--scrollbar-blur');
    }

    if (color) {
        classes.push(`--scrollbar-${color}`);
    }

    if (faded) {
        classes.push('--scrollbar-fade');
    }

    if (hidden) {
        classes.push('--scrollbar-hidden');
    }

    if (horizontal) {
        classes.push('--scrollbar-horizontal');
    }

    if (hover) {
        classes.push('--scrollbar-hover');
    }

    if (snap) {
        classes.push('--scrollbar-snap');
    }

    if (!grab) {
        return { ...effect, class: classes };
    }

    return { ...effect, ...grab, class: [...classes, ...grab.class] };
};


export default scrollbar;
export type { Axis, Color, Options };
