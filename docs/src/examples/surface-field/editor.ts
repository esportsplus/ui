import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { icon, surfaceField } from '@esportsplus/ui/components';
import fitSvg from '@esportsplus/ui/svg/fit.svg';
import minus from '@esportsplus/ui/svg/minus.svg';
import plus from '@esportsplus/ui/svg/plus.svg';


type Camera = { x: number, y: number, zoom: number };

// A port, or the end of a link being drawn, and the way a connector leaves or enters it.
type End = { dx: number, dy: number, x: number, y: number };

type Geometry = { height: number, rotation: number, title: string, width: number, x: number, y: number };

type Link = { from: string, motion: 'loop' | 'still', readonly points: Point[], sequence: string, to: string };

type Node = { id: string, kind: string, state: Geometry };

type Point = { x: number, y: number };


// [id, kind, title, x, y] in world px.
const NODES: [string, string, string, number, number][] = [
    ['fetch', 'Source', 'Fetch feed', 0, 130],
    ['parse', 'Parser', 'Parse items', 210, 40],
    ['validate', 'Schema', 'Validate', 210, 220],
    ['merge', 'Stage', 'Merge', 420, 130],
    ['render', 'Output', 'Render pages', 630, 10],
    ['cache', 'Store', 'Warm cache', 630, 130],
    ['notify', 'Alert', 'Notify team', 630, 250]
];

// [from, to, sequence], drawn port to port as edges with the field's own channel lit under each. The links of a
// sequence carry one wave through them in list order, the way data flows from the feed to the cache.
const LINKS: [string, string, string][] = [
    ['fetch', 'parse', ''],
    ['fetch', 'validate', 'flow'],
    ['parse', 'merge', ''],
    ['validate', 'merge', 'flow'],
    ['merge', 'render', ''],
    ['merge', 'cache', 'flow'],
    ['merge', 'notify', '']
];

const NODE_HEIGHT = 72;

const NODE_WIDTH = 164;

// World area the minimap shows: the starting layout with room to spare around it.
const MAP = { height: 660, width: 1200, x: -215, y: -170 };

const ZOOM_MAX = 2;

const ZOOM_MIN = 0.35;


function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

// A connector between two ends as cubic control points, leaving and entering along each port's own direction and
// bowing out so a target behind the source still reads as joined.
function connector(from: End, to: End) {
    let bow = Math.max(40, Math.abs(to.x - from.x) / 2);

    return [from.x, from.y, from.x + from.dx * bow, from.y + from.dy * bow, to.x + to.dx * bow, to.y + to.dy * bow, to.x, to.y];
}

function edge(from: End, to: End) {
    let [x1, y1, c1x, c1y, c2x, c2y, x2, y2] = connector(from, to);

    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
}

function percent(value: number, total: number) {
    return `${(value / total) * 100}%`;
}

// A card's port on the right (1) or left (-1), turned with the card.
function port(geometry: Geometry, side: 1 | -1): End {
    let turn = geometry.rotation * Math.PI / 180,
        dx = Math.cos(turn) * side,
        dy = Math.sin(turn) * side;

    return {
        dx,
        dy,
        x: geometry.x + geometry.width / 2 + dx * geometry.width / 2,
        y: geometry.y + geometry.height / 2 + dy * geometry.width / 2
    };
}

// The connector as a polyline in world px, so the field lights its channel right under the drawn edge.
function sample(from: End, to: End) {
    let [x1, y1, c1x, c1y, c2x, c2y, x2, y2] = connector(from, to),
        points: { x: number, y: number }[] = [];

    for (let i = 0; i <= 24; i++) {
        let t = i / 24,
            u = 1 - t;

        points.push({
            x: u * u * u * x1 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x2,
            y: u * u * u * y1 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y2
        });
    }

    return points;
}


export default function editor(settings: Parameters<typeof surfaceField>[0]['state']) {
    let camera: Camera = { x: 0, y: 0, zoom: 1 },
        glide = 0,
        nodes: Record<string, Node> = {},
        pan: { pointerX: number, pointerY: number, x: number, y: number } | null = null,
        // The link being drawn out of a card's port, to the hand.
        pending = reactive({ from: '', x: 0, y: 0 }),
        // A minimap drag: where the view's centre sits from the hand, in world px, and the minimap's box.
        scrub: { bounds: DOMRect, x: number, y: number } | null = null,
        // What the world and the minimap's lens draw: the camera, and the viewport it looks through.
        view = reactive({ height: 0, panning: false, scrubbing: false, width: 0, x: 0, y: 0, zoom: 1 }),
        viewport: HTMLElement | undefined;

    for (let [id, kind, title, x, y] of NODES) {
        nodes[id] = { id, kind, state: reactive({ height: NODE_HEIGHT, rotation: 0, title, width: NODE_WIDTH, x, y }) };
    }

    let links = reactive(LINKS.map(([from, to, sequence]) => link(from, to, sequence)));

    function animate(to: Camera, instant = false) {
        cancelAnimationFrame(glide);
        measure();

        if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) {
            Object.assign(camera, to);
            update();
            return;
        }

        let from = { ...camera },
            start = performance.now();

        let step = (now: number) => {
            let t = Math.min(1, (now - start) / 320),
                e = 1 - Math.pow(1 - t, 3);

            camera.x = from.x + (to.x - from.x) * e;
            camera.y = from.y + (to.y - from.y) * e;
            camera.zoom = from.zoom + (to.zoom - from.zoom) * e;
            update();

            if (t < 1) {
                glide = requestAnimationFrame(step);
            }
        };

        glide = requestAnimationFrame(step);
    }

    // Puts a world point at the middle of the viewport.
    function centre(x: number, y: number, instant: boolean) {
        if (viewport) {
            animate({ x: viewport.clientWidth / 2 - x * camera.zoom, y: viewport.clientHeight / 2 - y * camera.zoom, zoom: camera.zoom }, instant);
        }
    }

    function connect(from: string, to: string) {
        if (!links.some((l) => l.from === from && l.to === to)) {
            links.push(link(from, to, ''));
        }
    }

    function fit(instant = false) {
        if (!viewport) {
            return;
        }

        let bottom = -Infinity,
            left = Infinity,
            right = -Infinity,
            top = Infinity;

        for (let id in nodes) {
            let s = nodes[id].state;

            bottom = Math.max(bottom, s.y + s.height);
            left = Math.min(left, s.x);
            right = Math.max(right, s.x + s.width);
            top = Math.min(top, s.y);
        }

        let padding = 32,
            w = viewport.clientWidth,
            h = viewport.clientHeight,
            zoom = clamp(Math.min((w - padding * 2) / (right - left), (h - padding * 2) / (bottom - top)), ZOOM_MIN, 1.25);

        animate({
            x: (w - (right - left) * zoom) / 2 - left * zoom,
            y: (h - (bottom - top) * zoom) / 2 - top * zoom,
            zoom
        }, instant);
    }

    // The field re-reads each path whenever a card moves, resizes or turns, so the channel follows the edge.
    function link(from: string, to: string, sequence: string): Link {
        return {
            from,
            motion: sequence ? 'loop' : 'still',
            get points() {
                return sample(port(nodes[from].state, 1), port(nodes[to].state, -1));
            },
            sequence,
            to
        };
    }

    // The world point under the pointer on the minimap.
    function mapped(event: PointerEvent, bounds: DOMRect) {
        return {
            x: MAP.x + (event.clientX - bounds.left) / bounds.width * MAP.width,
            y: MAP.y + (event.clientY - bounds.top) / bounds.height * MAP.height
        };
    }

    // Measured once per gesture or glide, not per frame, so pan moves and glide steps don't force layout.
    function measure() {
        if (!viewport) {
            return;
        }

        view.height = viewport.clientHeight;
        view.width = viewport.clientWidth;
    }

    // The field reads the camera object itself; the world and the lens follow it through 'view'.
    function update() {
        view.x = camera.x;
        view.y = camera.y;
        view.zoom = camera.zoom;
    }

    // Zooms about a point in viewport px so whatever sits under it stays put.
    function zoomAt(factor: number, px: number, py: number, instant = true) {
        let zoom = clamp(camera.zoom * factor, ZOOM_MIN, ZOOM_MAX),
            k = zoom / camera.zoom;

        animate({ x: px - (px - camera.x) * k, y: py - (py - camera.y) * k, zoom }, instant);
    }

    function zoomCentre(factor: number) {
        if (viewport) {
            zoomAt(factor, viewport.clientWidth / 2, viewport.clientHeight / 2, false);
        }
    }

    let wheel = (event: WheelEvent) => {
        if (!viewport) {
            return;
        }

        event.preventDefault();

        let bounds = viewport.getBoundingClientRect();

        cancelAnimationFrame(glide);
        // Pinch gestures arrive as ctrl + wheel with small deltas, so they get a steeper curve.
        zoomAt(Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015)), event.clientX - bounds.left, event.clientY - bounds.top);
    };

    return surfaceField({ camera, class: 'surface-field-demo-stage surface-field-demo-stage--stacked', links, state: settings }, html`
        <div
            aria-label='Node canvas: drag the background or use the arrow keys to pan, plus and minus to zoom'
            class='surface-field-editor'
            role='application'
            tabindex='0'
            ${{
                class: () => view.panning && '--panning',
                onconnect: (element: HTMLElement, on) => {
                    on(element, 'wheel', wheel, { direct: true, passive: false });
                    viewport = element;
                    requestAnimationFrame(() => fit(true));
                },
                ondisconnect: () => {
                    cancelAnimationFrame(glide);
                },
                onkeydown: (event: KeyboardEvent) => {
                    if (event.target !== event.currentTarget) {
                        return;
                    }

                    let step = event.shiftKey ? 160 : 48;

                    switch (event.key) {
                        case '+':
                        case '=':
                            zoomCentre(1.25);
                            break;
                        case '-':
                            zoomCentre(0.8);
                            break;
                        case '0':
                            fit();
                            break;
                        case 'ArrowDown':
                            animate({ ...camera, y: camera.y - step });
                            break;
                        case 'ArrowLeft':
                            animate({ ...camera, x: camera.x + step });
                            break;
                        case 'ArrowRight':
                            animate({ ...camera, x: camera.x - step });
                            break;
                        case 'ArrowUp':
                            animate({ ...camera, y: camera.y + step });
                            break;
                        default:
                            return;
                    }

                    event.preventDefault();
                },
                onlostpointercapture: () => {
                    pan = null;
                    view.panning = false;
                },
                onpointerdown: (event: PointerEvent) => {
                    if (event.button !== 0 || (event.target as Element).closest('.surface-field-surface')) {
                        return;
                    }

                    cancelAnimationFrame(glide);
                    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
                    measure();
                    pan = { pointerX: event.clientX, pointerY: event.clientY, x: camera.x, y: camera.y };
                    view.panning = true;
                },
                onpointermove: (event: PointerEvent) => {
                    if (!pan) {
                        return;
                    }

                    camera.x = pan.x + event.clientX - pan.pointerX;
                    camera.y = pan.y + event.clientY - pan.pointerY;
                    update();
                }
            }}
        >
            <div
                class='surface-field-editor-world'
                style='${() => `transform: translate(${view.x}px, ${view.y}px) scale(${view.zoom})`}'
            >
                ${html.reactive(links, (l) => html`
                    <svg aria-hidden='true' class='surface-field-editor-edge'>
                        <path d='${() => edge(port(nodes[l.from].state, 1), port(nodes[l.to].state, -1))}' />
                    </svg>
                `)}
                <svg
                    aria-hidden='true'
                    class='surface-field-editor-edge surface-field-editor-edge--pending'
                    ${{ class: () => !pending.from && '--hidden' }}
                >
                    <path d='${() => pending.from ? edge(port(nodes[pending.from].state, 1), { dx: 0, dy: 0, x: pending.x, y: pending.y }) : ''}' />
                </svg>
                ${Object.values(nodes).map((node) => surfaceField.surface(
                    {
                        bounded: false,
                        class: 'surface-field-editor-node',
                        editable: true,
                        minHeight: 64,
                        minWidth: 120,
                        name: node.id,
                        onlink: (to: string) => connect(node.id, to),
                        onlinking: (point: Point | null) => {
                            pending.from = point ? node.id : '';

                            if (point) {
                                pending.x = point.x;
                                pending.y = point.y;
                            }
                        },
                        ports: true,
                        state: node.state
                    },
                    html`<small class='surface-field-editor-node-kind'>${node.kind}</small>`
                ))}
            </div>
        </div>

        <div
            aria-label='Minimap: click to move the view there, or drag the view'
            class='surface-field-editor-minimap'
            role='button'
            ${{
                class: () => view.scrubbing && '--active',
                onlostpointercapture: () => {
                    scrub = null;
                    view.scrubbing = false;
                },
                onpointerdown: (event: PointerEvent) => {
                    if (event.button !== 0 || !viewport) {
                        return;
                    }

                    let element = event.currentTarget as HTMLElement,
                        bounds = element.getBoundingClientRect(),
                        { x, y } = mapped(event, bounds),
                        zoom = camera.zoom;

                    cancelAnimationFrame(glide);
                    measure();
                    element.setPointerCapture(event.pointerId);
                    view.scrubbing = true;

                    let left = -camera.x / zoom,
                        top = -camera.y / zoom,
                        width = view.width / zoom,
                        height = view.height / zoom;

                    // Pressed inside the view, the view is held where it was taken; anywhere else it glides over to
                    // centre on the press, and the drag carries on from there.
                    if (x >= left && x <= left + width && y >= top && y <= top + height) {
                        scrub = { bounds, x: left + width / 2 - x, y: top + height / 2 - y };
                    }
                    else {
                        scrub = { bounds, x: 0, y: 0 };
                        centre(x, y, false);
                    }
                },
                onpointermove: (event: PointerEvent) => {
                    if (!scrub) {
                        return;
                    }

                    let { x, y } = mapped(event, scrub.bounds);

                    centre(x + scrub.x, y + scrub.y, true);
                }
            }}
        >
            ${Object.values(nodes).map(({ state }) => html`
                <span
                    class='surface-field-editor-minimap-node'
                    style='${() => `height: ${percent(state.height, MAP.height)}; left: ${percent(state.x - MAP.x, MAP.width)}; top: ${percent(state.y - MAP.y, MAP.height)}; rotate: ${state.rotation}deg; width: ${percent(state.width, MAP.width)};`}'
                ></span>
            `)}
            <span
                class='surface-field-editor-lens'
                style='${() => !!view.width && `height: ${percent(view.height / view.zoom, MAP.height)}; left: ${percent(-view.x / view.zoom - MAP.x, MAP.width)}; top: ${percent(-view.y / view.zoom - MAP.y, MAP.height)}; width: ${percent(view.width / view.zoom, MAP.width)};`}'
            ></span>
        </div>

        <div class='surface-field-editor-controls'>
            <button aria-label='Zoom in' class='surface-field-editor-control' type='button' ${{ onclick: () => zoomCentre(1.25) }}>
                ${icon({ 'aria-hidden': 'true', class: 'surface-field-editor-control-icon' }, plus)}
            </button>
            <button aria-label='Zoom out' class='surface-field-editor-control' type='button' ${{ onclick: () => zoomCentre(0.8) }}>
                ${icon({ 'aria-hidden': 'true', class: 'surface-field-editor-control-icon' }, minus)}
            </button>
            <button aria-label='Fit view' class='surface-field-editor-control' type='button' ${{ onclick: () => fit() }}>
                ${icon({ 'aria-hidden': 'true', class: 'surface-field-editor-control-icon' }, fitSvg)}
            </button>
        </div>
    `);
}
