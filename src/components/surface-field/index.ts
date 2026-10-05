import { component, html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, read as get, signal, untrack, write } from '@esportsplus/reactivity';
import { pool } from '@esportsplus/workers';
import { observer, type Observer } from '~/shared/resize';
import { observeIntersection } from '~/shared/visible';
import engine, { scheduler, type Camera, type Link as Path, type Rgb, type Settings, type Shape } from './engine';
import surface from './surface';
import type { Actions, Call, Field } from './worker';
import './scss/index.scss';


// A channel through the field between two surfaces: the dots lift into a lit vein and the lattice parts round it.
type Link = {
    // Surface names (`name` on a surface, or the value of `data-surface-field`) at either end.
    from?: string;
    // `loop` sends a crest from `from` to `to`, `bounce` sends it back and forth.
    motion?: 'bounce' | 'loop' | 'still';
    // The path itself, in field px (world units when a camera is set); wins over the curve between `from` and `to`.
    points?: { x: number, y: number }[];
    // Crest speed in px per second.
    speed?: number;
    to?: string;
    // Width of the lit vein in px.
    width?: number;
};

type Options = {
    // Colour the lit dots and lines drift toward, blended in by `tint`; defaults to the `--accent` custom property.
    accent?: string;
    // Resting opacity of an unlit dot.
    base?: number;
    // 0 – 1: how deeply idle dots pulse in and out.
    breathe?: number;
    // 0 – 1: peak opacity the light lifts lines to; dots rise proportionally higher.
    brightness?: number;
    // Anchors the grid to a pannable, zoomable world (for example a node editor's viewport) instead of centring it. It
    // pans with the world and scales less than it, as a floor below the content.
    camera?: Camera | null;
    // Draw grid lines between neighbouring dots where the light reaches.
    connected?: boolean;
    // Distance between dots in px.
    gap?: number;
    // Radius of the pointer light's line reach in px.
    lineRadius?: number;
    links?: Link[] | null;
    // How far dots under the pointer are nudged away, in px.
    pointerPush?: number;
    // Radius of the pointer light in px.
    radius?: number;
    // Each new value sends a ring out from that point, in field px.
    ripple?: { x: number, y: number } | null;
    // How far a ring displaces the dots it passes, in px.
    ripplePush?: number;
    // Render a static texture: no pointer light, rings, breathing, wandering or moving links.
    still?: boolean;
    // Widens (positive) or narrows (negative) the empty band around each surface, in px.
    surfacePadding?: number;
    // 0 – 1: how far lit dots and lines blend toward `accent`.
    tint?: number;
    // Let the light drift on its own while the pointer is away.
    wander?: boolean;
};

type Style = { ellipse: boolean, radius: number, rotation: number };


const ANGLE = /(-?[\d.]+)(deg|grad|rad|turn)\s*$/;


const DEFAULTS: Required<Options> = {
    accent: '',
    base: 0.14,
    breathe: 0,
    brightness: 0.2,
    camera: null,
    connected: true,
    gap: 22,
    lineRadius: 200,
    links: null,
    pointerPush: 2,
    radius: 250,
    ripple: null,
    ripplePush: 6,
    still: false,
    surfacePadding: 0,
    tint: 0,
    wander: false
};

const KEYS = Object.keys(DEFAULTS) as (keyof Options)[];

// Kept in step with the engine's methods by `satisfies`; `dispose` and `flush` are the proxy's own.
const METHODS = [
    'camera',
    'cancel',
    'configure',
    'links',
    'pointer',
    'press',
    'recolor',
    'release',
    'resize',
    'ripple',
    'surfaces',
    'visible'
] as const satisfies (keyof Field)[];

// Elements the field clears a space around and lights up.
const SELECTOR = '.surface-field-surface, [data-surface-field]';

const SETTINGS: (keyof Settings)[] = [
    'base',
    'breathe',
    'brightness',
    'connected',
    'gap',
    'lineRadius',
    'pointerPush',
    'radius',
    'ripplePush',
    'still',
    'surfacePadding',
    'tint',
    'wander'
];

const UNITS: Record<string, number> = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };


let colors = new Map<string, Rgb>(),
    probe: CanvasRenderingContext2D | null = null;


function angle(value: string) {
    let match = ANGLE.exec(value);

    return match ? parseFloat(match[1]) * UNITS[match[2]] : 0;
}

// Resolves any CSS colour (oklch, named, hex…) to rgb by painting it once.
function rgb(color: string): Rgb {
    let cached = colors.get(color);

    if (cached) {
        return cached;
    }

    probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = '#000';
    probe.fillStyle = color;
    probe.fillRect(0, 0, 1, 1);

    let data = probe.getImageData(0, 0, 1, 1).data,
        value: Rgb = [data[0], data[1], data[2]];

    if (colors.size > 64) {
        colors.clear();
    }

    colors.set(color, value);

    return value;
}

function same(a: Shape[], b: Shape[]) {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0, n = a.length; i < n; i++) {
        let x = a[i],
            y = b[i];

        if (
            x.active !== y.active || x.ellipse !== y.ellipse || x.height !== y.height || x.id !== y.id
            || x.radius !== y.radius || x.rotation !== y.rotation || x.width !== y.width || x.x !== y.x || x.y !== y.y
        ) {
            return false;
        }
    }

    return true;
}

// Corner radius and turn from the element's own styles, so the clearing matches the corners and rotation drawn.
function style(element: Element): Style {
    let computed = getComputedStyle(element),
        corner = computed.borderTopLeftRadius,
        rotation = computed.rotate && computed.rotate !== 'none' ? angle(computed.rotate) : 0,
        transform = computed.transform;

    if (transform && transform !== 'none') {
        let m = transform.slice(transform.indexOf('(') + 1, -1).split(',');

        rotation += Math.atan2(parseFloat(m[1]), parseFloat(m[0])) * 180 / Math.PI;
    }

    if (corner.endsWith('%')) {
        let percent = parseFloat(corner);

        if (percent >= 50) {
            return { ellipse: true, radius: 0, rotation };
        }

        let { height, width } = element.getBoundingClientRect();

        return { ellipse: false, radius: Math.min(width, height) * percent / 100, rotation };
    }

    return { ellipse: false, radius: parseFloat(corner) || 0, rotation };
}


export default component(
    function(this, attributes: Attributes & Options & { state?: Options, worker?: string }, content) {
        let given: Options = {},
            rest: Attributes = {},
            state = attributes.state,
            url = attributes.worker;

        for (let key in attributes) {
            if (key === 'state' || key === 'worker') {
                continue;
            }

            if ((KEYS as string[]).includes(key)) {
                (given as Record<string, unknown>)[key] = attributes[key];
            }
            else {
                rest[key] = attributes[key];
            }
        }

        let bounds: DOMRect | null = null,
            canvas: HTMLCanvasElement | undefined,
            elements: Element[] | null = null,
            field: Field | null = null,
            // Bumped when the worker fails, so the template renders a fresh canvas the page can draw on again.
            generation = signal(0),
            host: HTMLElement | undefined,
            last = { accent: '', camera: null as Camera | null, color: '', shapes: [] as Shape[], size: '' },
            // Ends everything a connection listens to and observes, presses still held included.
            listening: AbortController | undefined,
            measuring = 0,
            relink = true,
            resizer: Observer | undefined,
            running = 0,
            settle = 0,
            shown = true,
            styles = new WeakMap<Element, Style>();

        function box() {
            return bounds ??= host!.getBoundingClientRect();
        }

        function collect() {
            elements = Array.from(host!.querySelectorAll(SELECTOR));
            resizer?.disconnect();
            resizer?.observe(host!);

            for (let i = 0, n = elements.length; i < n; i++) {
                resizer?.observe(elements[i]);
            }

            return elements;
        }

        function curve(from: string | undefined, to: string | undefined) {
            let a = last.shapes.find((shape) => shape.id && shape.id === from),
                b = last.shapes.find((shape) => shape.id && shape.id === to),
                points: number[] = [];

            if (!a || !b) {
                return points;
            }

            // Leaves and arrives along the dominant axis, the way a connector between two cards does.
            let dx = b.x - a.x,
                dy = b.y - a.y,
                across = Math.abs(dx) >= Math.abs(dy),
                c1x = across ? a.x + dx / 2 : a.x,
                c1y = across ? a.y : a.y + dy / 2,
                c2x = across ? b.x - dx / 2 : b.x,
                c2y = across ? b.y : b.y - dy / 2;

            for (let i = 0; i <= 32; i++) {
                let t = i / 32,
                    u = 1 - t;

                points.push(
                    u * u * u * a.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * b.x,
                    u * u * u * a.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * b.y
                );
            }

            return points;
        }

        function measure() {
            measuring = 0;

            if (!host || !field) {
                return;
            }

            let changed = false,
                height = host.clientHeight,
                width = host.clientWidth,
                dpr = Math.min(2, devicePixelRatio || 1),
                size = `${width} ${height} ${dpr}`;

            bounds = host.getBoundingClientRect();

            if (size !== last.size) {
                changed = true;
                field.resize(width, height, dpr);
                last.size = size;
            }

            let list = elements ?? collect(),
                shapes: Shape[] = [];

            for (let i = 0, n = list.length; i < n; i++) {
                let element = list[i],
                    r = element.getBoundingClientRect();

                if (!r.width || !r.height) {
                    continue;
                }

                let s = styles.get(element);

                if (!s) {
                    s = style(element);
                    styles.set(element, s);
                }

                // Layout size is the box before any transform; the rendered box tells how far it has been scaled.
                let turn = s.rotation * Math.PI / 180,
                    cos = Math.abs(Math.cos(turn)),
                    sin = Math.abs(Math.sin(turn)),
                    w = (element as HTMLElement).offsetWidth || r.width,
                    h = (element as HTMLElement).offsetHeight || r.height,
                    scale = r.width / (w * cos + h * sin) || 1;

                shapes.push({
                    active: element.classList.contains('--active'),
                    ellipse: s.ellipse,
                    height: h * scale,
                    id: element.getAttribute('data-surface-field') ?? '',
                    radius: s.radius * scale,
                    rotation: s.rotation,
                    width: w * scale,
                    x: r.left - bounds.left + r.width / 2,
                    y: r.top - bounds.top + r.height / 2
                });
            }

            if (!same(shapes, last.shapes)) {
                changed = relink = true;
                field.surfaces(shapes);
                last.shapes = shapes;
            }

            let camera = read('camera');

            if (camera) {
                if (!last.camera || last.camera.x !== camera.x || last.camera.y !== camera.y || last.camera.zoom !== camera.zoom) {
                    changed = relink = true;
                    last.camera = { x: camera.x, y: camera.y, zoom: camera.zoom };
                    field.camera(last.camera);
                }
            }
            else if (last.camera) {
                changed = relink = true;
                last.camera = null;
                field.camera(null);
            }

            if (relink) {
                relink = false;
                field.links(paths());
            }

            field.flush();

            // Keeps following for a frame after the last change, and for as long as a transition or animation runs.
            if (changed || running > 0) {
                settle = 0;
                schedule();
            }
            else if (++settle < 2) {
                schedule();
            }
        }

        function paths() {
            let links = read('links'),
                camera = last.camera,
                result: Path[] = [];

            if (!links) {
                return result;
            }

            for (let i = 0, n = links.length; i < n; i++) {
                let link = links[i],
                    points: number[] = [];

                if (link.points && link.points.length >= 2) {
                    for (let j = 0, m = link.points.length; j < m; j++) {
                        let p = link.points[j];

                        points.push(
                            camera ? p.x * camera.zoom + camera.x : p.x,
                            camera ? p.y * camera.zoom + camera.y : p.y
                        );
                    }
                }
                else {
                    points = curve(link.from, link.to);
                }

                if (points.length >= 4) {
                    result.push({ motion: link.motion ?? 'still', points, speed: link.speed ?? 0, width: link.width ?? 0 });
                }
            }

            return result;
        }

        function page() {
            shown = !document.hidden;
            field?.visible(shown);
        }

        function read<K extends keyof Options>(key: K): Required<Options>[K] {
            return (state?.[key] ?? given[key] ?? DEFAULTS[key]) as Required<Options>[K];
        }

        function recolor() {
            if (!canvas || !field) {
                return;
            }

            let computed = getComputedStyle(canvas),
                accent = read('accent') || computed.accentColor,
                color = computed.color;

            if (accent === last.accent && color === last.color) {
                return;
            }

            last.accent = accent;
            last.color = color;
            field.recolor(rgb(color), rgb(accent));
        }

        // Draws off the main thread: the canvas goes to a worker, and every call is queued and posted once per task.
        function remote(element: HTMLCanvasElement, script: string): Field {
            let calls: Call[] = [],
                channel = new MessageChannel(),
                queued = false,
                workers = pool<Actions>(script, { limit: 1 }),
                task = workers().attach(element.transferControlToOffscreen(), channel.port2),
                proxy = {} as Record<keyof Field, unknown> as Field;

            function flush() {
                queued = false;

                if (calls.length) {
                    channel.port1.postMessage(calls);
                    calls = [];
                }
            }

            for (let i = 0, n = METHODS.length; i < n; i++) {
                let name = METHODS[i];

                (proxy as Record<string, unknown>)[name] = (...args: unknown[]) => {
                    calls.push([name, args]);

                    if (!queued) {
                        queued = true;
                        queueMicrotask(flush);
                    }
                };
            }

            proxy.dispose = () => {
                flush();
                task.dispatch('release');
                channel.port1.close();
                void workers.shutdown();
            };
            proxy.flush = flush;

            // A worker that fails to start or dies hands the drawing back to the page, on a fresh canvas since the
            // old one now belongs to the worker; the fresh canvas starts the engine once it connects.
            task.catch(() => {
                if (field !== proxy) {
                    return;
                }

                channel.port1.close();
                void workers.shutdown();
                field = null;
                write(generation, generation.value + 1);
            });

            return proxy;
        }

        function schedule() {
            if (!measuring && host) {
                measuring = requestAnimationFrame(measure);
            }
        }

        function settings() {
            let snapshot = {} as Settings;

            for (let i = 0, n = SETTINGS.length; i < n; i++) {
                let key = SETTINGS[i];

                (snapshot as Record<string, unknown>)[key] = read(key);
            }

            // Or held still by the CSS, under reduced motion say.
            snapshot.still ||= !!canvas && parseFloat(getComputedStyle(canvas).getPropertyValue('--still')) > 0;

            return snapshot;
        }

        // Sends everything a new engine needs, from nothing.
        function sync() {
            if (!field) {
                return;
            }

            last = { accent: '', camera: null, color: '', shapes: [], size: '' };
            relink = true;
            field.configure(settings());
            field.visible(shown);
            recolor();
            measure();
        }

        function viewport() {
            bounds = null;
            schedule();
        }

        let disposers = [
            effect(() => {
                let next = settings();

                untrack(() => field?.configure(next));
            }),
            effect(() => {
                read('accent');
                untrack(recolor);
            }),
            // Read deeply so reactive cameras and links are tracked; the next measure picks up what changed.
            effect(() => {
                let camera = read('camera'),
                    links = read('links');

                if (camera) {
                    void (camera.x + camera.y + camera.zoom);
                }

                void JSON.stringify(links);
                untrack(() => {
                    relink = true;
                    schedule();
                });
            }),
            effect(() => {
                let ripple = read('ripple');

                if (ripple) {
                    let { x, y } = ripple;

                    untrack(() => field?.ripple(x, y));
                }
            })
        ];

        onCleanup(() => {
            for (let i = 0, n = disposers.length; i < n; i++) {
                disposers[i]();
            }
        });

        return html`
            <div
                class='surface-field'
                ${this?.attributes}
                ${rest}
                ${{
                    onconnect: (element: HTMLElement) => {
                        if (!canvas) {
                            return;
                        }

                        host = element;
                        field = url && typeof Worker === 'function' && 'transferControlToOffscreen' in canvas
                            ? remote(canvas, url)
                            : engine(canvas, scheduler());

                        listening = new AbortController();

                        let done = (event: Event) => {
                                if (event.type === 'transitionrun' || event.type === 'animationstart') {
                                    running++;
                                }
                                else {
                                    running = Math.max(0, running - 1);
                                }

                                schedule();
                            },
                            intersection = observeIntersection(element, (entries) => {
                                shown = entries[entries.length - 1].isIntersecting && !document.hidden;
                                field?.visible(shown);
                            }),
                            // Surfaces are followed through the writes that move them, not by polling layout.
                            mutation = new MutationObserver((records) => {
                                for (let i = 0, n = records.length; i < n; i++) {
                                    let record = records[i];

                                    if (record.type === 'childList' || record.attributeName === 'data-surface-field') {
                                        elements = null;
                                    }
                                    else if (record.target === element) {
                                        recolor();
                                    }

                                    styles.delete(record.target as Element);
                                }

                                schedule();
                            }),
                            signal = listening.signal,
                            theme = new MutationObserver(() => {
                                styles = new WeakMap();
                                recolor();
                                schedule();
                            });

                        resizer = observer(() => schedule());
                        mutation.observe(element, {
                            attributeFilter: ['class', 'data-surface-field', 'style'],
                            characterData: true,
                            childList: true,
                            subtree: true
                        });
                        theme.observe(document.documentElement, { attributes: true });

                        // Hear every descendant's motion, including events with their own template handler.
                        for (let type of ['animationcancel', 'animationend', 'animationstart', 'transitioncancel', 'transitionend', 'transitionrun']) {
                            element.addEventListener(type, done, { signal });
                        }

                        element.addEventListener('scroll', viewport, { capture: true, passive: true, signal });
                        matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor, { signal });
                        window.addEventListener('scroll', () => {
                            bounds = null;
                        }, { capture: true, passive: true, signal });
                        signal.addEventListener('abort', () => {
                            intersection();
                            mutation.disconnect();
                            resizer?.disconnect();
                            theme.disconnect();
                        }, { once: true });

                        collect();
                        sync();
                    },
                    ondisconnect: () => {
                        listening?.abort();
                        listening = undefined;
                        cancelAnimationFrame(measuring);
                        measuring = 0;
                        field?.dispose();
                        field = null;
                        host = undefined;
                    },
                    ondocumentvisibilitychange: page,
                    onpointerdown: (event: PointerEvent) => {
                        if (!field || !host) {
                            return;
                        }

                        let b = box(),
                            id = event.pointerId,
                            x = event.clientX - b.left,
                            y = event.clientY - b.top;

                        field.pointer(id, x, y, true);

                        if (event.button !== 0 || (event.target as Element).closest?.(SELECTOR)) {
                            return;
                        }

                        // The ring holds while pressed, so the release is heard wherever it happens.
                        let finish = (e: PointerEvent) => {
                            if (e.pointerId !== id) {
                                return;
                            }

                            if (e.type === 'pointercancel') {
                                field?.cancel(id);
                            }
                            else {
                                field?.release(id);
                            }

                            window.removeEventListener('pointercancel', finish);
                            window.removeEventListener('pointerup', finish);
                        };

                        field.press(id, x, y);
                        window.addEventListener('pointercancel', finish, { signal: listening?.signal });
                        window.addEventListener('pointerup', finish, { signal: listening?.signal });
                    },
                    onpointerleave: (event: PointerEvent) => {
                        field?.pointer(event.pointerId, 0, 0, false);
                    },
                    onpointermove: (event: PointerEvent) => {
                        if (!field || !host) {
                            return;
                        }

                        let b = box();

                        field.pointer(event.pointerId, event.clientX - b.left, event.clientY - b.top, true);
                    },
                    onwindowresize: viewport
                }}
            >
                ${() => {
                    get(generation);

                    return html`
                        <canvas
                            aria-hidden='true'
                            class='surface-field-canvas'
                            ${{
                                onconnect: (element: HTMLCanvasElement) => {
                                    canvas = element;

                                    // A replacement after the worker failed; the first canvas is started by the host.
                                    if (host && !field) {
                                        field = engine(element, scheduler());
                                        sync();
                                    }
                                },
                                // Its CSS transitions '--still' alone, so a change to it is heard here.
                                ontransitionend: (e: TransitionEvent) => {
                                    if (e.propertyName === '--still') {
                                        field?.configure(settings());
                                    }
                                }
                            }}
                        ></canvas>
                    `;
                }}
                <div class='surface-field-content'>${content}</div>
            </div>
        `;
    },
    { surface }
);
