import { onCleanup, reactive, root } from '@esportsplus/reactivity';
import { html, setProperties, type Attributes, type Element as Bound } from '@esportsplus/template';


type Axis = 'x' | 'y';

type Drag = {
    delta: number;
    dirty: boolean;
    frame: number;
    origin: number;
    pointer: number;
    target: HTMLElement;
    update: (delta: number) => void;
};

// Separators being dragged along each axis, counted across every shell instance.
type Resizing = Record<Axis, number>;


const RESIZE_STATE = Symbol('shell.resize.root');


function page() {
    let element = document.documentElement as HTMLElement & { [RESIZE_STATE]?: Resizing };

    return element[RESIZE_STATE] ??= root(() => {
        let state: Resizing = reactive({ x: 0, y: 0 });

        setProperties(element as Bound, {
            class: () => [
                (state.x > 0 || state.y > 0) && 'shell-resizing',
                state.x > 0 && 'shell-resizing--x',
                state.y > 0 && 'shell-resizing--y'
            ]
        });

        return state;
    });
}


// The fractions after dragging the separator after 'index' by 'delta' pixels, trading space with the next pane only
// and keeping both above the minimum share.
const resized = (sizes: readonly number[], index: number, delta: number, length: number, minimum: number) => {
    if (length <= 0 || index < 0 || index >= sizes.length - 1) {
        return [...sizes];
    }

    let a = sizes[index],
        pair = a + sizes[index + 1],
        floor = Math.min(Math.max(0, minimum), pair / 2),
        next = [...sizes],
        size = Math.max(floor, Math.min(pair - floor, a + delta / length));

    next[index] = size;
    next[index + 1] = pair - size;

    return next;
};

// A separator dragged along 'axis', its pill following the pointer along it. 'start' reads the sizes the drag starts
// from and returns what applies each delta, at most once a frame; while it runs the whole page takes the resize cursor
// and selects nothing.
const separator = (axis: Axis, start: () => ((delta: number) => void) | null, attributes?: Attributes) => {
    let drag: Drag | null = null,
        pointer = reactive({ offset: 0 });

    function commit() {
        if (!drag?.dirty) {
            return;
        }

        drag.dirty = false;
        drag.update(drag.delta);
    }

    function release() {
        let current = drag;

        if (!current) {
            return;
        }

        drag = null;
        cancelAnimationFrame(current.frame);

        if (current.target.hasPointerCapture(current.pointer)) {
            current.target.releasePointerCapture(current.pointer);
        }

        page()[axis]--;
    }

    function stop(e: PointerEvent) {
        if (drag?.pointer === e.pointerId) {
            release();
        }
    }

    onCleanup(release);

    return html`
        <div
            aria-orientation='${axis === 'x' ? 'vertical' : 'horizontal'}'
            class='shell-handle shell-handle--${axis}'
            role='separator'
            ${attributes}
            ${{
                onlostpointercapture: stop,
                onpointercancel: stop,
                onpointerdown: function(this: HTMLElement, e: PointerEvent) {
                    if (e.button !== 0 || drag) {
                        return;
                    }

                    let update = start();

                    if (!update) {
                        return;
                    }

                    this.setPointerCapture(e.pointerId);
                    e.preventDefault();
                    e.stopPropagation();
                    drag = {
                        delta: 0,
                        dirty: false,
                        frame: 0,
                        origin: axis === 'x' ? e.clientX : e.clientY,
                        pointer: e.pointerId,
                        target: this,
                        update
                    };
                    // On the root, so the cursor holds wherever the pointer goes.
                    page()[axis]++;
                },
                onpointermove: function(this: HTMLElement, e: PointerEvent) {
                    let bounds = this.getBoundingClientRect();

                    pointer.offset = axis === 'x'
                        ? e.clientY - bounds.top - bounds.height / 2
                        : e.clientX - bounds.left - bounds.width / 2;

                    if (drag?.pointer !== e.pointerId) {
                        return;
                    }

                    e.preventDefault();
                    drag.delta = (axis === 'x' ? e.clientX : e.clientY) - drag.origin;
                    drag.dirty = true;
                    drag.frame ||= requestAnimationFrame(() => {
                        if (drag) {
                            drag.frame = 0;
                            commit();
                        }
                    });
                },
                onpointerup: (e: PointerEvent) => {
                    if (drag?.pointer !== e.pointerId) {
                        return;
                    }

                    commit();
                    release();
                },
                style: () => `--offset: ${pointer.offset}px;`
            }}
        >
            <span class='shell-handle-pill'></span>
        </div>
    `;
};


export { resized, separator };
