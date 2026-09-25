import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import input from '~/components/input';
import textarea from '~/components/textarea';
import './scss/index.scss';


type A = Attributes & {
    [INLINE_EDIT_DISPLAY]?: Attributes;
    [INLINE_EDIT_FIELD]?: Field;
    label: string;
    multiline?: boolean;
    onsave?: (value: string) => void;
    placeholder?: string;
    state?: State;
    value?: string;
};

type D = Attributes & Pick<A, typeof INLINE_EDIT_DISPLAY | typeof INLINE_EDIT_FIELD>;

type Field = Parameters<typeof input>[0];

type State = {
    editing: boolean;
    saved: boolean;
    value: string;
};


const INLINE_EDIT_DISPLAY = Symbol.for('@esportsplus/ui/inline-edit.display');

const INLINE_EDIT_FIELD = Symbol.for('@esportsplus/ui/inline-edit.field');

// Long enough to notice after the field settles, short enough that the pencil is back before the next edit.
const SAVED_FOR = 1600;


function template(
    this: { attributes?: D } | void,
    {
        label,
        multiline = false,
        onsave,
        placeholder = '',
        value = '',
        state = reactive({ editing: false, saved: false, value }),
        ...attributes
    }: A
) {
    let display: HTMLElement | undefined,
        draft = '',
        local = reactive({ draft: '' }),
        parts = { ...this?.attributes?.[INLINE_EDIT_FIELD], ...attributes[INLINE_EDIT_FIELD] },
        timer: ReturnType<typeof setTimeout> | undefined;

    function field() {
        let own = {
            'aria-label': label,
            class: 'inline-edit-field',
            onblur: () => finish(true, false),
            onconnect: (element: HTMLInputElement | HTMLTextAreaElement) => {
                element.focus();
                // Caret at the end, where most edits start.
                element.setSelectionRange(element.value.length, element.value.length);
            },
            oninput: (e: Event) => {
                local.draft = (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
            },
            onkeydown: (e: KeyboardEvent) => {
                // Shift+Enter still adds a line break to a multiline field.
                if (e.key === 'Enter' && !(multiline && e.shiftKey)) {
                    e.preventDefault();
                    finish(true, true);
                }
                else if (e.key === 'Escape') {
                    e.preventDefault();
                    finish(false, true);
                }
            },
            placeholder,
            value: draft
        };

        if (multiline) {
            return textarea.bind({ attributes: parts })({ ...own, rows: 1 });
        }

        return input.call({ attributes: parts }, own);
    }

    function finish(commit: boolean, keyboard: boolean) {
        if (!state.editing) {
            return;
        }

        state.editing = false;

        // Keyboard exits hand focus back to the text; a click elsewhere keeps focus wherever the click put it.
        // Deferred until the display is visible again; class updates are batched onto the next frame.
        if (keyboard) {
            requestAnimationFrame(() => requestAnimationFrame(() => display?.focus()));
        }

        let next = multiline ? local.draft.trim() : local.draft.replace(/\s+/g, ' ').trim();

        if (!commit || next === state.value) {
            return;
        }

        state.value = next;
        state.saved = true;
        onsave?.(next);

        clearTimeout(timer);
        timer = setTimeout(() => {
            state.saved = false;
        }, SAVED_FOR);
    }

    return html`
        <div
            class='inline-edit'
            ${this?.attributes}
            ${attributes}
            ${{
                class: [
                    multiline && 'inline-edit--multiline',
                    () => state.editing && '--active',
                    () => state.saved && '--saved',
                    () => state.value.trim() === '' && '--empty'
                ],
                ondisconnect: () => {
                    clearTimeout(timer);
                }
            }}
        >
            <button
                class='inline-edit-display'
                type='button'
                ${this?.attributes?.[INLINE_EDIT_DISPLAY]}
                ${attributes[INLINE_EDIT_DISPLAY]}
                ${{
                    onclick: () => {
                        draft = state.value;
                        local.draft = draft;
                        state.editing = true;
                    },
                    onrender: (element: HTMLElement) => {
                        display = element;
                    }
                }}
            >
                <span class='inline-edit-label'>Edit ${label}: </span>
                ${() => {
                    // While editing it mirrors the draft so the cell (and a multiline field) grows with it; the trailing space keeps a new empty line from collapsing.
                    if (state.editing) {
                        return `${local.draft} `;
                    }

                    return state.value.trim() === '' ? placeholder : state.value;
                }}
            </button>
            ${() => state.editing ? field() : ''}
            <span aria-hidden='true' class='inline-edit-icon'>
                <svg class='inline-edit-icon-pencil' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
                    <path d='M9.75 3.75 12.25 6.25M3.25 12.75l.6-2.6 6.9-6.9a1.25 1.25 0 0 1 1.77 0l.73.73a1.25 1.25 0 0 1 0 1.77l-6.9 6.9Z' />
                </svg>
                <svg class='inline-edit-icon-check' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
                    <path d='m3.5 8.5 3 3 6-7' />
                </svg>
            </span>
        </div>
    `;
}


export default Object.assign(template, { display: INLINE_EDIT_DISPLAY, field: INLINE_EDIT_FIELD } as const);
