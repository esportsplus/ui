import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import { clamp } from '~/shared/clamp';
import inlineEdit from '~/components/inline-edit';


type Geometry = { height: number, rotation: number, width: number, x: number, y: number };

// What the hand holds: the body moves, a frame corner or edge resizes (sx and sy say which sides follow it), the knob
// turns, the out port draws a link.
type Grip = { kind: 'link' | 'move' | 'resize' | 'rotate', sx: number, sy: number };

type Point = { x: number, y: number };

// Pointer and centre are viewport px; the rest is the geometry the gesture started from.
type Start = Geometry & { cx: number, cy: number, grip: Grip, moved: boolean, pointerX: number, pointerY: number, scale: number };

// Receives every move, resize, turn and edit, so edges, a minimap or a store can follow the surface.
type State = Omit<Geometry, 'rotation'> & { body?: string, rotation?: number, title?: string };

type Surface = Attributes & {
    // Text under the header; an inline-edited note when `editable`.
    body?: string;
    // Keep the surface inside its parent. Turn off for surfaces in an unbounded world such as a pannable canvas.
    bounded?: boolean;
    // Edit the title and body in place.
    editable?: boolean;
    height?: number;
    // Names the surface in its accessible label; defaults to the title.
    label?: string;
    minHeight?: number;
    minWidth?: number;
    // Names the surface for field links and `onlink`, like `data-surface-field` on any other element.
    name?: string;
    // The name of the surface a link drawn from the out port was dropped on.
    onlink?: (to: string) => void;
    // The end of the link being drawn from the out port, in the parent's px; null once it is let go.
    onlinking?: (point: Point | null) => void;
    onsave?: (key: 'body' | 'title', value: string) => void;
    // Connection dots on both sides: links arrive on the left and are drawn out from the right.
    ports?: boolean;
    // Edit the body with the markdown editor and its formatting toolbar instead of plain text.
    rich?: boolean;
    // Degrees, clockwise.
    rotation?: number;
    state?: State;
    // Shown in the header; an inline edit when `editable`.
    title?: string;
    width?: number;
    x?: number;
    y?: number;
};


const CORNERS = [['ne', 1, -1], ['nw', -1, -1], ['se', 1, 1], ['sw', -1, 1]] as const;

// A press that travels less than this, in px, is a click that selects rather than a drag.
const DRAG_SLOP = 3;

const EDGES = [['e', 1, 0], ['n', 0, -1], ['s', 0, 1], ['w', -1, 0]] as const;


let z = 1;


// A turn kept in (-180, 180], so a surface spun twice reads -6 and not 714.
function wrap(degrees: number) {
    let d = ((degrees % 360) + 360) % 360;

    return d > 180 ? d - 360 : d;
}


export default component<Surface>(
    function(this, {
        body,
        bounded = true,
        editable = false,
        height = 160,
        label,
        minHeight = 72,
        minWidth = 120,
        name,
        onlink,
        onlinking,
        onsave,
        ports = false,
        rich = false,
        rotation = 0,
        state,
        title,
        width = 240,
        x = 0,
        y = 0,
        ...attributes
    }, content) {
        let element: HTMLElement | undefined,
            start: Start | null = null,
            view = reactive({ active: false, height, rotation, selected: false, width, x, y, z: 0 });

        if (state) {
            ({ height, width, x, y } = state);
            body = state.body ?? body;
            rotation = state.rotation ?? rotation;
            title = state.title ?? title;
        }

        let called = label ?? title ?? 'Surface';

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

                width = Math.min(width, Math.max(minWidth, pw));
                height = Math.min(height, Math.max(minHeight, ph));
                x = clamp(x, 0, Math.max(0, pw - width));
                y = clamp(y, 0, Math.max(0, ph - height));
            }

            view.height = height;
            view.rotation = rotation;
            view.width = width;
            view.x = x;
            view.y = y;

            if (state && (state.height !== height || state.rotation !== rotation || state.width !== width || state.x !== x || state.y !== y)) {
                state.height = height;
                state.rotation = rotation;
                state.width = width;
                state.x = x;
                state.y = y;
            }
        }

        function begin(event: PointerEvent) {
            if (event.button !== 0 || !element || start) {
                return;
            }

            view.selected = true;

            let target = event.target as Element,
                held = target.closest<HTMLElement>('[data-grip]');

            // A press on editable text edits it; anywhere else on the body carries the surface.
            if (!held || (held === element && target.closest('.inline-edit'))) {
                return;
            }

            let { grip: kind, sx, sy } = held.dataset,
                bounds = element.getBoundingClientRect(),
                turn = rotation * Math.PI / 180,
                // Inside a zoomed world the pointer travels in screen px; the rendered box over the turned layout box
                // gives the scale to divide by, so the surface stays under the cursor.
                scale = bounds.width / (width * Math.abs(Math.cos(turn)) + height * Math.abs(Math.sin(turn))) || 1;

            element.setPointerCapture(event.pointerId);
            event.preventDefault();
            start = {
                cx: bounds.left + bounds.width / 2,
                cy: bounds.top + bounds.height / 2,
                grip: { kind: kind as Grip['kind'], sx: Number(sx ?? 0), sy: Number(sy ?? 0) },
                height,
                moved: kind !== 'move' && kind !== 'link',
                pointerX: event.clientX,
                pointerY: event.clientY,
                rotation,
                scale,
                width,
                x,
                y
            };
            view.active = kind !== 'link';
            view.z = ++z;
        }

        function end() {
            if (start?.grip.kind === 'link') {
                onlinking?.(null);
            }

            start = null;
            view.active = false;
        }

        function keydown(event: KeyboardEvent) {
            if (event.target !== event.currentTarget) {
                return;
            }

            if (event.key === 'Escape') {
                view.selected = false;
                element?.blur();
                return;
            }

            if (event.key === '[' || event.key === ']') {
                event.preventDefault();
                rotation = wrap(rotation + (event.key === ']' ? 1 : -1) * (event.shiftKey ? 1 : 15));
                apply();
                return;
            }

            let step = event.shiftKey ? 32 : 8,
                dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
                dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;

            if (!dx && !dy) {
                return;
            }

            event.preventDefault();

            if (event.altKey) {
                width += dx;
                height += dy;
            }
            else {
                x += dx;
                y += dy;
            }

            apply();
        }

        function move(event: PointerEvent) {
            if (!start) {
                return;
            }

            let dx = event.clientX - start.pointerX,
                dy = event.clientY - start.pointerY;

            if (!start.moved) {
                if (Math.hypot(dx, dy) < DRAG_SLOP) {
                    return;
                }

                start.moved = true;
            }

            let grip = start.grip,
                turn = start.rotation * Math.PI / 180,
                cos = Math.cos(turn),
                sin = Math.sin(turn);

            dx /= start.scale;
            dy /= start.scale;

            if (grip.kind === 'link') {
                onlinking?.(port(start, dx, dy));
                return;
            }

            if (grip.kind === 'move') {
                x = start.x + dx;
                y = start.y + dy;
            }
            else if (grip.kind === 'rotate') {
                // The angle the hand sweeps about the centre, added to the one it started at; Shift lands on 15 degree
                // steps.
                let swept = Math.atan2(event.clientY - start.cy, event.clientX - start.cx)
                        - Math.atan2(start.pointerY - start.cy, start.pointerX - start.cx),
                    degrees = start.rotation + swept * 180 / Math.PI;

                rotation = wrap(event.shiftKey ? Math.round(degrees / 15) * 15 : degrees);
            }
            else {
                // Read in the surface's own frame: the travel is turned back by its angle, the sides the grip owns follow
                // it, and the centre moves by half of what they gained, turned forward again, so the opposite side stays
                // put on screen, turned or not.
                let du = cos * dx + sin * dy,
                    dv = cos * dy - sin * dx,
                    w = grip.sx ? Math.max(minWidth, start.width + grip.sx * du) : start.width,
                    h = grip.sy ? Math.max(minHeight, start.height + grip.sy * dv) : start.height,
                    lx = grip.sx * (w - start.width) / 2,
                    ly = grip.sy * (h - start.height) / 2;

                width = w;
                height = h;
                x = start.x + start.width / 2 + cos * lx - sin * ly - w / 2;
                y = start.y + start.height / 2 + sin * lx + cos * ly - h / 2;
            }

            apply();
        }

        // The out port, turned with the surface, plus the hand's travel in the parent's px.
        function port(from: Start, dx: number, dy: number): Point {
            let turn = from.rotation * Math.PI / 180;

            return {
                x: from.x + from.width / 2 + Math.cos(turn) * from.width / 2 + dx,
                y: from.y + from.height / 2 + Math.sin(turn) * from.width / 2 + dy
            };
        }

        function release(event: PointerEvent) {
            if (start?.grip.kind !== 'link' || !start.moved) {
                return;
            }

            // Hit testing has no template equivalent: the surface under the hand is the one the link is dropped on.
            let to = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-surface-field]')?.getAttribute('data-surface-field');

            if (to && to !== name) {
                onlink?.(to);
            }
        }

        function save(key: 'body' | 'title', value: string) {
            if (state) {
                state[key] = value;
            }

            onsave?.(key, value);
        }

        return html`
            <div
                aria-keyshortcuts='ArrowUp ArrowDown ArrowLeft ArrowRight Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight [ ] Escape'
                aria-label='${`${called}: arrow keys move it, Alt and the arrow keys resize it, [ and ] turn it`}'
                aria-roledescription='surface'
                class='surface-field-surface'
                data-grip='move'
                role='group'
                tabindex='0'
                ${this?.attributes}
                ${attributes}
                ${{
                    class: () => [view.active && '--active', view.selected && 'surface-field-surface--selected'],
                    'data-surface-field': name,
                    onconnect: (el: HTMLElement) => {
                        element = el;
                        apply();
                    },
                    onfocus: () => {
                        view.selected = true;
                    },
                    onkeydown: keydown,
                    onlostpointercapture: end,
                    onpointerdown: begin,
                    onpointermove: move,
                    onpointerup: release,
                    onwindowpointerdown: (event: PointerEvent) => {
                        if (!element?.contains(event.target as Node)) {
                            view.selected = false;
                        }
                    },
                    style: [
                        () => `height: ${view.height}px; rotate: ${view.rotation}deg; translate: ${view.x}px ${view.y}px; width: ${view.width}px;`,
                        () => view.z !== 0 && `z-index: ${view.z};`
                    ]
                }}
            >
                <span aria-hidden='true' class='surface-field-surface-lift'></span>
                ${title !== undefined && html`
                    <div class='surface-field-surface-header'>
                        ${editable
                            ? inlineEdit({
                                class: 'inline-edit--seamless surface-field-surface-title',
                                label: `${called} title`,
                                onsave: (value: string) => save('title', value),
                                placeholder: 'Untitled',
                                value: title
                            })
                            : html`<span class='surface-field-surface-title'>${title}</span>`}
                    </div>
                `}
                <div class='surface-field-surface-content'>
                    ${body !== undefined && (
                        editable
                            ? (rich ? inlineEdit.rich : inlineEdit)({
                                class: 'inline-edit--seamless surface-field-surface-body',
                                label: `${called} note`,
                                multiline: true,
                                onsave: (value: string) => save('body', value),
                                placeholder: 'Add a note',
                                value: body
                            })
                            : html`<p class='surface-field-surface-body'>${body}</p>`
                    )}
                    ${content}
                </div>
                ${ports && html`
                    <span aria-hidden='true' class='surface-field-surface-port surface-field-surface-port--in'></span>
                    <span aria-hidden='true' class='surface-field-surface-port surface-field-surface-port--out' data-grip='link'></span>
                `}
                <div aria-hidden='true' class='surface-field-surface-frame'>
                    ${EDGES.map(([side, sx, sy]) => html`
                        <span class='surface-field-surface-edge' data-grip='resize' data-side='${side}' data-sx='${sx}' data-sy='${sy}'></span>
                    `)}
                    ${CORNERS.map(([side, sx, sy]) => html`
                        <span class='surface-field-surface-corner' data-grip='resize' data-side='${side}' data-sx='${sx}' data-sy='${sy}'></span>
                    `)}
                    <span class='surface-field-surface-rotate' data-grip='rotate'></span>
                </div>
            </div>
        `;
    }
);
