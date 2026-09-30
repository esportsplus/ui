// The field's renderer. It touches no DOM, so the same code draws on the main thread or, through an OffscreenCanvas,
// inside a worker; everything it knows about the page arrives through its methods, all structured-clone safe.


type Box = { bottom: number, left: number, right: number, top: number };

// Maps world space onto the field: screen = world * zoom + (x, y).
type Camera = { x: number, y: number, zoom: number };

type Geo = Box & {
    active: boolean;
    cos: number;
    cx: number;
    cy: number;
    ellipse: boolean;
    hx: number;
    hy: number;
    id: string;
    r: number;
    sin: number;
};

// `x` and `y` centre the first drawn dot, one step beyond the top-left edge; `col` and `row` are its floor index.
type Lattice = { col: number, gap: number, row: number, scale: number, step: number, x: number, y: number };

type Link = {
    motion: 'bounce' | 'loop' | 'still';
    // Flattened x, y pairs in field px.
    points: number[];
    speed: number;
    width: number;
};

type Path = {
    along: Float64Array;
    box: Box;
    crest: number;
    length: number;
    motion: 0 | 1 | 2;
    push: number;
    sigma: number;
    speed: number;
    spread: number;
    xs: Float64Array;
    ys: Float64Array;
};

type Ring = { born: number, gain: number, held: boolean, id: number, life: number, shape: Geo | null, x: number, y: number };

type Rgb = [number, number, number];

type Scheduler = {
    cancel(handle: number): void;
    clear(handle: number): void;
    frame(callback: () => void): number;
    now(): number;
    timer(callback: () => void, ms: number): number;
};

type Settings = {
    base: number;
    breathe: number;
    brightness: number;
    connected: boolean;
    gap: number;
    lineRadius: number;
    pointerPush: number;
    radius: number;
    ripplePush: number;
    still: boolean;
    surfacePadding: number;
    tint: number;
    wander: boolean;
};

// Centre, unrotated size and turn of a surface in field px, as layout reports it.
type Shape = {
    active: boolean;
    ellipse: boolean;
    height: number;
    id: string;
    radius: number;
    rotation: number;
    width: number;
    x: number;
    y: number;
};


const ALPHA_LEVELS = 32;

// Breath is slow enough that 22 frames a second reads as continuous; every vsync between would draw nothing new.
const BREATH_FRAME = 45;

// Share of a surface's halo added to the light around it; a carried surface gets all of it.
const HALO = 0.75;

// Pointer absence, in ms, before a wandering light takes over.
const IDLE = 1500;

const LINK_CREST = 44;

const LINK_FRAME = 40;

const LINK_LIFT = 0.55;

const LINK_SPEED = 160;

const LINK_WIDTH = 16;

// The floor under a camera scales by zoom ^ 0.4 within these bounds, so it reads as a plane below the content rather
// than a sticker on it, and never crowds into a wash or thins into scattered points.
const PARALLAX = { exponent: 0.4, max: 1.6, min: 0.7 };

const RIPPLE_LIFE = 1400;

// A press ring swells for this long, then holds until the press lets go.
const RIPPLE_RISE = 90;

const RIPPLE_SPEED = 0.52;

const RIPPLE_WIDTH = 36;

const RINGS = 6;

// A timed frame due within half a vsync is taken now, rather than spending a whole extra frame to reach it.
const SLACK = 8;

const TAU = Math.PI * 2;

const TINT_LEVELS = 5;

const BUCKETS = ALPHA_LEVELS * TINT_LEVELS;

// A canvas keeps every buffer it drew through until it is resized; after this long at rest it is, to hand them back.
const TRIM = 4000;

const ZOOM_WAVE = { gain: 0.4, interval: 250, life: 1000 };


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

// Hashing a dot's floor index gives it the same breathing phase every frame and wherever the camera takes it.
function hash(a: number, b: number) {
    let h = (a * 374761393 + b * 668265263) | 0;

    h = Math.imul(h ^ (h >>> 13), 1274126177);

    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Brings the dot centred at `centre` with floor index `index` to the first drawn one, whose centre sits in
// (-step, 0].
function axis(centre: number, step: number, index: number): [number, number] {
    let cells = Math.floor(centre / step) + 1,
        origin = centre - cells * step;

    if (origin <= -step) {
        origin += step;
        cells -= 1;
    }
    else if (origin > 0) {
        origin -= step;
        cells += 1;
    }

    return [origin, index - cells];
}

function parallax(zoom: number) {
    return clamp(zoom ** PARALLAX.exponent, PARALLAX.min, PARALLAX.max);
}

function overlaps(a: Box, b: Box) {
    return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function geo(shape: Shape): Geo {
    let angle = (shape.rotation % 360) * Math.PI / 180,
        cos = Math.cos(angle),
        sin = Math.sin(angle),
        hx = shape.width / 2,
        hy = shape.height / 2,
        ex = shape.ellipse ? Math.sqrt(hx * hx * cos * cos + hy * hy * sin * sin) : Math.abs(cos) * hx + Math.abs(sin) * hy,
        ey = shape.ellipse ? Math.sqrt(hx * hx * sin * sin + hy * hy * cos * cos) : Math.abs(sin) * hx + Math.abs(cos) * hy;

    return {
        active: shape.active,
        bottom: shape.y + ey,
        cos,
        cx: shape.x,
        cy: shape.y,
        ellipse: shape.ellipse,
        hx,
        hy,
        id: shape.id,
        left: shape.x - ex,
        r: shape.ellipse ? 0 : clamp(shape.radius, 0, Math.min(hx, hy)),
        right: shape.x + ex,
        sin,
        top: shape.y - ey
    };
}

// Thins a polyline to the points that bend it by more than half a pixel, so a densely sampled straight edge costs
// two points.
function simplify(points: number[]) {
    let n = points.length / 2,
        keep = new Uint8Array(n),
        stack: number[] = [0, n - 1],
        xs: number[] = [],
        ys: number[] = [];

    keep[0] = keep[n - 1] = 1;

    while (stack.length) {
        let i1 = stack.pop()!,
            i0 = stack.pop()!,
            ax = points[i0 * 2],
            ay = points[i0 * 2 + 1],
            sx = points[i1 * 2] - ax,
            sy = points[i1 * 2 + 1] - ay,
            length = Math.hypot(sx, sy) || 1,
            far = 0,
            at = -1;

        for (let i = i0 + 1; i < i1; i++) {
            let d = Math.abs((points[i * 2] - ax) * sy - (points[i * 2 + 1] - ay) * sx) / length;

            if (d > far) {
                far = d;
                at = i;
            }
        }

        if (far > 0.5 && at > 0) {
            keep[at] = 1;
            stack.push(i0, at, at, i1);
        }
    }

    for (let i = 0; i < n; i++) {
        if (keep[i]) {
            xs.push(points[i * 2]);
            ys.push(points[i * 2 + 1]);
        }
    }

    return { xs: Float64Array.from(xs), ys: Float64Array.from(ys) };
}


const engine = (canvas: HTMLCanvasElement | OffscreenCanvas, scheduler: Scheduler) => {
    // The field owns its canvas and never asks it for another kind of context, so 2d is always granted.
    let ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        accent: Rgb = [102, 131, 232],
        base: Rgb = [128, 128, 128],
        breathed = -Infinity,
        camera: Camera | null = null,
        cols = 0,
        crests: Box[] = [],
        damage: Box[] = [],
        fills: string[] = [],
        frame = 0,
        full = true,
        hand: { x: number, y: number } | null = null,
        lattice: Lattice | null = null,
        light = { box: null as Box | null, intensity: 0, x: 0, y: 0 },
        linked = -Infinity,
        now = scheduler.now(),
        o: Settings | null = null,
        painted = 0,
        paths: Path[] = [],
        pointer = { at: -Infinity, id: -1, inside: false, x: 0, y: 0 },
        rings: Ring[] = [],
        rows = 0,
        shapes: Geo[] = [],
        shown = true,
        size = { dpr: 1, height: 0, width: 0 },
        ticked = now,
        timer = 0,
        trim = 0,
        wave = -Infinity;

    // Grid buffers, regrown only when the dot count rises.
    let bucket = new Uint16Array(0),
        cells = new Uint32Array(0),
        counts = new Uint32Array(BUCKETS + 1),
        cursor = new Uint32Array(BUCKETS + 1),
        dotAlpha = new Float32Array(0),
        dotLight = new Float32Array(0),
        lineLight = new Float32Array(0),
        order = new Uint32Array(0),
        px = new Float32Array(0),
        py = new Float32Array(0),
        seed = new Float32Array(0),
        segment = new Uint32Array(0),
        segmentBucket = new Uint16Array(0),
        segmentOrder = new Uint32Array(0),
        visible = new Uint8Array(0);

    // Per-paint ring values, so each dot reads a radius instead of working it out.
    let prepared = Array.from({ length: RINGS }, () => ({ amp: 0, radius: 0, shape: null as Geo | null, x: 0, y: 0 })),
        preparedCount = 0;

    // Scratch outputs of `measure` and `nearest`, kept off the heap in the per-dot loop.
    let along = 0,
        gapX = 0,
        gapY = 0,
        offX = 0,
        offY = 0;

    function animated() {
        return !!o && !o.still;
    }

    function arm() {
        painted = now;

        if (!trim) {
            trim = scheduler.timer(release, TRIM);
        }
    }

    function breathing() {
        return animated() && o!.breathe > 0;
    }

    function build(link: Link): Path | null {
        if (link.points.length < 4) {
            return null;
        }

        let { xs, ys } = simplify(link.points),
            n = xs.length,
            distance = new Float64Array(n),
            box = { bottom: ys[0], left: xs[0], right: xs[0], top: ys[0] };

        for (let i = 1; i < n; i++) {
            distance[i] = distance[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
            box.bottom = Math.max(box.bottom, ys[i]);
            box.left = Math.min(box.left, xs[i]);
            box.right = Math.max(box.right, xs[i]);
            box.top = Math.min(box.top, ys[i]);
        }

        let length = distance[n - 1];

        if (length < 1) {
            return null;
        }

        let step = lattice?.step ?? o!.gap,
            width = link.width > 0 ? link.width : LINK_WIDTH,
            sigma = width / 2,
            spread = Math.max(sigma, step),
            push = Math.min(width / 3, step / 5),
            pad = 3 * spread + push + step * 2;

        return {
            along: distance,
            box: { bottom: box.bottom + pad, left: box.left - pad, right: box.right + pad, top: box.top - pad },
            crest: -Infinity,
            length,
            motion: link.motion === 'loop' ? 1 : link.motion === 'bounce' ? 2 : 0,
            push,
            sigma,
            speed: link.speed > 0 ? link.speed : LINK_SPEED,
            spread,
            xs,
            ys
        };
    }

    function crestBox(path: Path): Box | null {
        let reach = 2.5 * LINK_CREST,
            lo = path.crest - reach,
            hi = path.crest + reach,
            box = { bottom: -Infinity, left: Infinity, right: -Infinity, top: Infinity };

        for (let i = 0, n = path.xs.length - 1; i < n; i++) {
            let a0 = path.along[i],
                a1 = path.along[i + 1];

            if (a1 < lo || a0 > hi || a1 <= a0) {
                continue;
            }

            for (let u of [Math.max(0, (lo - a0) / (a1 - a0)), Math.min(1, (hi - a0) / (a1 - a0))]) {
                let x = path.xs[i] + (path.xs[i + 1] - path.xs[i]) * u,
                    y = path.ys[i] + (path.ys[i + 1] - path.ys[i]) * u;

                box.bottom = Math.max(box.bottom, y);
                box.left = Math.min(box.left, x);
                box.right = Math.max(box.right, x);
                box.top = Math.min(box.top, y);
            }
        }

        if (box.left > box.right) {
            return null;
        }

        return pad(box, 3 * path.spread + path.push + (lattice?.step ?? 0) * 2);
    }

    function draw(c0: number, c1: number, r0: number, r1: number) {
        let settings = o!,
            { step, x: lx, y: ly } = lattice!,
            padding = settings.surfacePadding,
            clear = Math.max(2, step * 0.8 + padding),
            band = Math.max(clear + step, step * 3 + padding),
            halo = band + step * 1.5,
            push = Math.min(settings.radius, step * 5),
            peak = Math.min(1, settings.brightness * 2.5),
            time = now / 1000,
            breathe = breathing() ? settings.breathe : 0,
            lit = light.intensity > 0.001,
            m = 0;

        for (let j = r0; j < r1; j++) {
            for (let i = c0; i < c1; i++) {
                let k = j * cols + i,
                    x = lx + i * step,
                    y = ly + j * step,
                    dot = 0,
                    glow = 0,
                    line = 0,
                    shown = 1;

                cells[m++] = k;

                // Each surface clears the dots it covers and squeezes the band around it outward, so the grid bends
                // around its edge and follows its corners.
                for (let s = 0, n = shapes.length; s < n; s++) {
                    let shape = shapes[s];

                    if (x < shape.left - halo || x > shape.right + halo || y < shape.top - halo || y > shape.bottom + halo) {
                        continue;
                    }

                    let d = measure(x, y, shape);

                    if (d <= 0) {
                        shown = 0;
                        break;
                    }

                    if (d < halo) {
                        let g = 1 - d / halo;

                        glow = Math.max(glow, g * g * (shape.active ? 1 : HALO));
                    }

                    if (d < band) {
                        let scale = (clear + d * (band - clear) / band) / d - 1;

                        x += gapX * scale;
                        y += gapY * scale;
                    }
                }

                dot = glow;
                line = glow;

                if (shown) {
                    for (let p = 0, n = paths.length; p < n; p++) {
                        let path = paths[p],
                            box = path.box;

                        if (x < box.left || x > box.right || y < box.top || y > box.bottom) {
                            continue;
                        }

                        let d2 = nearest(x, y, path),
                            w2 = path.spread * path.spread;

                        if (d2 > 9 * w2) {
                            continue;
                        }

                        let moving = path.motion !== 0 && path.crest !== -Infinity,
                            pulse = 0,
                            reach = 3 * path.sigma;

                        if (moving) {
                            let off = along - path.crest;

                            pulse = Math.exp(-(off * off) / (2 * LINK_CREST * LINK_CREST));
                        }

                        if (d2 < reach * reach) {
                            let t = 1 - Math.sqrt(d2) / reach,
                                vein = t * t * (3 - 2 * t) * (moving ? 0.45 + 0.55 * pulse : 0.8);

                            dot = Math.max(dot, vein);
                            line = Math.max(line, vein);
                        }

                        dot += Math.exp(-d2 / (2 * path.sigma * path.sigma))
                            * (moving ? LINK_LIFT / 3 + (1 - LINK_LIFT / 3) * pulse : LINK_LIFT) * 0.5;

                        // The fabric parts a little either side of the vein, so the lattice bends round it.
                        if (d2 > 0.0001) {
                            let s = path.push * Math.exp(0.5 - d2 / (2 * w2)) / path.spread;

                            x += offX * s;
                            y += offY * s;
                        }
                    }
                }

                if (shown && lit) {
                    let dx = x - light.x,
                        dy = y - light.y,
                        d = Math.sqrt(dx * dx + dy * dy);

                    dot += falloff(d, settings.radius) * light.intensity;
                    line += falloff(d, settings.lineRadius) * light.intensity;

                    if (pointer.inside && settings.pointerPush && d > 0.001 && d < push) {
                        let s = settings.pointerPush * (1 - d / push) * (1 - d / push) * light.intensity / d;

                        x += dx * s;
                        y += dy * s;
                    }
                }

                for (let r = 0, n = shown ? preparedCount : 0; r < n; r++) {
                    let ring = prepared[r],
                        dx = x - ring.x,
                        dy = y - ring.y,
                        d = 0;

                    if (ring.shape) {
                        d = measure(x, y, ring.shape);

                        if (d <= 0) {
                            continue;
                        }

                        dx = gapX;
                        dy = gapY;
                    }
                    else {
                        d = Math.sqrt(dx * dx + dy * dy);
                    }

                    let w = (d - ring.radius) / RIPPLE_WIDTH;

                    if (w > 4 || w < -4) {
                        continue;
                    }

                    let strength = Math.exp(-w * w) * ring.amp;

                    if (d > 0.001) {
                        x += dx / d * settings.ripplePush * strength;
                        y += dy / d * settings.ripplePush * strength;
                    }

                    dot += strength * 0.8;
                    line += strength * 0.6;
                }

                let breath = breathe
                    ? 1 - breathe * 0.5 * (1 + Math.sin(time * 1.3 + seed[k] * TAU))
                    : 1;

                dot = Math.min(1, dot);
                px[k] = x;
                py[k] = y;
                visible[k] = shown;
                dotLight[k] = dot;
                dotAlpha[k] = shown * breath * (settings.base + (peak - settings.base) * dot);
                lineLight[k] = shown * Math.min(1, line);
            }
        }

        // Lines and dots are bucketed by opacity and tint so each bucket draws as a single path.
        if (settings.connected) {
            let segments = 0;

            for (let j = r0; j < r1; j++) {
                for (let i = c0; i < c1; i++) {
                    let k = j * cols + i;

                    if (i + 1 < c1) {
                        segments = queue(k, k + 1, segments, settings.brightness);
                    }

                    if (j + 1 < r1) {
                        segments = queue(k, k + cols, segments, settings.brightness);
                    }
                }
            }

            sort(segmentBucket, segmentOrder, segments);
            ctx.lineWidth = 1;

            for (let b = 0; b < BUCKETS; b++) {
                let from = counts[b],
                    to = counts[b + 1];

                if (from === to) {
                    continue;
                }

                ctx.beginPath();

                for (let s = from; s < to; s++) {
                    let a = segment[segmentOrder[s] * 2],
                        c = segment[segmentOrder[s] * 2 + 1];

                    trace(a, c, step);
                }

                ctx.globalAlpha = (b % ALPHA_LEVELS) / (ALPHA_LEVELS - 1);
                ctx.strokeStyle = fills[Math.floor(b / ALPHA_LEVELS)];
                ctx.stroke();
            }
        }

        counts.fill(0);

        for (let s = 0; s < m; s++) {
            let k = cells[s],
                alpha = Math.round(dotAlpha[k] * (ALPHA_LEVELS - 1));

            if (alpha < 1) {
                bucket[s] = BUCKETS;
                continue;
            }

            bucket[s] = Math.round(dotLight[k] * (TINT_LEVELS - 1)) * ALPHA_LEVELS + Math.min(alpha, ALPHA_LEVELS - 1);
            counts[bucket[s] + 1]++;
        }

        sort(bucket, order, m);

        for (let b = 0; b < BUCKETS; b++) {
            let from = counts[b],
                to = counts[b + 1];

            if (from === to) {
                continue;
            }

            let r = 0.85 + 0.45 * Math.floor(b / ALPHA_LEVELS) / (TINT_LEVELS - 1);

            ctx.beginPath();

            for (let s = from; s < to; s++) {
                let k = cells[order[s]];

                ctx.moveTo(px[k] + r, py[k]);
                ctx.arc(px[k], py[k], r, 0, TAU);
            }

            ctx.globalAlpha = (b % ALPHA_LEVELS) / (ALPHA_LEVELS - 1);
            ctx.fillStyle = fills[Math.floor(b / ALPHA_LEVELS)];
            ctx.fill();
        }

        counts.fill(0);
        ctx.globalAlpha = 1;
    }

    function grow(n: number) {
        if (px.length >= n) {
            return;
        }

        bucket = new Uint16Array(n);
        cells = new Uint32Array(n);
        dotAlpha = new Float32Array(n);
        dotLight = new Float32Array(n);
        lineLight = new Float32Array(n);
        order = new Uint32Array(n);
        px = new Float32Array(n);
        py = new Float32Array(n);
        seed = new Float32Array(n);
        segment = new Uint32Array(n * 4);
        segmentBucket = new Uint16Array(n * 2);
        segmentOrder = new Uint32Array(n * 2);
        visible = new Uint8Array(n);
    }

    function layout() {
        if (!o || !size.width || !size.height) {
            return;
        }

        let gap = Math.max(6, o.gap),
            { height, width } = size;

        if (!camera) {
            let c = Math.floor(width / gap) + 2,
                r = Math.floor(height / gap) + 2;

            lattice = {
                col: 0,
                gap,
                row: 0,
                scale: 1,
                step: gap,
                x: (width - (c - 1) * gap) / 2,
                y: (height - (r - 1) * gap) / 2
            };
        }
        else if (!lattice || lattice.gap !== gap) {
            lattice = seeded(gap, camera);
        }

        let { step, x, y } = lattice!;

        cols = Math.floor((width - x) / step) + 2;
        rows = Math.floor((height - y) / step) + 2;
        grow(cols * rows);

        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                seed[j * cols + i] = hash(lattice!.col + i, lattice!.row + j);
            }
        }

        for (let i = 0, n = paths.length; i < n; i++) {
            paths[i].spread = Math.max(paths[i].sigma, step);
        }

        full = true;
    }

    // Distance from (x, y) to the shape's edge, or 0 inside it; `gapX`/`gapY` receive the offset from the nearest edge
    // point, which is the direction a dot is pushed.
    function measure(x: number, y: number, shape: Geo) {
        let dx = x - shape.cx,
            dy = y - shape.cy,
            qx = shape.cos * dx + shape.sin * dy,
            qy = shape.cos * dy - shape.sin * dx,
            d = 0,
            ex = 0,
            ey = 0;

        if (shape.ellipse) {
            let ux = qx / shape.hx,
                uy = qy / shape.hy,
                k0 = Math.sqrt(ux * ux + uy * uy),
                gx = ux / shape.hx,
                gy = uy / shape.hy,
                k1 = Math.sqrt(gx * gx + gy * gy);

            if (k0 <= 1 || k1 === 0) {
                return 0;
            }

            d = k0 * (k0 - 1) / k1;
            ex = gx / k1;
            ey = gy / k1;
        }
        else {
            let ix = shape.hx - shape.r,
                iy = shape.hy - shape.r,
                ox = qx > ix ? qx - ix : qx < -ix ? qx + ix : 0,
                oy = qy > iy ? qy - iy : qy < -iy ? qy + iy : 0,
                length = Math.sqrt(ox * ox + oy * oy);

            if (length <= shape.r) {
                return 0;
            }

            d = length - shape.r;
            ex = ox / length;
            ey = oy / length;
        }

        gapX = (shape.cos * ex - shape.sin * ey) * d;
        gapY = (shape.sin * ex + shape.cos * ey) * d;

        return d;
    }

    // Squared distance to the path; `along` receives how far along it the nearest point lies and `offX`/`offY` the
    // offset from that point.
    function nearest(x: number, y: number, path: Path) {
        let best = Infinity,
            { xs, ys } = path;

        for (let i = 0, n = xs.length - 1; i < n; i++) {
            let ax = xs[i],
                ay = ys[i],
                bx = xs[i + 1],
                by = ys[i + 1],
                gx = x < Math.min(ax, bx) ? Math.min(ax, bx) - x : x > Math.max(ax, bx) ? x - Math.max(ax, bx) : 0,
                gy = y < Math.min(ay, by) ? Math.min(ay, by) - y : y > Math.max(ay, by) ? y - Math.max(ay, by) : 0;

            if (gx * gx + gy * gy >= best) {
                continue;
            }

            let sx = bx - ax,
                sy = by - ay,
                length2 = sx * sx + sy * sy,
                u = length2 > 0 ? clamp(((x - ax) * sx + (y - ay) * sy) / length2, 0, 1) : 0,
                dx = x - (ax + sx * u),
                dy = y - (ay + sy * u),
                d2 = dx * dx + dy * dy;

            if (d2 < best) {
                along = path.along[i] + u * (path.along[i + 1] - path.along[i]);
                best = d2;
                offX = dx;
                offY = dy;
            }
        }

        return best;
    }

    function pad(box: Box, amount: number): Box {
        return { bottom: box.bottom + amount, left: box.left - amount, right: box.right + amount, top: box.top - amount };
    }

    function paint(boxes: Box[] | null) {
        if (!o || !lattice) {
            return;
        }

        let { dpr, height, width } = size,
            step = lattice.step;

        prepare();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (boxes) {
            boxes = merge(boxes);

            let area = 0;

            for (let i = 0, n = boxes.length; i < n; i++) {
                area += (boxes[i].right - boxes[i].left) * (boxes[i].bottom - boxes[i].top);
            }

            if (area > width * height * 0.6) {
                boxes = null;
            }
        }

        if (!boxes) {
            ctx.clearRect(0, 0, width, height);
            draw(0, cols, 0, rows);
            full = false;
            return;
        }

        // Dots anywhere near a box may reach into it once displaced, and a line from outside can cross it.
        let reach = step * 3 + Math.abs(o.surfacePadding) + o.ripplePush + o.pointerPush + 4;

        for (let i = 0, n = boxes.length; i < n; i++) {
            let box = boxes[i],
                left = Math.max(0, Math.floor(box.left * dpr) / dpr),
                top = Math.max(0, Math.floor(box.top * dpr) / dpr),
                right = Math.min(width, Math.ceil(box.right * dpr) / dpr),
                bottom = Math.min(height, Math.ceil(box.bottom * dpr) / dpr);

            if (right <= left || bottom <= top) {
                continue;
            }

            ctx.save();
            ctx.beginPath();
            ctx.rect(left, top, right - left, bottom - top);
            ctx.clip();
            ctx.clearRect(left, top, right - left, bottom - top);
            draw(
                clamp(Math.floor((left - reach - lattice.x) / step), 0, cols),
                clamp(Math.ceil((right + reach - lattice.x) / step) + 1, 0, cols),
                clamp(Math.floor((top - reach - lattice.y) / step), 0, rows),
                clamp(Math.ceil((bottom + reach - lattice.y) / step) + 1, 0, rows)
            );
            ctx.restore();
        }
    }

    function lightBox(): Box | null {
        if (light.intensity < 0.001 || !o || !lattice) {
            return null;
        }

        let r = Math.max(o.radius, o.lineRadius) + o.pointerPush + lattice.step * 2;

        return { bottom: light.y + r, left: light.x - r, right: light.x + r, top: light.y - r };
    }

    function merge(boxes: Box[]) {
        let result: Box[] = [];

        for (let i = 0, n = boxes.length; i < n; i++) {
            let box = { ...boxes[i] };

            for (let j = 0; j < result.length;) {
                if (overlaps(box, result[j])) {
                    let other = result.splice(j, 1)[0];

                    box.bottom = Math.max(box.bottom, other.bottom);
                    box.left = Math.min(box.left, other.left);
                    box.right = Math.max(box.right, other.right);
                    box.top = Math.min(box.top, other.top);
                    j = 0;
                }
                else {
                    j++;
                }
            }

            result.push(box);
        }

        return result;
    }

    function prepare() {
        preparedCount = 0;

        for (let i = 0, n = rings.length; i < n && preparedCount < RINGS; i++) {
            let ring = rings[i],
                age = ring.held ? Math.min(now - ring.born, RIPPLE_RISE) : now - ring.born,
                fade = 1 - age / ring.life,
                amp = fade * fade * Math.min(1, age / RIPPLE_RISE) * ring.gain;

            if (age < 0 || fade <= 0 || amp < 0.002) {
                continue;
            }

            let slot = prepared[preparedCount++];

            slot.amp = amp;
            slot.radius = (ring.shape ? Math.max(0, age - RIPPLE_RISE) : age) * RIPPLE_SPEED;
            slot.shape = ring.shape;
            slot.x = ring.x;
            slot.y = ring.y;
        }

        for (let i = 0, n = paths.length; i < n; i++) {
            let path = paths[i];

            if (!path.motion || !animated()) {
                path.crest = -Infinity;
                continue;
            }

            let span = path.length + 4 * LINK_CREST,
                travel = (linked / 1000 * path.speed) % (path.motion === 2 ? 2 * span : span);

            path.crest = (path.motion === 2 && travel > span ? 2 * span - travel : travel) - 2 * LINK_CREST;
        }
    }

    function queue(a: number, b: number, segments: number, brightness: number) {
        let lit = Math.min(lineLight[a], lineLight[b]),
            alpha = Math.round(lit * brightness * (ALPHA_LEVELS - 1));

        if (alpha < 1) {
            return segments;
        }

        segment[segments * 2] = a;
        segment[segments * 2 + 1] = b;
        segmentBucket[segments] = Math.round(lit * (TINT_LEVELS - 1)) * ALPHA_LEVELS + Math.min(alpha, ALPHA_LEVELS - 1);
        counts[segmentBucket[segments] + 1]++;

        return segments + 1;
    }

    function recolor() {
        let tint = clamp(o?.tint ?? 0, 0, 1);

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

        full = true;
    }

    function release() {
        trim = 0;

        let idle = scheduler.now() - painted;

        if (idle < TRIM || frame || timer) {
            trim = scheduler.timer(release, Math.max(16, TRIM - idle));
            return;
        }

        let { width } = canvas;

        canvas.width = width + 1;
        canvas.width = width;
        paint(null);
    }

    // Starts a travelling ring, making room by dropping the oldest ring that is not held.
    function ring(next: Omit<Ring, 'born'>) {
        if (rings.length >= RINGS) {
            let index = rings.findIndex((r) => !r.held);

            if (index === -1) {
                return;
            }

            rings.splice(index, 1);
        }

        rings.push({ ...next, born: now });
    }

    function seeded(gap: number, view: Camera): Lattice {
        let scale = parallax(view.zoom),
            step = gap * scale,
            [x, col] = axis(view.x + step / 2, step, 0),
            [y, row] = axis(view.y + step / 2, step, 0);

        return { col, gap, row, scale, step, x, y };
    }

    function snooze() {
        let due = Infinity;

        if (breathing()) {
            due = breathed + BREATH_FRAME;
        }

        if (paths.some((path) => path.motion)) {
            due = Math.min(due, linked + LINK_FRAME);
        }

        // Timers run late more often than frames do, so it rings a little early and lets the frame check the time.
        let wait = due - scheduler.now() - 10;

        if (wait <= 0) {
            frame = scheduler.frame(tick);
            return;
        }

        timer = scheduler.timer(() => {
            timer = 0;
            frame = scheduler.frame(tick);
        }, wait);
    }

    // Counting sort: `counts` holds per-bucket tallies offset by one and becomes each bucket's start index.
    function sort(keys: Uint16Array, into: Uint32Array, n: number) {
        for (let b = 1; b <= BUCKETS; b++) {
            counts[b] += counts[b - 1];
        }

        cursor.set(counts);

        for (let i = 0; i < n; i++) {
            if (keys[i] < BUCKETS) {
                into[cursor[keys[i]]++] = i;
            }
        }
    }

    function tick() {
        frame = 0;

        if (!o || !lattice || !shown) {
            return;
        }

        now = scheduler.now();

        let dt = Math.min(64, now - ticked) / 1000,
            animate = animated(),
            before = lightBox(),
            intensity = 0,
            target = { x: light.x, y: light.y },
            wandering = false;

        ticked = now;

        if (animate && pointer.inside) {
            intensity = 1;
            target = { x: pointer.x, y: pointer.y };
        }
        else if (animate && o.wander && now - pointer.at > IDLE) {
            let t = now / 1000,
                { height, width } = size;

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
            fade = 1 - Math.exp(-dt * 6),
            last = { intensity: light.intensity, x: light.x, y: light.y };

        light.intensity += (intensity - light.intensity) * fade;
        light.x += (target.x - light.x) * follow;
        light.y += (target.y - light.y) * follow;

        let settled = Math.abs(intensity - light.intensity) < 0.002
            && (light.intensity < 0.002 || (Math.abs(target.x - light.x) < 0.1 && Math.abs(target.y - light.y) < 0.1));

        if (!animate) {
            light.intensity = 0;
            rings.length = 0;
        }
        else if (settled) {
            light.intensity = intensity;

            if (intensity) {
                light.x = target.x;
                light.y = target.y;
            }
        }

        for (let i = rings.length - 1; i >= 0; i--) {
            let r = rings[i];

            if (!r.held && now - r.born >= r.life) {
                rings.splice(i, 1);
            }
        }

        let moved = light.intensity !== last.intensity || light.x !== last.x || light.y !== last.y,
            travelling = rings.some((r) => !r.held || now - r.born < RIPPLE_RISE + 16),
            crest = animate && paths.some((path) => path.motion) && now - linked >= LINK_FRAME - SLACK,
            breath = breathing() && now - breathed >= BREATH_FRAME - SLACK,
            // A breathing field changes everywhere with time, so a partial repaint would leave a seam at its edge.
            painting = full || travelling || breath || (breathing() && (moved || crest || damage.length > 0));

        if (crest) {
            linked = now;
        }

        if (painting) {
            paint(null);
            breathed = now;
            crests.length = 0;

            for (let i = 0, n = paths.length; i < n; i++) {
                let box = paths[i].motion ? crestBox(paths[i]) : null;

                if (box) {
                    crests.push(box);
                }
            }
        }
        else {
            let boxes = damage;

            if (moved) {
                let after = lightBox();

                if (before) {
                    boxes.push(before);
                }

                if (after) {
                    boxes.push(after);
                }
            }

            if (crest) {
                boxes.push(...crests);
                crests.length = 0;
                prepare();

                for (let i = 0, n = paths.length; i < n; i++) {
                    let box = paths[i].motion ? crestBox(paths[i]) : null;

                    if (box) {
                        boxes.push(box);
                        crests.push(box);
                    }
                }
            }

            if (boxes.length) {
                paint(boxes);
            }
        }

        damage = [];
        arm();

        if (!settled || travelling || wandering) {
            frame = scheduler.frame(tick);
        }
        else if (breathing() || (animate && paths.some((path) => path.motion))) {
            snooze();
        }
    }

    // Draws one lattice edge, curved through its neighbours once they are displaced so the fabric bends rather than
    // kinks.
    function trace(a: number, b: number, step: number) {
        let ax = px[a],
            ay = py[a],
            bx = px[b],
            by = py[b],
            horizontal = b === a + 1,
            before = a - (horizontal ? 1 : cols),
            after = b + (horizontal ? 1 : cols),
            hasBefore = (horizontal ? a % cols > 0 : before >= 0) && visible[before],
            hasAfter = (horizontal ? b % cols + 1 < cols : after < cols * rows) && visible[after],
            lx = hasBefore ? px[before] : 2 * ax - bx,
            ly = hasBefore ? py[before] : 2 * ay - by,
            rx = hasAfter ? px[after] : 2 * bx - ax,
            ry = hasAfter ? py[after] : 2 * by - ay,
            t1x = (bx - lx) * 0.5,
            t1y = (by - ly) * 0.5,
            t2x = (rx - ax) * 0.5,
            t2y = (ry - ay) * 0.5,
            chordX = bx - ax,
            chordY = by - ay,
            limit = 2.25 * Math.max(step * step, chordX * chordX + chordY * chordY),
            l1 = t1x * t1x + t1y * t1y,
            l2 = t2x * t2x + t2y * t2y;

        if (l1 > limit) {
            let s = Math.sqrt(limit / l1);

            t1x *= s;
            t1y *= s;
        }

        if (l2 > limit) {
            let s = Math.sqrt(limit / l2);

            t2x *= s;
            t2y *= s;
        }

        let c1x = ax + t1x / 3,
            c1y = ay + t1y / 3,
            c2x = bx - t2x / 3,
            c2y = by - t2y / 3;

        ctx.moveTo(ax, ay);

        if (
            Math.abs(c1x - (2 * ax + bx) / 3) + Math.abs(c1y - (2 * ay + by) / 3)
            + Math.abs(c2x - (ax + 2 * bx) / 3) + Math.abs(c2y - (ay + 2 * by) / 3) < 0.01
        ) {
            ctx.lineTo(bx, by);
        }
        else {
            ctx.bezierCurveTo(c1x, c1y, c2x, c2y, bx, by);
        }
    }

    function wake() {
        if (!o || !lattice || !shown || !size.width) {
            return;
        }

        if (timer) {
            scheduler.clear(timer);
            timer = 0;
        }

        if (!frame) {
            frame = scheduler.frame(tick);
        }
    }

    function restored() {
        full = true;
        wake();
    }

    // The GPU can take a canvas back; the browser returns it blank, and only a full paint refills it.
    (canvas as EventTarget).addEventListener('contextrestored', restored);

    return {
        camera(next: Camera | null) {
            if (next && !(next.zoom > 0 && Number.isFinite(next.x) && Number.isFinite(next.y) && Number.isFinite(next.zoom))) {
                next = null;
            }

            if (!next) {
                if (camera) {
                    camera = null;
                    layout();
                    wake();
                }

                return;
            }

            if (camera && camera.x === next.x && camera.y === next.y && camera.zoom === next.zoom) {
                return;
            }

            let gap = Math.max(6, o?.gap ?? 22);

            if (!camera || !lattice || lattice.gap !== gap) {
                lattice = seeded(gap, next);
            }
            else {
                // The floor is carried from camera to camera, taking the same pan and its own damped scale about the
                // point the zoom kept still; recomputing it from the world origin would slide it under the pointer.
                let r = next.zoom / camera.zoom,
                    fixed: { x: number, y: number } | null = null;

                if (Math.abs(r - 1) > 1e-6) {
                    let x = (next.x - r * camera.x) / (1 - r),
                        y = (next.y - r * camera.y) / (1 - r);

                    if (Number.isFinite(x) && Number.isFinite(y)) {
                        fixed = { x, y };
                    }
                }

                let anchor = fixed && fixed.x >= 0 && fixed.y >= 0 && fixed.x <= size.width && fixed.y <= size.height
                        ? fixed
                        : hand ?? { x: size.width / 2, y: size.height / 2 },
                    scale = parallax(next.zoom),
                    q = scale / lattice.scale,
                    step = gap * scale,
                    tx = next.x - r * camera.x - anchor.x * (1 - r),
                    ty = next.y - r * camera.y - anchor.y * (1 - r),
                    [x, col] = axis(anchor.x + (lattice.x - anchor.x) * q + tx, step, lattice.col),
                    [y, row] = axis(anchor.y + (lattice.y - anchor.y) * q + ty, step, lattice.row);

                lattice = { col, gap, row, scale, step, x, y };

                if (fixed && animated() && now - wave >= ZOOM_WAVE.interval) {
                    wave = now;
                    ring({ gain: ZOOM_WAVE.gain, held: false, id: -1, life: ZOOM_WAVE.life, shape: null, x: anchor.x, y: anchor.y });
                }
            }

            camera = { ...next };
            layout();
            wake();
        },
        cancel(id: number) {
            let index = rings.findIndex((r) => r.held && r.id === id);

            if (index !== -1) {
                rings.splice(index, 1);
                full = true;
                wake();
            }
        },
        configure(next: Settings) {
            let previous = o;

            o = next;

            if (!previous || previous.gap !== next.gap) {
                layout();
            }

            if (!previous || previous.tint !== next.tint) {
                recolor();
            }

            full = true;
            wake();
        },
        dispose() {
            shown = false;
            scheduler.cancel(frame);
            scheduler.clear(timer);
            scheduler.clear(trim);
            frame = timer = trim = 0;
            (canvas as EventTarget).removeEventListener('contextrestored', restored);
        },
        // Runs a pending frame now, so a frame's layout reads and its paint land in the same vsync.
        flush() {
            if (frame) {
                scheduler.cancel(frame);
                tick();
            }
        },
        links(next: Link[]) {
            let built: Path[] = [];

            for (let i = 0, n = next.length; i < n; i++) {
                let path = o ? build(next[i]) : null;

                if (path) {
                    built.push(path);
                }
            }

            for (let i = 0, n = paths.length; i < n; i++) {
                damage.push(paths[i].box);
            }

            for (let i = 0, n = built.length; i < n; i++) {
                damage.push(built[i].box);
            }

            damage.push(...crests);
            crests.length = 0;
            paths = built;
            wake();
        },
        pointer(id: number, x: number, y: number, inside: boolean) {
            pointer.at = now = scheduler.now();
            pointer.id = id;
            pointer.inside = inside;

            if (inside) {
                hand = { x, y };
                pointer.x = x;
                pointer.y = y;
            }

            for (let i = 0, n = rings.length; i < n; i++) {
                let r = rings[i];

                if (r.held && r.id === id && !r.shape) {
                    r.x = x;
                    r.y = y;
                    full = true;
                }
            }

            wake();
        },
        press(id: number, x: number, y: number) {
            now = scheduler.now();

            if (!animated()) {
                return;
            }

            ring({ gain: 1, held: true, id, life: RIPPLE_LIFE, shape: null, x, y });
            wake();
        },
        recolor(nextBase: Rgb, nextAccent: Rgb) {
            base = nextBase;
            accent = nextAccent;
            recolor();
            wake();
        },
        release(id: number) {
            now = scheduler.now();

            for (let i = 0, n = rings.length; i < n; i++) {
                let r = rings[i];

                // Carries on from the radius it held, as if it had never stopped.
                if (r.held && r.id === id && !r.shape) {
                    r.born = now - RIPPLE_RISE;
                    r.held = false;
                }
            }

            wake();
        },
        resize(width: number, height: number, dpr: number) {
            if (width === size.width && height === size.height && dpr === size.dpr) {
                return;
            }

            canvas.height = Math.max(1, Math.round(height * dpr));
            canvas.width = Math.max(1, Math.round(width * dpr));
            size = { dpr, height, width };
            layout();
            wake();
        },
        ripple(x: number, y: number) {
            now = scheduler.now();

            if (animated()) {
                ring({ gain: 1, held: false, id: -1, life: RIPPLE_LIFE, shape: null, x, y });
                wake();
            }
        },
        surfaces(next: Shape[]) {
            let previous = new Map<string, Geo>(),
                built: Geo[] = [],
                changed = 0,
                grip = o && lattice ? Math.max(o.surfacePadding, 0) + lattice.step * 6 + o.ripplePush + o.pointerPush : 0;

            for (let i = 0, n = shapes.length; i < n; i++) {
                previous.set(shapes[i].id || String(i), shapes[i]);
            }

            for (let i = 0, n = next.length; i < n; i++) {
                let shape = geo(next[i]),
                    key = shape.id || String(i),
                    old = previous.get(key);

                previous.delete(key);

                // Kept by identity when unchanged, so a ring rising from its outline still finds it.
                if (
                    old && old.cx === shape.cx && old.cy === shape.cy && old.hx === shape.hx && old.hy === shape.hy
                    && old.r === shape.r && old.cos === shape.cos && old.sin === shape.sin
                    && old.ellipse === shape.ellipse && old.active === shape.active
                ) {
                    built.push(old);
                    continue;
                }

                built.push(shape);
                changed++;
                damage.push(pad(shape, grip));

                if (old) {
                    damage.push(pad(old, grip));
                }

                // A surface taken up sends a ring out from its outline, which travels on once it is set down.
                if (animated() && shape.active && !old?.active) {
                    ring({ gain: 1, held: true, id: -1, life: RIPPLE_LIFE, shape, x: 0, y: 0 });
                }

                for (let r = 0, m = rings.length; r < m; r++) {
                    let outline = rings[r];

                    if (outline.shape && outline.shape === old) {
                        outline.shape = shape;

                        if (outline.held && !shape.active) {
                            outline.born = scheduler.now() - RIPPLE_RISE;
                            outline.held = false;
                        }
                    }
                }
            }

            for (let [, old] of previous) {
                changed++;
                damage.push(pad(old, grip));
                rings = rings.filter((r) => r.shape !== old);
            }

            shapes = built;

            if (changed) {
                wake();
            }
        },
        visible(next: boolean) {
            if (next === shown) {
                return;
            }

            shown = next;

            if (next) {
                wake();
            }
            else {
                scheduler.cancel(frame);
                scheduler.clear(timer);
                frame = timer = 0;
            }
        }
    };
};

// One clock for both threads: a worker's `performance` starts from its own origin, so both read the page's.
const scheduler = (): Scheduler => {
    let raf = typeof requestAnimationFrame === 'function';

    return {
        cancel: (handle) => {
            if (!handle) {
                return;
            }

            if (raf) {
                cancelAnimationFrame(handle);
            }
            else {
                clearTimeout(handle);
            }
        },
        clear: (handle) => {
            if (handle) {
                clearTimeout(handle);
            }
        },
        frame: (callback) => raf
            ? requestAnimationFrame(callback)
            : setTimeout(callback, 16) as unknown as number,
        now: () => performance.timeOrigin + performance.now(),
        timer: (callback, ms) => setTimeout(callback, ms) as unknown as number
    };
};


export default engine;
export { scheduler };
export type { Camera, Link, Rgb, Settings, Shape };
