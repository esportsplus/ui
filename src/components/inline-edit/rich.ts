import { effect, reactive, read, signal, write } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import markdown, { type MarkdownController, type MarkdownOptions } from '~/components/editor/markdown';
import icon from '~/components/icon';
import { mac } from '~/shared/platform';
import status, { INLINE_EDIT_STATUS, type Status } from './status';
import type { Tool } from '~/components/editor/markdown/toolbar';
import checkSvg from '@esportsplus/ui/svg/check.svg';
import pencilSvg from '@esportsplus/ui/svg/pencil.svg';
import './scss/index.scss';


type A = Attributes & {
    [INLINE_EDIT_RICH_EDITOR]?: Attributes;
    [INLINE_EDIT_STATUS]?: Attributes;
    // The toolbar's tools; markdown typed or pasted outside them still formats.
    features?: Tool[];
    label: string;
    multiline?: boolean;
    onconnect?: never;
    ondisconnect?: never;
    // A returned promise holds the status at saving until it settles.
    onsave?: (value: string) => unknown;
    placeholder?: string;
    state?: State;
    // Shows the save status under the field; pass a Status to read or drive it from outside.
    status?: boolean | Status;
    value?: string;
};

type State = {
    editing: boolean;
    saved: boolean;
    value: string;
};


const BASE: Tool[] = ['bold', 'italic', 'link', 'copy'];

const INLINE_EDIT_RICH_EDITOR = Symbol.for('@esportsplus/ui/inline-edit.rich.editor');

// Mod+Enter saves here, so the editor's own binding for it (a blank line) is off.
const KEYBINDINGS = { 'Mod+Enter': null };

const SPACES = /\s+/g;


// The markdown editor in its inline mode: it rests as text, edits in place with the formatting toolbar over a
// selection, and saves when focus leaves, on Enter for one line or Mod+Enter for several; Escape puts the text back.
export default component(
    function(
        this: { attributes?: Pick<A, typeof INLINE_EDIT_RICH_EDITOR | typeof INLINE_EDIT_STATUS> } | void,
        {
            features = BASE,
            label,
            multiline = false,
            onsave,
            placeholder = '',
            status: indicator = false,
            value = '',
            state = reactive({ editing: false, saved: false, value }),
            ...attributes
        }: A
    ) {
        let apple = mac(),
            controller: MarkdownController | undefined,
            current = signal(state.value),
            // The saved value as this field holds it: what an edit differs from.
            pristine = signal(state.value),
            root: HTMLElement | undefined,
            saving = status.saver(state, indicator, () => clean(read(current)) !== read(pristine), onsave),
            defaults = this?.attributes?.[INLINE_EDIT_RICH_EDITOR],
            own = attributes[INLINE_EDIT_RICH_EDITOR],
            options: MarkdownOptions = {
                inline: true,
                keybindings: KEYBINDINGS,
                label,
                placeholder,
                singleLine: !multiline,
                toolbar: features
            };

        // A value set from outside while the field rests shows at once.
        effect(() => state.value, (next, previous) => {
            if (previous !== undefined && !state.editing && next !== read(pristine)) {
                write(pristine, next);
                controller?.setValue(next);
            }
        });

        function clean(text: string) {
            return multiline ? text.trim() : text.replace(SPACES, ' ').trim();
        }

        function finish(commit: boolean, keyboard: boolean) {
            if (!state.editing || !controller) {
                return;
            }

            state.editing = false;

            if (commit) {
                save();
            }
            else {
                controller.setValue(read(pristine));
            }

            if (keyboard) {
                let active = root?.ownerDocument.activeElement;

                if (active instanceof HTMLElement && root?.contains(active)) {
                    active.blur();
                }
            }
        }

        function save() {
            let next = clean(read(current));

            if (next === read(pristine)) {
                return;
            }

            write(pristine, next);

            if (controller && controller.document.value !== next) {
                controller.setValue(next);
            }

            saving.save(next);
        }

        return html`
            <div
                class='inline-edit inline-edit--rich'
                ${this?.attributes}
                ${attributes}
                ${{
                    class: [
                        multiline && 'inline-edit--multiline',
                        () => state.editing && '--active',
                        () => state.saved && 'inline-edit--saved'
                    ],
                    // Direct: delegation only runs the nearest bound handler, and the editor binds these itself.
                    onconnect: (element: HTMLElement, on) => {
                        root = element;
                        on(element, 'focusin', () => {
                            state.editing = true;
                        }, { direct: true });
                        // Focus moving between the text and its toolbar stays in the edit.
                        on(element, 'focusout', (e: FocusEvent) => {
                            if (!root?.contains(e.relatedTarget as Node | null)) {
                                finish(true, false);
                            }
                        }, { direct: true });
                        // Bubbled from the text: the editor and its toolbar keep the keys they handle.
                        on(element, 'keydown', (e: KeyboardEvent) => {
                            if (e.defaultPrevented || e.isComposing) {
                                return;
                            }

                            if (e.key === 'Escape') {
                                e.preventDefault();
                                finish(false, true);
                            }
                            else if (e.key === 'Enter' && (!multiline || (apple ? e.metaKey : e.ctrlKey))) {
                                e.preventDefault();
                                finish(true, true);
                            }
                        }, { direct: true });
                    },
                    ondisconnect: saving.dispose
                }}
            >
                ${markdown({
                    ...defaults,
                    ...own,
                    class: ['inline-edit-editor', defaults?.class ?? [], own?.class ?? []].flat(),
                    controller: (next: MarkdownController) => {
                        controller = next;
                    },
                    // A box ticked while the field rests saves at once; mid-edit it goes with the rest.
                    onChange: (next: string) => {
                        write(current, next);

                        if (!state.editing) {
                            save();
                        }
                    },
                    options,
                    value: state.value
                })}
                <span aria-hidden='true' class='inline-edit-icon'>
                    ${icon({ class: 'inline-edit-icon-pencil' }, pencilSvg)}
                    ${icon({ class: 'inline-edit-icon-check' }, checkSvg)}
                </span>
                ${saving.status && status.render(saving.status, this?.attributes?.[INLINE_EDIT_STATUS], attributes[INLINE_EDIT_STATUS])}
            </div>
        `;
    },
    { editor: INLINE_EDIT_RICH_EDITOR, status: INLINE_EDIT_STATUS }
);

export type { Status, Tool as Feature };
