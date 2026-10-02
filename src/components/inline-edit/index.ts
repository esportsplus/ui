import { component, html, type Attributes } from '@esportsplus/template';
import { flush, reactive } from '@esportsplus/reactivity';
import input from '~/components/input';
import textarea from '~/components/textarea';
import rich from './rich';
import status, { INLINE_EDIT_STATUS, type Status } from './status';
import check from '@esportsplus/ui/svg/check.svg';
import pencil from '@esportsplus/ui/svg/pencil.svg';
import './scss/index.scss';


type A = Attributes & {
    [INLINE_EDIT_DISPLAY]?: Attributes;
    [INLINE_EDIT_FIELD]?: Field;
    [INLINE_EDIT_STATUS]?: Attributes;
    label: string;
    multiline?: boolean;
    // A returned promise holds the status at saving until it settles.
    onsave?: (value: string) => unknown;
    placeholder?: string;
    state?: State;
    // Shows the save status under the field; pass a Status to read or drive it from outside.
    status?: boolean | Status;
    value?: string;
};

type D = Attributes & Pick<A, typeof INLINE_EDIT_DISPLAY | typeof INLINE_EDIT_FIELD | typeof INLINE_EDIT_STATUS>;

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
        status: shown = false,
        value = '',
        state = reactive({ editing: false, saved: false, value }),
        ...attributes
    }: A
) {
    let display: HTMLElement | undefined,
        draft = '',
        local = reactive({ draft: '' }),
        parts = { ...this?.attributes?.[INLINE_EDIT_FIELD], ...attributes[INLINE_EDIT_FIELD] },
        saving = shown ? (shown === true ? reactive<Status>({ phase: 'saved', savedAt: null }) : shown) : null,
        report = saving ? status.track(saving, () => state.editing && clean(local.draft) !== state.value) : null,
        timer: ReturnType<typeof setTimeout> | undefined;

    function clean(value: string) {
        return multiline ? value.trim() : value.replace(/\s+/g, ' ').trim();
    }

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

        // Keyboard exits hand focus back to the text; a click elsewhere keeps focus wherever the click put it, once the
        // display is visible again.
        if (keyboard) {
            flush();
            display?.focus();
        }

        let next = clean(local.draft);

        if (!commit || next === state.value) {
            return;
        }

        state.value = next;
        state.saved = true;

        let result = onsave?.(next);

        report?.(result);
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
                    () => state.saved && 'inline-edit--saved',
                    () => state.value.trim() === '' && 'inline-edit--empty'
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
                    onconnect: (element: HTMLElement) => {
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
                <svg class='inline-edit-icon-pencil'><use href='#${pencil}' /></svg>
                <svg class='inline-edit-icon-check'><use href='#${check}' /></svg>
            </span>
            ${saving && status.render(saving, this?.attributes?.[INLINE_EDIT_STATUS], attributes[INLINE_EDIT_STATUS])}
        </div>
    `;
}


const plain = component(template, { display: INLINE_EDIT_DISPLAY, field: INLINE_EDIT_FIELD, status: INLINE_EDIT_STATUS });

const inlineEdit: typeof plain & { rich: typeof rich } = Object.assign(plain, { rich });


export default inlineEdit;
export type { Status };
