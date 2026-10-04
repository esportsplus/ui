import { effect, untrack } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import { EditorDocument } from './document';
import { mountEditor, type Callbacks, type Controller, type Options } from './view';

export type CodeEditorAttributes = Attributes &
    Callbacks & {
        /** Exact source text; a getter/reactive property controls subsequent values. */
        value?: string | (() => string);
        /** Supply one document per tab to retain its independent undo stack. */
        document?: EditorDocument;
        options?: Options | (() => Options);
        controller?: (controller: Controller) => void;
    };

function template(this: { attributes?: Partial<CodeEditorAttributes> } | void, input: CodeEditorAttributes) {
    let props = untrack(() => ({ ...this?.attributes, ...input })),
        {
            controller: receive,
            document: supplied,
            value,
            options,
            onChange,
            onSelection,
            onSave,
            onconnect,
            ondisconnect,
            ...attributes
        } = props,
        resolveValue = () => {
            let current = input.value ?? this?.attributes?.value;
            return typeof current === 'function' ? current() : current;
        },
        resolveOptions = () => {
            let current = input.options ?? this?.attributes?.options;
            return { ...(typeof current === 'function' ? current() : current) };
        },
        model = supplied ?? new EditorDocument(untrack(resolveValue) ?? ''),
        view: Controller | undefined,
        stop: VoidFunction | undefined;

    return html`
        <div class='code-editor' ${attributes} ${{
            onconnect: (host: HTMLElement) => {
                stop?.();
                view?.dispose();
                view = mountEditor(host, model, untrack(resolveOptions), { onChange, onSelection, onSave });
                let mounted = view;
                // Independent effects keep option changes from echoing a stale initial value over a draft.
                let lastValue: string | undefined,
                    stopValue = effect(() => {
                        let nextValue = resolveValue();
                        if (nextValue === lastValue) return;
                        lastValue = nextValue;
                        untrack(() => {
                            if (nextValue !== undefined && nextValue !== model.value) mounted.setValue(nextValue);
                        });
                    }),
                    stopOptions = effect(() => {
                        let nextOptions = resolveOptions();
                        untrack(() => mounted.setOptions(nextOptions, true));
                    });
                let disposeProps = () => {
                        stopValue();
                        stopOptions();
                    },
                    disposeView = mounted.dispose;
                stop = disposeProps;
                mounted.dispose = () => {
                    disposeProps();
                    if (stop === disposeProps) stop = undefined;
                    disposeView();
                };
                receive?.(mounted);
                onconnect?.(host);
            },
            ondisconnect: (host: HTMLElement) => {
                stop?.();
                stop = undefined;
                view?.dispose();
                view = undefined;
                ondisconnect?.(host);
            }
        }}></div>
    `;
}

export default component(template);
