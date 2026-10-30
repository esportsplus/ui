import { onCleanup, reactive, root } from '@esportsplus/reactivity';
import { setProperties, type Element as Bound } from '@esportsplus/template';


type Drag = {
    delta: number;
    dirty: boolean;
    frame: number;
    origin: number;
    pointer: number;
    target: HTMLElement;
    update: (delta: number) => void;
};

// Separators being dragged along each axis, counted across every panels instance.
type Resizing = Record<'x' | 'y', number>;


const RESIZE_STATE = Symbol('panels.resize.root');


function page() {
    let element = document.documentElement as HTMLElement & { [RESIZE_STATE]?: Resizing };

    return element[RESIZE_STATE] ??= root(() => {
        let state: Resizing = reactive({ x: 0, y: 0 });

        setProperties(element as Bound, {
            class: () => [
                (state.x > 0 || state.y > 0) && 'panels-resizing',
                state.x > 0 && 'panels-resizing--x',
                state.y > 0 && 'panels-resizing--y'
            ]
        });

        return state;
    });
}


// Attributes for a separator dragged along 'axis'. 'start' reads the sizes the drag starts from and returns what
// applies each delta, at most once a frame; while it runs the whole page takes the resize cursor and selects nothing.
const resize = (axis: 'x' | 'y', start: () => ((delta: number) => void) | null) => {
    let drag: Drag | null = null;

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

    return {
        onlostpointercapture: stop,
        onpointercancel: stop,
        onpointerdown: (e: PointerEvent) => {
            if (e.button !== 0 || drag) {
                return;
            }

            let update = start();

            if (!update) {
                return;
            }

            let target = e.currentTarget as HTMLElement;

            target.setPointerCapture(e.pointerId);
            e.preventDefault();
            e.stopPropagation();
            drag = {
                delta: 0,
                dirty: false,
                frame: 0,
                origin: axis === 'x' ? e.clientX : e.clientY,
                pointer: e.pointerId,
                target,
                update
            };
            // On the root, so the cursor holds wherever the pointer goes.
            page()[axis]++;
        },
        onpointermove: (e: PointerEvent) => {
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
        }
    };
};

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


export { resize, resized };
