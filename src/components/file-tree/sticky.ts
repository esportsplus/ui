import { reactive, type Reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


type Node<T> = {
    depth: number;
    parent: T | null;
};


// The stack covers at most this share of the viewport, as in VS Code, so a short tree still shows its own rows.
const COVER = 0.4;

const MAX = 5;


// The folders pinned over the list scrolled to 'offset', outermost first. Slot n holds the ancestor at depth n of the
// row under it, or that row itself once its top passes under the slot while its rows still follow it. Rows are all
// 'size' tall, so only the rows under the stack are read, however long the list.
function pin<T extends Node<T>>(rows: T[], offset: number, size: number, max: number) {
    let first = Math.floor(offset / size),
        // How far the top row is scrolled past; the deepest folder is pushed up as far once its last row is on top.
        into = offset - first * size,
        out: T[] = [],
        push = 0;

    for (let level = 0; level < max; level++) {
        let row = rows[first + level];

        if (!row || row.depth < level) {
            break;
        }

        let node = row;

        while (node.depth > level) {
            node = node.parent!;
        }

        if (node.parent !== (out[level - 1] ?? null) || (node === row && (!into || rows[first + level + 1]?.parent !== row))) {
            break;
        }

        out.push(node);

        let next = rows[first + level + 1];

        if (!next || next.depth <= level) {
            push = into;
            break;
        }
    }

    return { push, rows: out };
}


// Pins the folders the top rows sit in over the viewport, as VS Code's sticky scroll does; 'limit' caps how many,
// 'true' being five. Rendered as copies inside the viewport, so the wheel still scrolls over them.
export default <T extends Node<T>>(rows: Reactive<T[]>, limit: boolean | number, template: (row: T) => DocumentFragment | Text) => {
    let frame = 0,
        height = 0,
        max = limit === true ? MAX : limit || 0,
        pinned: Reactive<T[]> = reactive([] as T[]),
        push = 0,
        size = 0,
        stack: HTMLElement | undefined,
        stop: VoidFunction | undefined,
        viewport: HTMLElement | undefined;

    if (max > 0) {
        rows.on('splice', schedule);
    }

    function capacity() {
        return size ? Math.min(max, Math.floor(height * COVER / size)) : 0;
    }

    function measure() {
        height = viewport!.clientHeight;
        size = viewport!.querySelector<HTMLElement>('.file-tree-row')?.offsetHeight ?? 0;
    }

    // Rows change in slices and the list moves its window on the next frame, so the stack follows once it has.
    function schedule() {
        frame ||= requestAnimationFrame(() => {
            frame = 0;
            update();
        });
    }

    function update() {
        if (!stack || !viewport) {
            return;
        }

        if (!size) {
            measure();
        }

        let count = capacity(),
            next = count ? pin(rows, viewport.scrollTop, size, count) : { push: 0, rows: [] },
            same = 0;

        // Outer folders stay pinned the longest, so only the rows past the shared start are swapped.
        while (same < next.rows.length && same < pinned.length && pinned[same] === next.rows[same]) {
            same++;
        }

        if (same < pinned.length || same < next.rows.length) {
            pinned.splice(same, pinned.length - same, ...next.rows.slice(same));
        }

        if (next.push !== push) {
            push = next.push;
            stack.style.setProperty('--sticky-push', `${push}px`);
        }
    }

    return {
        // Rows the stack covers over 'row' once scrolled to sit just below it: each folder above it, up to capacity.
        cover: (row: T) => Math.min(row.depth, capacity()),
        render: () => max > 0 && html`
            <div
                aria-hidden='true'
                class='file-tree-sticky'
                ${{
                    onconnect: (element: HTMLElement) => {
                        let host = element.parentElement!,
                            resize = new ResizeObserver(() => {
                                measure();
                                update();
                            });

                        host.addEventListener('scroll', update, { passive: true });
                        resize.observe(host);
                        stack = element;
                        stop = () => {
                            host.removeEventListener('scroll', update);
                            resize.disconnect();
                        };
                        viewport = host;
                    },
                    ondisconnect: () => {
                        cancelAnimationFrame(frame);
                        frame = 0;
                        stop?.();
                        stop = undefined;
                        stack = viewport = undefined;
                    }
                }}
            >
                <div class='file-tree-sticky-rows'>
                    ${html.reactive(pinned, template)}
                </div>
            </div>
        `
    };
};
