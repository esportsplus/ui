import { component, html, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


// Maps world space onto the field: screen = world * zoom + (x, y). Read every frame, so mutating the same object pans
// and zooms the grid without a re-render.
type Camera = { x: number, y: number, zoom: number };

type Options = {
    // Colour the lit dots and lines drift toward, blended in by `tint`.
    accent?: string;
    // Resting opacity of an unlit dot.
    base?: number;
    // 0 – 1: how deeply idle dots pulse in and out.
    breathe?: number;
    // 0 – 1: peak opacity the light lifts lines to; dots rise proportionally higher.
    brightness?: number;
    // Anchors the grid to a pannable, zoomable world (for example a node editor's viewport) instead of centring it.
    camera?: Camera | null;
    // Draw grid lines between neighbouring dots where the light reaches.
    connected?: boolean;
    // Distance between dots in px (world units when a camera is set).
    gap?: number;
    // Radius of the pointer light's line reach in px.
    lineRadius?: number;
    // How far dots under the pointer are nudged away, in px.
    pointerPush?: number;
    // Radius of the pointer light in px.
    radius?: number;
    // How far a click's ripple displaces the dots it passes, in px.
    ripplePush?: number;
    // Render a static texture: no pointer light, ripples, breathing or wandering.
    still?: boolean;
    // Widens (positive) or narrows (negative) the empty band around each surface, in px.
    surfacePadding?: number;
    // 0 – 1: how far lit dots and lines blend toward `accent`.
    tint?: number;
    // Let the light drift on its own while the pointer is away.
    wander?: boolean;
};

type Rect = { bottom: number, left: number, right: number, top: number };

type Ripple = { born: number, x: number, y: number };

type Geometry = { height: number, width: number, x: number, y: number };

type Surface = Attributes & {
    // Keep the surface inside its parent. Turn off for surfaces in an unbounded world such as a pannable canvas.
    bounded?: boolean;
    height?: number;
    // Names the surface in its move and resize controls' accessible labels.
    label?: string;
    minHeight?: number;
    minWidth?: number;
    // Seeds the geometry and receives every move and resize, so edges or a minimap can follow the surface.
    state?: Geometry;
    width?: number;
    x?: number;
    y?: number;
};


const ALPHA_LEVELS = 32;

const DEFAULTS: Required<Options> = {
    accent: '#6683e8',
    base: 0.14,
    breathe: 0,
    brightness: 0.2,
    camera: null,
    connected: true,
    gap: 22,
    lineRadius: 200,
    pointerPush: 2,
    radius: 250,
    ripplePush: 6,
    still: false,
    surfacePadding: 0,
    tint: 0,
    wander: false
};

// Pointer absence, in ms, before a wandering light takes over.
const IDLE = 1500;

const KEYS = Object.keys(DEFAULTS) as (keyof Options)[];

// Share of a surface's halo added to the light around it.
const HALO = 0.75;

const RIPPLE_LIFE = 1.4;

const RIPPLE_SPEED = 520;

const RIPPLE_WIDTH = 36;

// Elements the field clears a space around and lights up.
const SELECTOR = '.surface-field-surface, [data-surface-field]';

const TAU = Math.PI * 2;

const TINT_LEVELS = 5;


let colors = new Map<string, [number, number, number]>(),
    probe: CanvasRenderingContext2D | null = null,
    z = 1;


function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function falloff(distance: number, radius: number) {
    if (radius <= 0 || distance >= radius) {
        return 0;
    }

    let t = distance / radius;

    return (1 - t * t) * (1 - t * t);
}

// Resolves any CSS colour (oklch, named, hex…) to rgb by painting it once.
function rgb(color: string) {
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
        value: [number, number, number] = [data[0], data[1], data[2]];

    if (colors.size > 64) {
        colors.clear();
    }

    colors.set(color, value);

    return value;
}


const surface = component<Surface>(
    function(this, { bounded = true, height = 160, label = 'surface', minHeight = 72, minWidth = 120, state, width = 240, x = 0, y = 0, ...attributes }, content) {
        let element: HTMLElement | undefined,
            start: { h: number, pointerX: number, pointerY: number, scale: number, w: number, x: number, y: number } | null = null;

        if (state) {
            ({ height, width, x, y } = state);
        }

        // Written straight to the element: the field reads this geometry every frame, so a reactive binding would
        // leave the grid a frame behind the drag.
        function apply() {
            if (!element) {
                return;
            }

            let parent = element.parentElement;

            width = Math.max(minWidth, width);
            height = Math.max(minHeight, height);

            if (bounded && parent) {
                let pw = parent.clientWidth,
                    ph = parent.clientHeight;

                width = clamp(width, minWidth, Math.max(minWidth, pw));
                height = clamp(height, minHeight, Math.max(minHeight, ph));
                x = clamp(x, 0, Math.max(0, pw - width));
                y = clamp(y, 0, Math.max(0, ph - height));
            }

            element.style.height = `${height}px`;
            element.style.translate = `${x}px ${y}px`;
            element.style.width = `${width}px`;

            if (state && (state.height !== height || state.width !== width || state.x !== x || state.y !== y)) {
                state.height = height;
                state.width = width;
                state.x = x;
                state.y = y;
            }
        }

        function begin(event: PointerEvent) {
            if (event.button !== 0 || !element) {
                return;
            }

            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
            element.classList.add('--active');
            element.style.zIndex = String(++z);
            // Inside a zoomed world the pointer travels in screen px; dividing by the rendered scale keeps the surface
            // under the cursor.
            start = {
                h: height,
                pointerX: event.clientX,
                pointerY: event.clientY,
                scale: element.getBoundingClientRect().width / element.offsetWidth || 1,
                w: width,
                x,
                y
            };
        }

        function end() {
            element?.classList.remove('--active');
            start = null;
        }

        function nudge(event: KeyboardEvent, resize: boolean) {
            let step = event.shiftKey ? 32 : 8,
                dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
                dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;

            if (!dx && !dy) {
                return;
            }

            event.preventDefault();

            if (resize) {
                width += dx;
                height += dy;
            }
            else {
                x += dx;
                y += dy;
            }

            apply();
        }

        return html`
            <div
                class='surface-field-surface'
                ${this?.attributes}
                ${attributes}
                ${{
                    onconnect: (el: HTMLElement) => {
                        element = el;
                        apply();
                    }
                }}
            >
                <button
                    aria-label='${`Move ${label} surface with arrow keys`}'
                    class='surface-field-surface-handle'
                    type='button'
                    ${{
                        onkeydown: (event: KeyboardEvent) => nudge(event, false),
                        onlostpointercapture: end,
                        onpointerdown: begin,
                        onpointermove: (event: PointerEvent) => {
                            if (!start) {
                                return;
                            }

                            x = start.x + (event.clientX - start.pointerX) / start.scale;
                            y = start.y + (event.clientY - start.pointerY) / start.scale;
                            apply();
                        }
                    }}
                ></button>
                <div class='surface-field-surface-content'>${content}</div>
                <button
                    aria-label='${`Resize ${label} surface with arrow keys; right and down make it larger`}'
                    class='surface-field-surface-resize'
                    type='button'
                    ${{
                        onkeydown: (event: KeyboardEvent) => nudge(event, true),
                        onlostpointercapture: end,
                        onpointerdown: begin,
                        onpointermove: (event: PointerEvent) => {
                            if (!start) {
                                return;
                            }

                            width = start.w + (event.clientX - start.pointerX) / start.scale;
                            height = start.h + (event.clientY - start.pointerY) / start.scale;
                            apply();
                        }
                    }}
                ></button>
            </div>
        `;
    }
);


export default Object.assign(
    component<Attributes & Options & { state?: Options }>(
        function(this, attributes, content) {
            let given: Options = {},
                rest: Attributes = {},
                state = attributes.state;

            for (let key in attributes) {
                if (key === 'state') {
                    continue;
                }

                if ((KEYS as string[]).includes(key)) {
                    (given as Record<string, unknown>)[key] = attributes[key];
                }
                else {
                    rest[key] = attributes[key];
                }
            }

            let canvas: HTMLCanvasElement | undefined,
                context: CanvasRenderingContext2D | null = null,
                frame = 0,
                host: HTMLElement | undefined,
                key = '',
                last = 0,
                light = { intensity: 0, x: 0, y: 0 },
                reduced = matchMedia('(prefers-reduced-motion: reduce)'),
                observer: IntersectionObserver | undefined,
                pointer = { at: -Infinity, inside: false, x: 0, y: 0 },
                ripples: Ripple[] = [],
                size = { dpr: 0, height: 0, width: 0 },
                visible = false;

            // Grid buffers, regrown only when the dot count rises.
            let bucket = new Uint16Array(0),
                dotAlpha = new Float32Array(0),
                dotLight = new Float32Array(0),
                lineLight = new Float32Array(0),
                order = new Uint32Array(0),
                px = new Float32Array(0),
                py = new Float32Array(0),
                segment = new Uint32Array(0),
                segmentBucket = new Uint16Array(0),
                segmentOrder = new Uint32Array(0),
                seed = new Float32Array(0);

            function options() {
                let snapshot = {} as Required<Options>;

                for (let i = 0, n = KEYS.length; i < n; i++) {
                    let k = KEYS[i];

                    (snapshot as Record<string, unknown>)[k] = state?.[k] ?? given[k] ?? DEFAULTS[k];
                }

                // Copied so the frame works from (and compares against) the values of this moment, not a live object.
                let camera = snapshot.camera;

                if (camera) {
                    snapshot.camera = { x: camera.x, y: camera.y, zoom: camera.zoom };
                }

                return snapshot;
            }

            function grow(n: number) {
                if (px.length >= n) {
                    return;
                }

                bucket = new Uint16Array(n);
                dotAlpha = new Float32Array(n);
                dotLight = new Float32Array(n);
                lineLight = new Float32Array(n);
                order = new Uint32Array(n);
                px = new Float32Array(n);
                py = new Float32Array(n);
                segment = new Uint32Array(n * 4);
                segmentBucket = new Uint16Array(n * 2);
                segmentOrder = new Uint32Array(n * 2);
                seed = new Float32Array(n);
            }

            function start() {
                if (!frame && visible && host?.isConnected) {
                    last = performance.now();
                    frame = requestAnimationFrame(tick);
                }
            }

            function stop() {
                cancelAnimationFrame(frame);
                frame = 0;
            }

            function tick(now: number) {
                frame = requestAnimationFrame(tick);

                if (!host || !canvas || !context) {
                    return;
                }

                let dt = Math.min(64, now - last) / 1000,
                    o = options(),
                    width = host.clientWidth,
                    height = host.clientHeight,
                    dpr = Math.min(2, devicePixelRatio || 1);

                last = now;

                if (width !== size.width || height !== size.height || dpr !== size.dpr) {
                    canvas.height = Math.max(1, Math.round(height * dpr));
                    canvas.width = Math.max(1, Math.round(width * dpr));
                    size = { dpr, height, width };
                    key = '';
                }

                // Surface geometry is read fresh each frame so a drag, a resize or a layout shift is followed at once.
                let bounds = host.getBoundingClientRect(),
                    elements = host.querySelectorAll(SELECTOR),
                    rects: Rect[] = [];

                for (let i = 0, n = elements.length; i < n; i++) {
                    let r = elements[i].getBoundingClientRect();

                    if (r.width && r.height) {
                        rects.push({
                            bottom: r.bottom - bounds.top,
                            left: r.left - bounds.left,
                            right: r.right - bounds.left,
                            top: r.top - bounds.top
                        });
                    }
                }

                let animate = !o.still && !reduced.matches,
                    intensity = 0,
                    target = { x: light.x, y: light.y },
                    wandering = false;

                if (animate && pointer.inside) {
                    intensity = 1;
                    target = { x: pointer.x, y: pointer.y };
                }
                else if (animate && o.wander && now - pointer.at > IDLE) {
                    let t = now / 1000;

                    intensity = 0.85;
                    target = {
                        x: width / 2 + Math.cos(t * 0.23) * width * 0.34 + Math.sin(t * 0.57) * width * 0.08,
                        y: height / 2 + Math.sin(t * 0.31) * height * 0.3 + Math.cos(t * 0.49) * height * 0.08
                    };
                    wandering = true;
                }

                // A light fading in from nothing starts where it is aimed rather than sweeping across from its last spot.
                if (light.intensity < 0.01 && intensity > 0) {
                    light.x = target.x;
                    light.y = target.y;
                }

                let follow = 1 - Math.exp(-dt * (wandering ? 2.5 : 16)),
                    fade = 1 - Math.exp(-dt * 6);

                light.intensity += (intensity - light.intensity) * fade;
                light.x += (target.x - light.x) * follow;
                light.y += (target.y - light.y) * follow;

                if (!animate) {
                    light.intensity = 0;
                    ripples.length = 0;
                }
                else if (ripples.length) {
                    ripples = ripples.filter((ripple) => (now - ripple.born) / 1000 < RIPPLE_LIFE);
                }

                let color = getComputedStyle(canvas).color,
                    settled = Math.abs(intensity - light.intensity) < 0.002
                        && (light.intensity < 0.002 || (Math.abs(target.x - light.x) < 0.1 && Math.abs(target.y - light.y) < 0.1)),
                    signature = JSON.stringify([o, color, rects, pointer.inside && animate ? [pointer.x, pointer.y] : 0]);

                // Nothing moving and nothing changed: the previous frame still stands.
                if (settled && !wandering && !ripples.length && !(animate && o.breathe > 0) && signature === key) {
                    return;
                }

                key = signature;
                draw(o, rects, color, animate ? now : 0, animate);
            }

            function draw(o: Required<Options>, rects: Rect[], color: string, now: number, animate: boolean) {
                let ctx = context!,
                    { dpr, height, width } = size,
                    camera = o.camera,
                    gap = Math.max(6, o.gap) * (camera ? Math.max(0.01, camera.zoom) : 1),
                    zoom = camera ? Math.max(0.01, camera.zoom) : 1;

                // Zoomed far out, every other row and column drops so the dots never crowd into a grey wash.
                while (gap < 8) {
                    gap *= 2;
                }

                let cols = Math.floor(width / gap) + 2,
                    rows = Math.floor(height / gap) + 2,
                    n = cols * rows,
                    // World index of the first column and row, so a dot keeps its identity (and its breathing phase)
                    // while the camera pans.
                    i0 = camera ? Math.floor(-camera.x / gap) : 0,
                    j0 = camera ? Math.floor(-camera.y / gap) : 0,
                    ox = camera ? camera.x + i0 * gap : (width - (cols - 1) * gap) / 2,
                    oy = camera ? camera.y + j0 * gap : (height - (rows - 1) * gap) / 2,
                    padding = o.surfacePadding * zoom,
                    clear = Math.max(2, gap * 0.8 + padding),
                    band = Math.max(clear + gap, gap * 3 + padding),
                    halo = band + gap * 1.5,
                    push = Math.min(o.radius, gap * 5),
                    peak = Math.min(1, o.brightness * 2.5),
                    time = now / 1000;

                grow(n);

                for (let j = 0; j < rows; j++) {
                    for (let i = 0; i < cols; i++) {
                        let k = j * cols + i,
                            x = ox + i * gap,
                            y = oy + j * gap,
                            glow = 0,
                            shown = 1;

                        seed[k] = ((Math.sin((i + i0) * 12.9898 + (j + j0) * 78.233) * 43758.5453) % 1 + 1) % 1;

                        // Each surface clears the dots it covers and squeezes the band around it outward, so the grid
                        // bends around the surface's edge and rounds off at its corners.
                        for (let r = 0, m = rects.length; r < m; r++) {
                            let rect = rects[r],
                                cx = clamp(x, rect.left, rect.right),
                                cy = clamp(y, rect.top, rect.bottom),
                                dx = x - cx,
                                dy = y - cy,
                                d = Math.sqrt(dx * dx + dy * dy);

                            if (d === 0) {
                                shown = 0;
                                break;
                            }

                            if (d < halo) {
                                glow = Math.max(glow, 1 - d / halo);
                            }

                            if (d < band) {
                                let scale = (clear + d * (band - clear) / band) / d;

                                x = cx + dx * scale;
                                y = cy + dy * scale;
                            }
                        }

                        let dot = glow * glow * HALO,
                            line = dot;

                        if (shown && light.intensity > 0.001) {
                            let dx = x - light.x,
                                dy = y - light.y,
                                d = Math.sqrt(dx * dx + dy * dy);

                            dot += falloff(d, o.radius) * light.intensity;
                            line += falloff(d, o.lineRadius) * light.intensity;

                            if (pointer.inside && o.pointerPush && d > 0.001 && d < push) {
                                let s = o.pointerPush * (1 - d / push) * (1 - d / push) * light.intensity / d;

                                x += dx * s;
                                y += dy * s;
                            }
                        }

                        for (let r = 0, m = shown ? ripples.length : 0; r < m; r++) {
                            let ripple = ripples[r],
                                age = (now - ripple.born) / 1000,
                                dx = x - ripple.x,
                                dy = y - ripple.y,
                                d = Math.sqrt(dx * dx + dy * dy),
                                life = 1 - age / RIPPLE_LIFE,
                                wave = (d - age * RIPPLE_SPEED) / RIPPLE_WIDTH,
                                strength = Math.exp(-wave * wave) * life * life;

                            if (d > 0.001) {
                                x += dx / d * o.ripplePush * strength;
                                y += dy / d * o.ripplePush * strength;
                            }

                            dot += strength * 0.8;
                            line += strength * 0.6;
                        }

                        let breath = animate && o.breathe > 0
                            ? 1 - o.breathe * 0.5 * (1 + Math.sin(time * 1.3 + seed[k] * TAU))
                            : 1;

                        dot = Math.min(1, dot);
                        px[k] = x;
                        py[k] = y;
                        dotLight[k] = dot;
                        dotAlpha[k] = shown * breath * (o.base + (peak - o.base) * Math.max(0, dot));
                        lineLight[k] = shown * Math.min(1, line);
                    }
                }

                let accent = rgb(o.accent),
                    base = rgb(color),
                    buckets = ALPHA_LEVELS * TINT_LEVELS,
                    counts = new Uint32Array(buckets + 1),
                    fills: string[] = [],
                    tint = clamp(o.tint, 0, 1);

                for (let t = 0; t < TINT_LEVELS; t++) {
                    let mix = tint * t / (TINT_LEVELS - 1);

                    fills[t] = `rgb(${
                        Math.round(base[0] + (accent[0] - base[0]) * mix)
                    } ${
                        Math.round(base[1] + (accent[1] - base[1]) * mix)
                    } ${
                        Math.round(base[2] + (accent[2] - base[2]) * mix)
                    })`;
                }

                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, width, height);

                // Lines and dots are bucketed by opacity and tint so each bucket draws as a single path.
                if (o.connected) {
                    let segments = 0;

                    for (let j = 0; j < rows; j++) {
                        for (let i = 0; i < cols; i++) {
                            let k = j * cols + i;

                            for (let neighbour of [i + 1 < cols ? k + 1 : -1, j + 1 < rows ? k + cols : -1]) {
                                if (neighbour < 0) {
                                    continue;
                                }

                                let lit = Math.min(lineLight[k], lineLight[neighbour]),
                                    alpha = Math.round(lit * o.brightness * (ALPHA_LEVELS - 1));

                                if (alpha < 1) {
                                    continue;
                                }

                                segment[segments * 2] = k;
                                segment[segments * 2 + 1] = neighbour;
                                segmentBucket[segments] = Math.round(lit * (TINT_LEVELS - 1)) * ALPHA_LEVELS + Math.min(alpha, ALPHA_LEVELS - 1);
                                counts[segmentBucket[segments] + 1]++;
                                segments++;
                            }
                        }
                    }

                    sort(counts, segmentBucket, segmentOrder, segments);
                    ctx.lineWidth = 1;

                    for (let b = 0; b < buckets; b++) {
                        let from = counts[b],
                            to = counts[b + 1];

                        if (from === to) {
                            continue;
                        }

                        ctx.beginPath();

                        for (let s = from; s < to; s++) {
                            let a = segment[segmentOrder[s] * 2],
                                c = segment[segmentOrder[s] * 2 + 1];

                            ctx.moveTo(px[a], py[a]);
                            ctx.lineTo(px[c], py[c]);
                        }

                        ctx.globalAlpha = (b % ALPHA_LEVELS) / (ALPHA_LEVELS - 1);
                        ctx.strokeStyle = fills[Math.floor(b / ALPHA_LEVELS)];
                        ctx.stroke();
                    }

                    counts.fill(0);
                }

                let dots = 0;

                for (let k = 0; k < n; k++) {
                    let alpha = Math.round(dotAlpha[k] * (ALPHA_LEVELS - 1));

                    if (alpha < 1) {
                        bucket[k] = buckets;
                        continue;
                    }

                    bucket[k] = Math.round(dotLight[k] * (TINT_LEVELS - 1)) * ALPHA_LEVELS + Math.min(alpha, ALPHA_LEVELS - 1);
                    counts[bucket[k] + 1]++;
                    dots++;
                }

                sort(counts, bucket, order, n);

                for (let b = 0; b < buckets; b++) {
                    let from = counts[b],
                        to = counts[b + 1];

                    if (from === to) {
                        continue;
                    }

                    let r = 0.85 + 0.45 * Math.floor(b / ALPHA_LEVELS) / (TINT_LEVELS - 1);

                    ctx.beginPath();

                    for (let s = from; s < to; s++) {
                        let k = order[s];

                        ctx.moveTo(px[k] + r, py[k]);
                        ctx.arc(px[k], py[k], r, 0, TAU);
                    }

                    ctx.globalAlpha = (b % ALPHA_LEVELS) / (ALPHA_LEVELS - 1);
                    ctx.fillStyle = fills[Math.floor(b / ALPHA_LEVELS)];
                    ctx.fill();
                }

                ctx.globalAlpha = 1;
            }

            // Counting sort: `counts` holds per-bucket tallies offset by one and becomes each bucket's start index.
            function sort(counts: Uint32Array, keys: Uint16Array, into: Uint32Array, n: number) {
                for (let b = 1, m = counts.length; b < m; b++) {
                    counts[b] += counts[b - 1];
                }

                let cursor = counts.slice();

                for (let i = 0; i < n; i++) {
                    if (keys[i] < counts.length - 1) {
                        into[cursor[keys[i]]++] = i;
                    }
                }
            }

            function track(event: PointerEvent) {
                if (!host) {
                    return;
                }

                let bounds = host.getBoundingClientRect();

                pointer.at = performance.now();
                pointer.inside = true;
                pointer.x = event.clientX - bounds.left;
                pointer.y = event.clientY - bounds.top;
            }

            return html`
                <div
                    class='surface-field'
                    ${this?.attributes}
                    ${rest}
                    ${{
                        onconnect: (element: HTMLElement) => {
                            host = element;
                            canvas = element.querySelector('.surface-field-canvas') as HTMLCanvasElement;
                            context = canvas.getContext('2d');
                            observer = new IntersectionObserver((entries) => {
                                visible = entries[entries.length - 1].isIntersecting;

                                if (visible) {
                                    start();
                                }
                                else {
                                    stop();
                                }
                            });
                            observer.observe(element);
                        },
                        ondisconnect: () => {
                            observer?.disconnect();
                            stop();
                        },
                        onpointerdown: (event: PointerEvent) => {
                            track(event);

                            if (event.button !== 0 || (event.target as Element).closest?.(SELECTOR)) {
                                return;
                            }

                            ripples.push({ born: performance.now(), x: pointer.x, y: pointer.y });

                            if (ripples.length > 6) {
                                ripples.shift();
                            }
                        },
                        onpointerleave: () => {
                            pointer.at = performance.now();
                            pointer.inside = false;
                        },
                        onpointermove: track
                    }}
                >
                    <canvas aria-hidden='true' class='surface-field-canvas'></canvas>
                    <div class='surface-field-content'>${content}</div>
                </div>
            `;
        }
    ),
    { surface }
);
