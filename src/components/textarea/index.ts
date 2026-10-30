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
        // The owner's value the mirror last showed; any other change to the text is the field's own.
        last: unknown,
        measured = reactive({ height: 0, revision: 0, scrollable: false }),
        owner: HTMLFormElement | null | undefined,
        placeholder = attributes.placeholder ?? this?.attributes?.placeholder,
        resetFrame: number | undefined,
        limits = resize && `--max-height: ${resize.height.max}; --min-height: ${resize.height.min};`,
        caller = attributes.oninput ?? this?.attributes?.oninput;

    let motion = trackTransition('height', (running, element) => {
        measured.scrollable = !!element && !running;
    });

    function reset() {
        // Form reset restores the value after the event has been dispatched.
        if (resetFrame !== undefined) {
            cancelAnimationFrame(resetFrame);
        }

        resetFrame = requestAnimationFrame(() => {
            resetFrame = undefined;
            measured.revision++;
        });
    }

    // What the mirror lays out: the field's text, or its placeholder while empty, as a content-sized field shows.
    function text(element: HTMLElement) {
        let source = attributes.value,
            value = typeof source === 'function' ? source(field ?? element) : source;

        measured.revision;

        let current = value !== last || !field ? String(value ?? '') : field.value;

        last = value;

        return current || String((typeof placeholder === 'function' ? placeholder(element) : placeholder) ?? '');
    }

    let observation = observeSize((size) => {
            if (measured.height !== size.height) {
                measured.scrollable = false;
                measured.height = size.height;
                motion.settle();
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
                onconnect: (element: Element<HTMLTextAreaElement>) => {
                    field = element;
                    motion.attributes.onconnect(element);
                    owner = element.form;
                    // A form's reset never reaches the field's own bindings, so it is heard on the form.
                    owner?.addEventListener('reset', reset);
                },
                ondisconnect: () => {
                    motion.attributes.ondisconnect();
                    owner?.removeEventListener('reset', reset);
                    owner = undefined;

                    if (resetFrame !== undefined) {
                        cancelAnimationFrame(resetFrame);
                        resetFrame = undefined;
                    }

                    field = undefined;
                },
                oninput: function(this: HTMLElement, event: InputEvent) {
                    measured.revision++;
                    caller?.call(this, event);
                },
                style: [limits, () => measured.height && `--height: ${measured.height}px;`]
            }}
            ${form.input.attributes(state)}
        ></textarea>
    `;

    if (!resize) {
        return content;
    }

    // The mirror holds the field's text in its own box, sized as the field would be to fit it; the field animates to
    // the height observed on it. Mirrors only what sizes the text: no name, id, validation or caller listeners.
    return html`
        <div class='textarea-resize'>
            ${content}
            <div
                aria-hidden='true'
                class='textarea textarea--measure'
                inert
                ${{
                    class: [
                        this?.attributes?.class,
                        attributes.class,
                        (attributes.wrap ?? this?.attributes?.wrap) === 'off' && 'textarea--measure-nowrap',
                        () => state.active && '--active'
                    ].flat(),
                    'data-value': text,
                    dir: attributes.dir ?? this?.attributes?.dir,
                    lang: attributes.lang ?? this?.attributes?.lang,
                    onconnect: observation.onconnect,
                    ondisconnect: observation.ondisconnect,
                    style: [this?.attributes?.style, attributes.style, limits].flat()
                }}
            ></div>
        </div>
    `;
});
