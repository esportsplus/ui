import { effect, untrack } from '@esportsplus/reactivity';
import { component, type Attributes, type Renderable } from '@esportsplus/template';
import { EditorDocument } from './document';
import { view, type Callbacks, type CodeController, type Options } from './view';


type CodeEditorAttributes = EditorAttributes<CodeController, Options>;

type EditorAttributes<C, O> = Attributes & Callbacks & {
    // Receives the controller once the editor is connected.
    controller?: (controller: C) => void;
    // One document per tab keeps its own undo history.
    document?: EditorDocument;
    options?: O | (() => O);
    // Exact source text; a getter keeps following it.
    value?: string | (() => string);
};

type Hosted<O> = {
    readonly document: EditorDocument;
    setOptions(options: O, replace?: boolean): void;
    setValue(value: string): boolean;
};

type View<C> = (model: EditorDocument, callbacks: Callbacks, receive?: (controller: C) => void) => {
    controller: C;
    template: (attributes?: Attributes) => Renderable<any>;
};


// The component around an editor view, shared by the code and markdown editors. 'defaults' sit under the options.
const editor = <C extends Hosted<O>, O extends object>(view: View<C>, defaults: Partial<O> = {}) => component(
    function(this: { attributes?: Partial<EditorAttributes<C, O>> } | void, input: EditorAttributes<C, O>) {
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

                return { ...defaults, ...(typeof next === 'function' ? (next as () => O)() : next) } as O;
            },
            instance = view(supplied ?? new EditorDocument(untrack(current) ?? ''), { onChange, onSave, onSelection }, receive),
            last: string | undefined;

        // Separate effects, so an options change never writes a stale initial value over a draft.
        effect(() => {
            let next = current();

            if (next === last) {
                return;
            }

            last = next;
            untrack(() => {
                if (next !== undefined && next !== instance.controller.document.value) {
                    instance.controller.setValue(next);
                }
            });
        });

        effect(() => {
            let next = settings();

            untrack(() => instance.controller.setOptions(next, true));
        });

        return instance.template(attributes);
    }
);


export default editor<CodeController, Options>(view);
export { editor };
export type { CodeEditorAttributes, EditorAttributes };
