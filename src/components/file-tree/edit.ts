import { read, type Signal } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { FileTreeElement as Element } from './index';


type Draft<R> = {
    // Set while the consumer's callback settles; the input takes no edits meanwhile.
    busy: Signal<boolean>;
    // The element being renamed; null while naming a new one.
    element: Element | null;
    // The row focused before a new item's input opened, focused again once it closes.
    from: R | null;
    kind: Kind;
    message: Signal<string>;
    // The folder the name lands in; null at the top level.
    parent: R | null;
    row: R;
    // The stem is selected when the input first shows; the row scrolling back into view leaves the caret be.
    selected: boolean;
    value: string;
};

type Handlers = {
    blur: VoidFunction;
    cancel: VoidFunction;
    input: (value: string) => void;
    submit: VoidFunction;
};

type Kind = 'file' | 'folder';

type Listener = (request: Request) => void;

type Request = {
    action: 'cancel' | 'rename' | Kind;
    // The row to act on: undefined for the focused one, null for the top level.
    target?: string | null;
};

// false keeps the input open; an error, thrown or rejected, keeps it open showing the error's message.
type Result = boolean | void | Promise<boolean | void>;


// Windows' list, the strictest of the platforms, plus control characters.
const INVALID = /[\\/:*?"<>|\x00-\x1f]/;


function check(name: string, path: boolean) {
    if (!name.trim()) {
        return 'A file or folder name must be provided';
    }

    if (name !== name.trim()) {
        return 'Leading or trailing whitespace detected in file or folder name';
    }

    if (name === '.' || name === '..') {
        return `${name} is not a valid file or folder name`;
    }

    if (INVALID.test(name)) {
        return path ? 'Names can\'t contain \\ : * ? " < > |' : 'Names can\'t contain \\ / : * ? " < > |';
    }

    return '';
}

function exists(name: string) {
    return `A file or folder ${name} already exists at this location`;
}

function field<R>(draft: Draft<R>, id: string, on: Handlers) {
    return html`
        <input
            aria-describedby='${id}-message'
            aria-label='${draft.element ? `Rename ${draft.element.name}` : `New ${draft.kind} name`}'
            autocomplete='off'
            class='file-tree-input'
            spellcheck='false'
            type='text'
            ${{
                'aria-invalid': () => read(draft.message) ? 'true' : 'false',
                onblur: (event: FocusEvent) => {
                    let element = event.currentTarget as HTMLInputElement;

                    // Scrolling the row out of the list removes the input, and switching windows blurs it; neither
                    // is the reader leaving the edit.
                    queueMicrotask(() => {
                        if (element.isConnected && document.hasFocus()) {
                            on.blur();
                        }
                    });
                },
                // Shadows the row's own click, which would activate it.
                onclick: () => {},
                onconnect: (element: HTMLInputElement) => {
                    element.value = draft.value;
                    element.focus({ preventScroll: true });

                    if (!draft.selected) {
                        draft.selected = true;
                        element.setSelectionRange(0, stem(draft.value, draft.kind));
                    }
                },
                oninput: (event: Event) => {
                    on.input((event.currentTarget as HTMLInputElement).value);
                },
                onkeydown: (event: KeyboardEvent) => {
                    if (event.isComposing) {
                        return;
                    }

                    if (event.key === 'Enter') {
                        event.preventDefault();
                        on.submit();
                    }
                    else if (event.key === 'Escape') {
                        event.preventDefault();
                        on.cancel();
                    }
                },
                readonly: () => read(draft.busy) && 'true'
            }}
        />
        ${() => read(draft.message) && html`
            <span class='file-tree-message' id='${id}-message' role='alert'>${read(draft.message)}</span>
        `}
    `;
}

// Checks what's typed. A new item's path walks through the folders that already exist: the item lands in the
// deepest one, and the rest of the path is what the consumer creates.
function resolve(
    value: string,
    parent: Element | null,
    renaming: Element | null,
    children: (parent: Element | null) => Element[],
    folder: (element: Element) => boolean
) {
    let parts = renaming ? [value] : value.split('/');

    for (let i = 0, n = parts.length; i < n; i++) {
        let message = check(parts[i], !renaming);

        if (message) {
            return { message, parent, parts };
        }
    }

    let i = 0,
        siblings = children(parent);

    for (let n = parts.length - 1; i < n; i++) {
        let match = sibling(siblings, parts[i], renaming);

        if (!match) {
            break;
        }

        if (!folder(match)) {
            return { message: exists(parts[i]), parent, parts };
        }

        parent = match;
        siblings = children(match);
    }

    // Past the first missing folder nothing exists yet, so only a path of existing folders can end on a taken name.
    if (sibling(siblings, parts[i], renaming)) {
        return { message: exists(parts[i]), parent, parts };
    }

    return { message: '', parent, parts: parts.slice(i) };
}

// Case-insensitive, since the tree can't tell which filesystem it mirrors and most treat names that way.
function sibling(siblings: Element[], name: string, renaming: Element | null) {
    let key = name.toLowerCase();

    return siblings.find((element) => element !== renaming && element.name.toLowerCase() === key);
}

// The part of a name a rename most often changes: 'index' of 'index.ts', but a folder's or dotfile's whole name.
function stem(name: string, kind: Kind) {
    let dot = name.lastIndexOf('.');

    return kind === 'folder' || dot <= 0 ? name.length : dot;
}


// Starts inline edits from outside the tree, like a toolbar's New File button.
class Editor {
    private listeners: Listener[] = [];


    private notify(request: Request) {
        for (let i = 0, n = this.listeners.length; i < n; i++) {
            this.listeners[i](request);
        }
    }


    cancel() {
        this.notify({ action: 'cancel' });
    }

    // Inside the target when it's a folder, beside it when it's a file.
    create(kind: Kind, target?: string | null) {
        this.notify({ action: kind, target });
    }

    rename(target?: string) {
        this.notify({ action: 'rename', target });
    }

    subscribe(listener: Listener) {
        this.listeners.push(listener);

        return () => {
            let i = this.listeners.indexOf(listener);

            if (i !== -1) {
                this.listeners.splice(i, 1);
            }
        };
    }
}


export default Editor;
export { field, resolve };
export type { Draft, Kind, Request, Result };
