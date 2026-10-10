import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { clamp } from '~/shared/clamp';
import type { Token } from './syntax';


// What the minimap draws: native lines with their tokens, rows and tops in content pixels.
type Source = {
    breaks: (index: number) => readonly number[];
    count: number;
    height: number;
    indexAt: (y: number) => number;
    lineHeight: number;
    rows: (index: number) => number;
    tabSize: number;
    text: (index: number) => string;
    tokens: (index: number) => readonly Token[];
    top: (index: number) => number;
};

type Viewport = { clientHeight: number; scrollHeight: number; scrollTop: number };


// Columns drawn per row; the rest of a long line is cut off.
const COLUMNS = 70;

const INSET = 3;

// Lines this long draw as one bar rather than character runs.
const LONG = 10000;

// Content pixels per row before the whole document has to squeeze into the minimap's height.
const PITCH = 4;

const SPACING = 1.15;


function blank(text: string, i: number) {
    let code = text.charCodeAt(i);

    return code === 32 || code === 9 || code === 160;
}


const minimapMetrics = (height: number, scrollHeight: number, clientHeight: number, scrollTop: number) => {
    let slider = Math.min(height, Math.max(24, (height * clientHeight) / Math.max(1, scrollHeight))),
        travel = Math.max(0, height - slider),
        scroll = Math.max(0, scrollHeight - clientHeight);

    return {
        height: slider,
        scroll,
        top: scroll ? clamp((scrollTop / scroll) * travel, 0, travel) : 0,
        travel
    };
};

const minimapScroll = (y: number, grab: number, height: number, scrollHeight: number, clientHeight: number) => {
    let metrics = minimapMetrics(height, scrollHeight, clientHeight, 0);

    return metrics.travel ? (clamp(y - grab, 0, metrics.travel) / metrics.travel) * metrics.scroll : 0;
};

// The whole document drawn into a fixed-height canvas, with a slider for the viewport. Edits that keep the line
// count redraw only their band; anything else redraws once per frame at most. 'name' prefixes its classes.
const minimap = ({
    focus,
    name = 'code-editor',
    scroll
}: {
    focus: VoidFunction;
    name?: string;
    scroll: (top: number, relative: boolean) => void;
}) => {
    let canvas: HTMLCanvasElement | undefined,
        colors: Record<string, string> = {},
        content = 0,
        dirty: [number, number] | null = null,
        full = true,
        grab: number | null = null,
        lineHeight = 20,
        pixels = '',
        state = reactive({ height: 24, top: 0 }),
        // Last fill this paint set; the fillStyle setter parses its color every time, even an unchanged one.
        style = '',
        viewport: Viewport = { clientHeight: 0, scrollHeight: 0, scrollTop: 0 },
        width = 0;

    function draw(context: CanvasRenderingContext2D, source: Source, scale: number, index: number) {
        let text = source.text(index),
            top = source.top(index),
            pitch = Math.max(1, Math.min(3, source.lineHeight * scale));

        if (text.length > LONG) {
            fill(context, colors.comment);
            context.fillRect(INSET, top * scale, Math.min(width - INSET * 2, COLUMNS), pitch);
            return;
        }

        let breaks = source.breaks(index),
            tokens = source.tokens(index),
            t = 0;

        for (let row = 0, rows = breaks.length + 1; row < rows; row++) {
            let from = row ? breaks[row - 1] : 0,
                to = Math.min(row < breaks.length ? breaks[row] : text.length, from + COLUMNS),
                x = INSET,
                y = (top + row * source.lineHeight) * scale;

            for (let i = from; i < to;) {
                if (blank(text, i)) {
                    x += text.charCodeAt(i) === 9 ? source.tabSize * SPACING : SPACING;
                    i++;
                    continue;
                }

                while (t < tokens.length && tokens[t].to <= i) {
                    t++;
                }

                let token = tokens[t],
                    kind = token && token.from <= i ? token.kind : 'variable',
                    end = Math.min(to, token ? (token.from <= i ? token.to : token.from) : to),
                    start = x;

                while (i < end && !blank(text, i)) {
                    x += SPACING;
                    i++;
                }

                fill(context, colors[kind] ?? colors.variable);
                context.fillRect(start, y, x - start, pitch);
            }
        }
    }

    function fill(context: CanvasRenderingContext2D, color: string) {
        if (color !== style) {
            context.fillStyle = style = color;
        }
    }

    function move(e: PointerEvent) {
        if (grab === null || !canvas) {
            return;
        }

        scroll(
            minimapScroll(e.clientY - canvas.getBoundingClientRect().top, grab, content, viewport.scrollHeight, viewport.clientHeight),
            false
        );
    }

    function release() {
        grab = null;
    }

    let handlers: Attributes = {
        onactivewheel: (e: WheelEvent) => {
            e.preventDefault();
            scroll(e.deltaY * (e.deltaMode === 1 ? lineHeight : e.deltaMode === 2 ? viewport.clientHeight : 1), true);
        },
        onlostpointercapture: release,
        onpointercancel: release,
        onpointerdown: (e: PointerEvent) => {
            if (e.button !== 0 || !canvas) {
                return;
            }

            let y = e.clientY - canvas.getBoundingClientRect().top;

            e.preventDefault();
            focus();
            grab = y >= state.top && y <= state.top + state.height ? y - state.top : state.height / 2;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            move(e);
        },
        onpointermove: move,
        onpointerup: release
    };

    return {
        // Lines [first, last) changed text without moving any other line; null redraws everything.
        invalidate: (first: number | null = null, last = first ?? 0) => {
            if (first === null) {
                full = true;
                return;
            }

            dirty = dirty ? [Math.min(dirty[0], first), Math.max(dirty[1], last)] : [first, last];
        },
        paint: (source: Source, view: Viewport, palette: Record<string, string>, size: number) => {
            let height = view.clientHeight,
                ratio = devicePixelRatio || 1,
                context = canvas?.getContext('2d');

            lineHeight = source.lineHeight;
            viewport = view;
            content = Math.min(height, Math.max(1, source.height / source.lineHeight) * PITCH);

            let metrics = minimapMetrics(content, view.scrollHeight, height, view.scrollTop);

            state.height = metrics.height;
            state.top = metrics.top;

            if (!canvas || !context || !height || !size) {
                return;
            }

            let key = `${size}:${height}:${ratio}:${content}:${source.height}`;

            if (key !== pixels || colors !== palette) {
                canvas.height = Math.round(height * ratio);
                canvas.width = Math.round(size * ratio);
                colors = palette;
                full = true;
                pixels = key;
                width = size;
            }

            if (!full && !dirty) {
                return;
            }

            let scale = content / Math.max(1, source.height),
                step = Math.max(1, Math.ceil(source.count / Math.max(1, height))),
                first = 0,
                last = source.count;

            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            style = '';

            if (full) {
                context.clearRect(0, 0, width, height);
            }
            else {
                let [a, b] = dirty!,
                    y0 = Math.floor(source.top(a) * scale),
                    y1 = Math.ceil((source.top(b - 1) + source.rows(b - 1) * source.lineHeight) * scale) + 1;

                context.clearRect(0, y0, width, y1 - y0);
                first = source.indexAt(y0 / scale);
                last = Math.min(source.count, source.indexAt(y1 / scale) + 1);
            }

            for (let index = first - (first % step); index < last; index += step) {
                draw(context, source, scale, index);
            }

            dirty = null;
            full = false;
        },
        state,
        template: (attributes?: Attributes) => html`
            <div aria-hidden='true' class='${name}-minimap' ${handlers} ${attributes}>
                <canvas class='${name}-minimap-canvas' ${{ onconnect: (element: HTMLCanvasElement) => { canvas = element; } }}></canvas>
                <div
                    class='${name}-minimap-slider'
                    ${{ style: () => `--slider-height: ${state.height}px; --slider-top: ${state.top}px;` }}
                ></div>
            </div>
        `
    };
};


export { minimap, minimapMetrics, minimapScroll };
export type { Source, Viewport };
