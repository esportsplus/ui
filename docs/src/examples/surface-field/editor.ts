import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { surfaceField } from '@esportsplus/ui/components';


type Camera = { x: number, y: number, zoom: number };

type Geometry = { height: number, title: string, width: number, x: number, y: number };

type Node = { id: string, kind: string, state: Geometry };


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

// Drawn by the field itself; the live ones send a crest along the way data flows.
const LINKS: { from: string, motion?: 'loop', to: string }[] = [
    { from: 'fetch', to: 'parse' },
    { from: 'fetch', motion: 'loop', to: 'validate' },
    { from: 'parse', to: 'merge' },
    { from: 'validate', to: 'merge' },
    { from: 'merge', to: 'render' },
    { from: 'merge', motion: 'loop', to: 'cache' },
    { from: 'merge', to: 'notify' }
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

function percent(value: number, total: number) {
    return `${(value / total) * 100}%`;
}


export default function editor(settings: Parameters<typeof surfaceField>[0]['state']) {
    let camera: Camera = { x: 0, y: 0, zoom: 1 },
        glide = 0,
        nodes: Record<string, Node> = {},
        pan: { pointerX: number, pointerY: number, x: number, y: number } | null = null,
        // What the world and the minimap's lens draw: the camera, and the viewport it looks through.
        view = reactive({ height: 0, panning: false, width: 0, x: 0, y: 0, zoom: 1 }),
        viewport: HTMLElement | undefined;

    for (let [id, kind, title, x, y] of NODES) {
        nodes[id] = { id, kind, state: reactive({ height: NODE_HEIGHT, title, width: NODE_WIDTH, x, y }) };
    }

    // The field reads the camera object itself; the world and the lens follow it through 'view'.
    function update() {
        if (!viewport) {
            return;
        }

        view.height = viewport.clientHeight;
        view.width = viewport.clientWidth;
        view.x = camera.x;
        view.y = camera.y;
        view.zoom = camera.zoom;
    }

    function animate(to: Camera, instant = false) {
        cancelAnimationFrame(glide);

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

    return surfaceField({ camera, class: 'surface-field-demo-stage surface-field-demo-stage--stacked', links: LINKS, state: settings }, html`
        <div
            aria-label='Node canvas: drag the background or use the arrow keys to pan, plus and minus to zoom'
            class='surface-field-editor'
            role='application'
            tabindex='0'
            ${{
                class: () => view.panning && '--panning',
                onactivewheel: wheel,
                onconnect: (element: HTMLElement) => {
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
                ${Object.values(nodes).map((node) => surfaceField.surface(
                    {
                        bounded: false,
                        class: 'surface-field-editor-node',
                        editable: true,
                        minHeight: 64,
                        minWidth: 120,
                        name: node.id,
                        state: node.state
                    },
                    html`<small class='surface-field-editor-node-kind'>${node.kind}</small>`
                ))}
            </div>
        </div>

        <div
            aria-label='Minimap: click to move the view there'
            class='surface-field-editor-minimap'
            role='button'
            ${{
                onclick: (event: MouseEvent) => {
                    if (!viewport) {
                        return;
                    }

                    let bounds = (event.currentTarget as HTMLElement).getBoundingClientRect(),
                        x = MAP.x + (event.clientX - bounds.left) / bounds.width * MAP.width,
                        y = MAP.y + (event.clientY - bounds.top) / bounds.height * MAP.height;

                    animate({
                        x: viewport.clientWidth / 2 - x * camera.zoom,
                        y: viewport.clientHeight / 2 - y * camera.zoom,
                        zoom: camera.zoom
                    });
                }
            }}
        >
            ${Object.values(nodes).map(({ state }) => html`
                <span
                    class='surface-field-editor-minimap-node'
                    style='${() => `height: ${percent(state.height, MAP.height)}; left: ${percent(state.x - MAP.x, MAP.width)}; top: ${percent(state.y - MAP.y, MAP.height)}; width: ${percent(state.width, MAP.width)};`}'
                ></span>
            `)}
            <span
                class='surface-field-editor-lens'
                style='${() => !!view.width && `height: ${percent(view.height / view.zoom, MAP.height)}; left: ${percent(-view.x / view.zoom - MAP.x, MAP.width)}; top: ${percent(-view.y / view.zoom - MAP.y, MAP.height)}; width: ${percent(view.width / view.zoom, MAP.width)};`}'
            ></span>
        </div>

        <div class='surface-field-editor-controls'>
            <button aria-label='Zoom in' class='surface-field-editor-control' type='button' ${{ onclick: () => zoomCentre(1.25) }}>
                <svg class='surface-field-editor-control-icon' fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='1.75' viewBox='0 0 24 24'><path d='M12 5v14M5 12h14' /></svg>
            </button>
            <button aria-label='Zoom out' class='surface-field-editor-control' type='button' ${{ onclick: () => zoomCentre(0.8) }}>
                <svg class='surface-field-editor-control-icon' fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='1.75' viewBox='0 0 24 24'><path d='M5 12h14' /></svg>
            </button>
            <button aria-label='Fit view' class='surface-field-editor-control' type='button' ${{ onclick: () => fit() }}>
                <svg class='surface-field-editor-control-icon' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.75' viewBox='0 0 24 24'><path d='M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4' /></svg>
            </button>
        </div>
    `);
}
