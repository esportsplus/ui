import { effect, onCleanup, untrack } from '@esportsplus/reactivity';
import { component, type Attributes } from '@esportsplus/template';
import { EditorDocument } from '../document';
import { view, type MarkdownController, type MarkdownOptions } from './view';
import type { Callbacks } from '../view';


type MarkdownEditorAttributes = Attributes & Callbacks & {
    // Receives the controller once the editor is connected.
    controller?: (controller: MarkdownController) => void;
    // One document per tab keeps its own undo history.
    document?: EditorDocument;
    options?: MarkdownOptions | (() => MarkdownOptions);
    // Exact source text; a getter keeps following it.
    value?: string | (() => string);
};


export default component(
    function(this: { attributes?: Partial<MarkdownEditorAttributes> } | void, input: MarkdownEditorAttributes) {
        let {
                controller: receive,
                document: supplied,
                onChange,
                onSave,
                onSelection,
                options,
                value,
                ...attributes
            } = untrack(() => ({ ...this?.attributes, ...input })),
            current = () => {
                let next = input.value ?? this?.attributes?.value;

                return typeof next === 'function' ? next() : next;
            },
            settings = () => {
                let next = input.options ?? this?.attributes?.options;

                return { wrap: true, ...(typeof next === 'function' ? next() : next) };
            },
            model = supplied ?? new EditorDocument(untrack(current) ?? ''),
            editor = view(model, { onChange, onSave, onSelection }, receive),
            last: string | undefined;

        // Separate effects, so an options change never writes a stale initial value over a draft.
        onCleanup(effect(() => {
            let next = current();

            if (next === last) {
                return;
            }

            last = next;
            untrack(() => {
                if (next !== undefined && next !== model.value) {
                    editor.controller.setValue(next);
                }
            });
        }));

        onCleanup(effect(() => {
            let next = settings();

            untrack(() => editor.controller.setOptions(next, true));
        }));

        return editor.template(attributes);
    }
);
export type { MarkdownController, MarkdownEditorAttributes, MarkdownOptions };
