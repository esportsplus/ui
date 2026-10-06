import { effect, untrack } from '@esportsplus/reactivity';
import { component, type Attributes } from '@esportsplus/template';
import { EditorDocument } from './document';
import { view, type Callbacks, type CodeController, type Options } from './view';


type CodeEditorAttributes = Attributes & Callbacks & {
    // Receives the controller once the editor is connected.
    controller?: (controller: CodeController) => void;
    // One document per tab keeps its own undo history.
    document?: EditorDocument;
    options?: Options | (() => Options);
    // Exact source text; a getter keeps following it.
    value?: string | (() => string);
};


export default component(
    function(this: { attributes?: Partial<CodeEditorAttributes> } | void, input: CodeEditorAttributes) {
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

                return { ...(typeof next === 'function' ? next() : next) };
            },
            editor = view(supplied ?? new EditorDocument(untrack(current) ?? ''), { onChange, onSave, onSelection }, receive),
            last: string | undefined;

        // Separate effects, so an options change never writes a stale initial value over a draft.
        effect(() => {
            let next = current();

            if (next === last) {
                return;
            }

            last = next;
            untrack(() => {
                if (next !== undefined && next !== editor.controller.document.value) {
                    editor.controller.setValue(next);
                }
            });
        });

        effect(() => {
            let next = settings();

            untrack(() => editor.controller.setOptions(next, true));
        });

        return editor.template(attributes);
    }
);
export type { CodeEditorAttributes };
