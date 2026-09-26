import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { surfaceField } from '@esportsplus/ui';


type Camera = { x: number, y: number, zoom: number };

type Geometry = { height: number, width: number, x: number, y: number };

type Node = { id: string, kind: string, state: Geometry, title: string };


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

// [from, to, dashed]
const EDGES: [string, string, boolean][] = [
    ['fetch', 'parse', false],
    ['fetch', 'validate', true],
    ['parse', 'merge', false],
    ['validate', 'merge', false],
    ['merge', 'render', false],
    ['merge', 'cache', true],
    ['merge', 'notify', false]
];

const NODE_HEIGHT = 64;

const NODE_WIDTH = 140;

// World area the minimap shows: the starting layout with room to spare around it.
const MAP = { height: 660, width: 1200, x: -215, y: -170 };

const ZOOM_MAX = 2;

const ZOOM_MIN = 0.35;


function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

// Right-angle connector from a's right edge to b's left edge, with softened corners.
function connector(a: Geometry, b: Geometry) {
    let x1 = a.x + a.width,
        y1 = a.y + a.height / 2,
        x2 = b.x,
        y2 = b.y + b.height / 2,
        mx = (x1 + x2) / 2,
        dy = y2 - y1;

    if (Math.abs(dy) < 1) {
        return `M${x1} ${y1}H${x2}`;
    }

    let sx = Math.sign(x2 - x1) || 1,
        sy = Math.sign(dy),
        r = Math.min(10, Math.abs(dy) / 2, Math.abs(mx - x1));

    return `M${x1} ${y1}H${mx - sx * r}Q${mx} ${y1} ${mx} ${y1 + sy * r}V${y2 - sy * r}Q${mx} ${y2} ${mx + sx * r} ${y2}H${x2}`;
}

function percent(value: number, total: number) {
    return `${(value / total) * 100}%`;
}


export default function editor(settings: Parameters<typeof surfaceField>[0]['state']) {
    let camera: Camera = { x: 0, y: 0, zoom: 1 },
        glide = 0,
        lens: HTMLElement | undefined,
        nodes: Record<string, Node> = {},
        pan: { pointerX: number, pointerY: number, x: number, y: number } | null = null,
        release: VoidFunction | undefined,
        viewport: HTMLElement | undefined,
        world: HTMLElement | undefined;

    for (let [id, kind, title, x, y] of NODES) {
        nodes[id] = { id, kind, state: reactive({ height: NODE_HEIGHT, width: NODE_WIDTH, x, y }), title };
    }

    function edges(dashed: boolean) {
        let d = '';

        for (let [from, to, style] of EDGES) {
            if (style === dashed) {
                d += connector(nodes[from].state, nodes[to].state);
            }
        }

        return d;
    }

    // Written straight to the elements: the field reads the same camera object on its next frame, and a reactive
    // binding would land a frame later, letting the cards drift off the grid mid-pan.
    function update() {
        if (!lens || !viewport || !world) {
            return;
        }

        world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
        lens.style.height = percent(viewport.clientHeight / camera.zoom, MAP.height);
        lens.style.left = percent(-camera.x / camera.zoom - MAP.x, MAP.width);
        lens.style.top = percent(-camera.y / camera.zoom - MAP.y, MAP.height);
        lens.style.width = percent(viewport.clientWidth / camera.zoom, MAP.width);
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

    return surfaceField({ camera, class: 'surface-field-demo-stage', state: settings }, html`
        <div
            aria-label='Node canvas: drag the background or use the arrow keys to pan, plus and minus to zoom'
            class='surface-field-editor'
            role='application'
            tabindex='0'
            ${{
                onconnect: (element: HTMLElement) => {
                    viewport = element;
                    world = element.querySelector('.surface-field-editor-world') as HTMLElement;
                    lens = element.parentElement!.querySelector('.surface-field-editor-lens') as HTMLElement;
                    // Delegated wheel listeners are passive, so bind directly to be able to stop the page scrolling.
                    element.addEventListener('wheel', wheel, { passive: false });
                    release = () => element.removeEventListener('wheel', wheel);
                    requestAnimationFrame(() => fit(true));
                },
                ondisconnect: () => {
                    cancelAnimationFrame(glide);
                    release?.();
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
                onlostpointercapture: (event: PointerEvent) => {
                    (event.currentTarget as HTMLElement).classList.remove('--panning');
                    pan = null;
                },
                onpointerdown: (event: PointerEvent) => {
                    if (event.button !== 0 || (event.target as Element).closest('.surface-field-surface')) {
                        return;
                    }

                    let element = event.currentTarget as HTMLElement;

                    cancelAnimationFrame(glide);
                    element.classList.add('--panning');
                    element.setPointerCapture(event.pointerId);
                    pan = { pointerX: event.clientX, pointerY: event.clientY, x: camera.x, y: camera.y };
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
            <div class='surface-field-editor-world'>
                <svg aria-hidden='true' class='surface-field-editor-edges' height='1' width='1'>
                    <path d='${() => edges(false)}' />
                    <path class='--dashed' d='${() => edges(true)}' />
                </svg>
                ${Object.values(nodes).map((node) => surfaceField.surface(
                    { bounded: false, class: 'surface-field-editor-node', label: node.title, minHeight: 56, minWidth: 120, state: node.state },
                    html`
                        <small>${node.kind}</small>
                        <b>${node.title}</b>
                    `
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
            <span class='surface-field-editor-lens'></span>
        </div>

        <div class='surface-field-editor-controls'>
            <button aria-label='Zoom in' type='button' ${{ onclick: () => zoomCentre(1.25) }}>
                <svg fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='1.75' viewBox='0 0 24 24'><path d='M12 5v14M5 12h14' /></svg>
            </button>
            <button aria-label='Zoom out' type='button' ${{ onclick: () => zoomCentre(0.8) }}>
                <svg fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='1.75' viewBox='0 0 24 24'><path d='M5 12h14' /></svg>
            </button>
            <button aria-label='Fit view' type='button' ${{ onclick: () => fit() }}>
                <svg fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.75' viewBox='0 0 24 24'><path d='M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4' /></svg>
            </button>
        </div>
    `);
}
