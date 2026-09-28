import { reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type Axis = 'both' | 'horizontal' | 'vertical';

type Press = {
    id: number;
    left: number;
    moved: boolean;
    top: number;
    x: number;
    y: number;
};


// Matches the 5% ramp of the scroll-driven keyframes.
const RAMP = 0.05;

// Up to this many pixels a press is still a click.
const SLOP = 4;


function attributes(name: string) {
    if (typeof CSS === 'undefined' || CSS.supports('animation-timeline: scroll()')) {
        return { class: name };
    }

    let observer: ResizeObserver | undefined,
        overflow = { bottom: 0, top: 0 },
        state = reactive({ toggle: false });

    function update(element: HTMLElement) {
        let range = element.scrollHeight - element.clientHeight,
            progress = range > 0 ? element.scrollTop / range : 0,
            bottom = range > 0 ? Math.min(1, (1 - progress) / RAMP) : 0,
            top = range > 0 ? Math.min(1, progress / RAMP) : 0;

        // Both settle at 0 or 1 away from the ends, so most scroll events have nothing to rewrite.
        if (bottom === overflow.bottom && top === overflow.top) {
            return;
        }

        overflow.bottom = bottom;
        overflow.top = top;
        state.toggle = !state.toggle;
    }

    // Returned as a reactive style, not set imperatively, because the template rewrites the whole
    // style attribute whenever any other reactive style on the element changes.
    return {
        class: name,
        onconnect: (element: HTMLElement) => {
            observer = new ResizeObserver(() => update(element));
            observer.observe(element);

            for (let i = 0, n = element.children.length; i < n; i++) {
                observer.observe(element.children[i]);
            }
        },
        ondisconnect: () => {
            observer?.disconnect();
        },
        onscroll: function(this: HTMLElement) {
            update(this);
        },
        style: () => state.toggle !== undefined && `--scroll-overflow-bottom: ${overflow.bottom}; --scroll-overflow-top: ${overflow.top};`
    };
}


const blur = () => attributes('--scrollbar-blur');

// Mouse only: touch, pen and trackpads already scroll natively, with their own momentum. The pointer is
// captured only once the press moves past the slop, so a plain click still reaches whatever it landed on.
const drag = (axis: Axis = 'both') => {
    let press: Press | null = null;

    function end(this: HTMLElement, e: PointerEvent) {
        if (press?.id !== e.pointerId) {
            return;
        }

        press = null;
        this.classList.remove('--dragging');
    }

    return {
        class: '--scrollbar-drag',
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
                end.call(this, e);
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
                this.classList.add('--dragging');
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
};

const fade = () => attributes('--scrollbar-fade');


export default { blur, drag, fade };
