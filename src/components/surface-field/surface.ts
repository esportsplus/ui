import { component, html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import inlineEdit from '~/components/inline-edit';


type Geometry = { height: number, width: number, x: number, y: number };

type Start = { h: number, mode: 'move' | 'resize', pointerX: number, pointerY: number, scale: number, w: number, x: number, y: number };

// Receives every move, resize and edit, so edges, a minimap or a store can follow the surface.
type State = Geometry & { body?: string, title?: string };

type Surface = Attributes & {
    // Text under the header; an inline-edited note when `editable`.
    body?: string;
    // Keep the surface inside its parent. Turn off for surfaces in an unbounded world such as a pannable canvas.
    bounded?: boolean;
    // Edit the title and body in place.
    editable?: boolean;
    height?: number;
    // Names the surface in its controls' accessible labels; defaults to the title.
    label?: string;
    minHeight?: number;
    minWidth?: number;
    // Names the surface for field links, like `data-surface-field` on any other element.
    name?: string;
    onsave?: (key: 'body' | 'title', value: string) => void;
    state?: State;
    // Shown in the header beside the grip; an inline edit when `editable`.
    title?: string;
    width?: number;
    x?: number;
    y?: number;
};


let z = 1;


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
        onsave,
        state,
        title,
        width = 240,
        x = 0,
        y = 0,
        ...attributes
    }, content) {
        let element: HTMLElement | undefined,
            start: Start | null = null,
            view = reactive({ active: false, height, width, x, y, z: 0 });

        if (state) {
            ({ height, width, x, y } = state);
            body = state.body ?? body;
            title = state.title ?? title;
        }

        let called = label ?? title ? `${label ?? title} surface` : 'surface';

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
                x = Math.min(Math.max(x, 0), Math.max(0, pw - width));
                y = Math.min(Math.max(y, 0), Math.max(0, ph - height));
            }

            view.height = height;
            view.width = width;
            view.x = x;
            view.y = y;

            if (state && (state.height !== height || state.width !== width || state.x !== x || state.y !== y)) {
                state.height = height;
                state.width = width;
                state.x = x;
                state.y = y;
            }
        }

        function begin(event: PointerEvent, mode: Start['mode']) {
            if (event.button !== 0 || !element) {
                return;
            }

            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
            view.active = true;
            view.z = ++z;
            // Inside a zoomed world the pointer travels in screen px; dividing by the rendered scale keeps the surface
            // under the cursor.
            start = {
                h: height,
                mode,
                pointerX: event.clientX,
                pointerY: event.clientY,
                scale: element.getBoundingClientRect().width / element.offsetWidth || 1,
                w: width,
                x,
                y
            };
        }

        function end() {
            start = null;
            view.active = false;
        }

        function move(event: PointerEvent) {
            if (!start) {
                return;
            }

            let dx = (event.clientX - start.pointerX) / start.scale,
                dy = (event.clientY - start.pointerY) / start.scale;

            if (start.mode === 'resize') {
                width = start.w + dx;
                height = start.h + dy;
            }
            else {
                x = start.x + dx;
                y = start.y + dy;
            }

            apply();
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

        function save(key: 'body' | 'title', value: string) {
            if (state) {
                state[key] = value;
            }

            onsave?.(key, value);
        }

        return html`
            <div
                class='surface-field-surface'
                ${this?.attributes}
                ${attributes}
                ${{
                    class: () => view.active && '--active',
                    'data-surface-field': name,
                    onconnect: (el: HTMLElement) => {
                        element = el;
                        apply();
                    },
                    style: [
                        () => `height: ${view.height}px; translate: ${view.x}px ${view.y}px; width: ${view.width}px;`,
                        () => view.z !== 0 && `z-index: ${view.z};`
                    ]
                }}
            >
                <span aria-hidden='true' class='surface-field-surface-lift'></span>
                <div
                    class='surface-field-surface-header'
                    ${{
                        onlostpointercapture: end,
                        onpointerdown: (event: PointerEvent) => {
                            // A click on an editable title edits it; the rest of the header carries the surface.
                            if (!(event.target as Element).closest('.inline-edit')) {
                                begin(event, 'move');
                            }
                        },
                        onpointermove: move
                    }}
                >
                    ${title !== undefined && (
                        editable
                            ? inlineEdit({
                                class: 'surface-field-surface-title',
                                label: `${called} title`,
                                onsave: (value: string) => save('title', value),
                                placeholder: 'Untitled',
                                value: title
                            })
                            : html`<span class='surface-field-surface-title'>${title}</span>`
                    )}
                    <button
                        aria-label='${`Move ${called} with arrow keys`}'
                        class='surface-field-surface-handle'
                        type='button'
                        ${{ onkeydown: (event: KeyboardEvent) => nudge(event, false) }}
                    ></button>
                </div>
                <div class='surface-field-surface-content'>
                    ${body !== undefined && (
                        editable
                            ? inlineEdit({
                                class: 'surface-field-surface-body',
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
                <button
                    aria-label='${`Resize ${called} with arrow keys; right and down make it larger`}'
                    class='surface-field-surface-resize'
                    type='button'
                    ${{
                        onkeydown: (event: KeyboardEvent) => nudge(event, true),
                        onlostpointercapture: end,
                        onpointerdown: (event: PointerEvent) => begin(event, 'resize'),
                        onpointermove: move
                    }}
                ></button>
            </div>
        `;
    }
);
