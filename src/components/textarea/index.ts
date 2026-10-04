import { component, html, type Attributes, type Element } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import form from '~/components/form';
import { observeSize } from '~/shared/resize';
import { trackTransition } from '~/shared/transition';
import './scss/index.scss';


type Autoresize = { height: { max: `${number}px`, min: `${number}px` } };


export default component(function(
    this: { attributes?: Attributes },
    {
        autoresize: resize,
        state = reactive({
            active: false,
            error: ''
        }),
        ...attributes
    }: Attributes & {
        autoresize?: Autoresize,
        state?: { active: boolean, error: string }
    }
) {
    attributes.value ??= '';

    let field: HTMLTextAreaElement | undefined,
        frame: number | undefined,
        measured = reactive({ height: 0, scrollable: false }),
        native = !!resize && CSS.supports('field-sizing', 'content'),
        owner: HTMLFormElement | null | undefined,
        probe: HTMLTextAreaElement | undefined,
        resetFrame: number | undefined,
        width: number | undefined,
        limits = resize && `--max-height: ${resize.height.max}; --min-height: ${resize.height.min};`,
        caller = attributes.oninput ?? this?.attributes?.oninput;

    let motion = trackTransition('height', (running, element) => {
        measured.scrollable = !!element && !running;
    });

    function schedule() {
        if (native || frame !== undefined) {
            return;
        }

        frame = requestAnimationFrame(() => {
            frame = undefined;

            if (probe) {
                // Only the hidden measuring field is reset, so the visible height can transition uninterrupted.
                probe.style.setProperty('--content-height', '0px');
                probe.style.setProperty('--content-height', `${probe.scrollHeight}px`);
            }
        });
    }

    function reset() {
        // Form reset restores the value after the event has been dispatched.
        if (resetFrame !== undefined) {
            cancelAnimationFrame(resetFrame);
        }

        resetFrame = requestAnimationFrame(() => {
            resetFrame = undefined;

            if (probe && field) {
                probe.value = field.value;
                schedule();
            }
        });
    }

    let observation = observeSize((size) => {
            if (measured.height !== size.height) {
                measured.scrollable = false;
                measured.height = size.height;
                motion.settle();
            }

            if (size.width !== width) {
                width = size.width;
                schedule();
            }
        }),
        content = html`
        <textarea
            class='textarea'
            ${this?.attributes}
            ${attributes}
            ${resize && {
                ...motion.attributes,
                class: ['textarea--autoresize', () => measured.scrollable && 'textarea--scrollable'],
                style: [limits, () => measured.height && `--height: ${measured.height}px;`],
                oninput: function(this: HTMLElement, event: InputEvent) {
                    if (probe) {
                        probe.value = (event.currentTarget as HTMLTextAreaElement).value;
                        schedule();
                    }

                    caller?.call(this, event);
                }
            }}
            ${{
                class: () => state.active && '--active',
                onconnect: (element: Element<HTMLTextAreaElement>) => {
                    form.input.onconnect(state)(element);

                    if (resize) {
                        field = element;
                        motion.attributes.onconnect(element);
                        owner = element.form;
                        owner?.addEventListener('reset', reset);
                    }
                },
                ondisconnect: () => {
                    if (resize) {
                        motion.attributes.ondisconnect();
                    }

                    owner?.removeEventListener('reset', reset);
                    owner = undefined;

                    if (resetFrame !== undefined) {
                        cancelAnimationFrame(resetFrame);
                        resetFrame = undefined;
                    }

                    field = undefined;
                },
                onfocusin: () => {
                    state.active = true;
                },
                onfocusout: () => {
                    state.active = false;
                }
            }}
        ></textarea>
    `;

    if (!resize) {
        return content;
    }

    return html`
        <div class='textarea-resize'>
            ${content}
            <textarea
                aria-hidden='true'
                class='textarea textarea--measure'
                disabled
                inert
                tabindex='-1'
                ${{
                    // Mirror only sizing attributes: the probe has no name, id, validation or caller listeners.
                    class: [this?.attributes?.class, attributes.class, !native && 'textarea--measure-fallback', () => state.active && '--active'].flat(),
                    dir: attributes.dir ?? this?.attributes?.dir,
                    lang: attributes.lang ?? this?.attributes?.lang,
                    placeholder: attributes.placeholder ?? this?.attributes?.placeholder,
                    rows: attributes.rows ?? this?.attributes?.rows,
                    style: [this?.attributes?.style, attributes.style, limits].flat(),
                    value: (element: HTMLElement) => {
                        let source = attributes.value,
                            value = typeof source === 'function' ? source(field ?? element) : source;

                        schedule();
                        return value;
                    },
                    wrap: attributes.wrap ?? this?.attributes?.wrap,
                    onconnect: (element: HTMLTextAreaElement) => {
                        probe = element;
                        width = undefined;
                        observation.onconnect(element);
                        schedule();
                    },
                    ondisconnect: () => {
                        observation.ondisconnect();

                        if (frame !== undefined) {
                            cancelAnimationFrame(frame);
                            frame = undefined;
                        }

                        probe = undefined;
                    }
                }}
            ></textarea>
        </div>
    `;
});
