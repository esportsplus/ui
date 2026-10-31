import { effect, peek, read, root, signal, untrack, write } from '@esportsplus/reactivity';
import { html, on, render } from '@esportsplus/template';


type Active = Source & { rect: Rect };

type Collide = (active: Active, pointer: Point, targets: Target[]) => string | null;

type Data = Record<string, unknown>;

type Over = Target;

type Point = { x: number; y: number };

type Rect = { bottom: number; height: number; left: number; right: number; top: number; width: number };

type Source = { data: Data; id: string; node: HTMLElement };

type Target = Source & { rect: Rect };


// Under this many pixels a press stays a click.
const THRESHOLD = 4;


function measure(element: HTMLElement): Rect {
    let { bottom, height, left, right, top, width } = element.getBoundingClientRect();

    return { bottom, height, left, right, top, width };
}


// One drag at a time: a press past the threshold starts it, collision picks what it is over on every move, and
// releasing ends it there. Escape or a cancelled pointer drops it.
const manager = ({ collide, end, label }: { collide: Collide; end: (active: Active, over: Over | null, pointer: Point) => void; label: (active: Active) => string }) => {
    let active = signal<Active | null>(null),
        delta = signal<Point>({ x: 0, y: 0 }),
        over = signal<Over | null>(null),
        pressed: VoidFunction | null = null,
        targets = new Map<string, Source>();

    function reset() {
        pressed?.();
        pressed = null;
        write(active, null);
        write(delta, { x: 0, y: 0 });
        write(over, null);
    }

    return {
        active,

        dispose: reset,

        // Starts tracking a press on 'source'; the drag itself only begins once the pointer moves past the threshold.
        drag(source: Source, e: PointerEvent) {
            if (pressed || e.button !== 0) {
                return;
            }

            let controller = new AbortController(),
                origin = { x: e.clientX, y: e.clientY },
                rects: Target[] = [],
                signal = controller.signal,
                started = false;

            pressed = () => controller.abort();

            function move(e: PointerEvent) {
                let pointer = { x: e.clientX, y: e.clientY };

                if (!started) {
                    if (Math.hypot(pointer.x - origin.x, pointer.y - origin.y) < THRESHOLD) {
                        return;
                    }

                    started = true;
                    rects = [...targets.values()].map((target) => ({ ...target, rect: measure(target.node) }));
                    write(active, { ...source, rect: measure(source.node) });
                }

                let current = peek(active)!,
                    id = collide(current, pointer, rects);

                write(delta, { x: pointer.x - origin.x, y: pointer.y - origin.y });
                write(over, rects.find((target) => target.id === id) ?? null);
            }

            on(document, 'keydown', (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    reset();
                }
            }, { signal });
            on(document, 'pointercancel', reset, { signal });
            on(document, 'pointermove', move, { signal });
            on(document, 'pointerup', (e) => {
                let current = peek(active),
                    target = peek(over);

                reset();

                if (started && current) {
                    end(current, target, { x: e.clientX, y: e.clientY });
                }
            }, { signal });
        },

        // Registers the element as a drop target while it is connected; it carries '--over' while the drag is over it.
        droppable(config: () => { data: Data; id: string }) {
            let id = '',
                node: HTMLElement | null = null;

            return {
                class: () => read(over)?.id === id && id !== '' ? '--over' : '',
                onconnect: (element: HTMLElement) => {
                    let current = config();

                    id = current.id;
                    node = element;
                    targets.set(id, { ...current, node: element });
                },
                ondisconnect: () => {
                    if (node && targets.get(id)?.node === node) {
                        targets.delete(id);
                    }

                    node = null;
                }
            };
        },

        over,

        // A label that follows the pointer while dragging, in a fixed layer on the body so no transformed or clipping
        // ancestor can displace it.
        overlay() {
            let release: VoidFunction | null = null;

            function unmount() {
                release?.();
                release = null;
            }

            let stop = effect(() => {
                let current = read(active);

                if (!current) {
                    unmount();
                    return;
                }

                if (release) {
                    return;
                }

                // On <body>, outside anything the panels render, in its own root so only 'unmount' releases it; only the
                // move's offset changes after.
                release = untrack(() => root(() => render(document.body, () => html`
                    <div
                        class='panels-ghost'
                        ${{
                            style: () => {
                                let offset = read(delta);

                                return {
                                    left: `${current.rect.left}px`,
                                    top: `${current.rect.top}px`,
                                    translate: `${offset.x}px ${offset.y}px`
                                };
                            }
                        }}
                    >
                        ${label(current)}
                    </div>
                `)));
            });

            return () => {
                stop();
                unmount();
            };
        }
    };
};


export default manager;
export type { Active, Collide, Over, Point, Rect, Target };
