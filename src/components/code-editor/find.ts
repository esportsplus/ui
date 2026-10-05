import { flush, reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import icon from '~/components/icon';
import input from '~/components/input';
import { nextMatch, replaceMatches, searchDocument, type Match, type SearchOptions, type SearchResult } from './search';
import type { EditorDocument, Selection } from './document';
import down from '@esportsplus/ui/svg/arrow-down.svg';
import up from '@esportsplus/ui/svg/arrow-up.svg';
import close from '@esportsplus/ui/svg/close.svg';


type Host = {
    document: EditorDocument;
    // Applies a document edit through the editor, so it reveals and records it like any command.
    edit: (run: () => boolean) => boolean;
    // Returns focus to the text.
    focus: VoidFunction;
    readonly: () => boolean;
    // Selects and scrolls to a match.
    reveal: (match: Match) => void;
    // The primary selection, read back from the native field first.
    selection: () => Selection;
    // Highlights changed.
    update: VoidFunction;
};

type Toggle = { key: keyof SearchOptions; label: string; title: string };


const EMPTY: SearchResult = { error: '', matches: [], truncated: false };

const TOGGLES: Toggle[] = [
    { key: 'caseSensitive', label: 'Aa', title: 'Match case' },
    { key: 'wholeWord', label: 'ab', title: 'Match whole word' },
    { key: 'regex', label: '.*', title: 'Use regular expression' }
];


// First match ending at or after 'offset'.
function matchAt(matches: readonly Match[], offset: number) {
    let hi = matches.length,
        lo = 0;

    while (lo < hi) {
        let mid = (lo + hi) >>> 1;

        if (matches[mid].to < offset) {
            lo = mid + 1;
        }
        else {
            hi = mid;
        }
    }

    return lo;
}

// An icon button labelled for assistive technology, with the label as its native tooltip.
function action(label: string, href: string, onclick: VoidFunction) {
    return html`
        <button aria-label='${label}' class='button code-editor-find-button' title='${label}' type='button' ${{ onclick }}>
            ${icon({ 'aria-hidden': 'true', class: 'code-editor-find-icon' }, href)}
        </button>
    `;
}


// Find and replace over a document: results are remembered per text revision and query (and patched around edits for
// literal queries), and the bar is plain library inputs and buttons. The markdown editor can share it with its own host.
const find = (host: Host) => {
    let field: HTMLInputElement | undefined,
        options: SearchOptions = {},
        replacement: HTMLInputElement | undefined,
        result = EMPTY,
        state = reactive({
            caseSensitive: false,
            error: '',
            index: -1,
            open: false,
            query: '',
            regex: false,
            replace: false,
            replaceable: false,
            replacement: '',
            status: '0 / 0',
            truncated: false,
            wholeWord: false
        });

    function current() {
        let next = state.query ? searchDocument(host.document, state.query, options, state.replacement) : EMPTY;

        if (next !== result) {
            result = next;
            state.index = -1;
            status();
        }

        return result;
    }

    // A button that disables itself would drop focus out of the bar, where Escape no longer reaches it.
    function keep(e: MouseEvent, run: VoidFunction) {
        let button = e.currentTarget as HTMLButtonElement;

        run();
        current();
        flush();

        if (button.disabled) {
            replacement?.focus();
        }
    }

    function navigate(backwards: boolean) {
        let matches = current().matches,
            selection = host.selection(),
            index = nextMatch(matches, selection.start, selection.end, backwards, state.index),
            match = matches[index];

        if (!match) {
            return null;
        }

        state.index = index;
        status();
        host.reveal(match);

        return match;
    }

    function refresh() {
        current();
        host.update();

        return result;
    }

    // Mod+F or Mod+H inside the bar: the field for it takes focus, with the replace row shown for Mod+H.
    function reopen(replace: boolean) {
        let target = replace ? replacement : field;

        state.replace ||= replace;
        // The row must be displayed before its field can take focus.
        flush();
        target?.focus();
        target?.select();
    }

    function status() {
        state.error = result.error;
        state.replaceable = !host.readonly() && result.matches.length > 0 && !result.error;
        state.status = result.error || `${state.index >= 0 ? state.index + 1 : 0} / ${result.matches.length}${result.truncated ? '+' : ''}`;
        state.truncated = result.truncated;
    }

    function toggle({ key, label, title }: Toggle) {
        return html`
            <button
                aria-label='${title}'
                class='button code-editor-find-button code-editor-find-button--toggle'
                title='${title}'
                type='button'
                ${{
                    'aria-pressed': () => state[key] ? 'true' : 'false',
                    class: () => state[key] && '--active',
                    onclick: () => {
                        options = { ...options, [key]: !options[key] };
                        state[key] = !!options[key];
                        refresh();
                    }
                }}
            >
                ${label}
            </button>
        `;
    }

    let api = {
        close: () => {
            state.open = false;
            state.query = '';
            refresh();
            host.focus();
        },
        find: (query = state.query, next: SearchOptions = options) => {
            options = { ...next };
            state.caseSensitive = !!options.caseSensitive;
            state.query = query;
            state.regex = !!options.regex;
            state.wholeWord = !!options.wholeWord;

            return refresh();
        },
        // Matches from the one ending at or after 'from', for highlighting a range of the text.
        matches: (from: number) => {
            let matches = state.open || state.query ? current().matches : EMPTY.matches;

            return { index: matchAt(matches, from), matches };
        },
        next: () => navigate(false),
        open: (replace = false) => {
            let selection = host.selection(),
                selected = host.document.value.slice(selection.start, selection.end);

            if (selected && !/[\r\n]/.test(selected)) {
                api.find(selected);
            }

            state.open = true;
            state.replace = replace;
            // The bar must be displayed before its field can take focus.
            flush();
            field?.focus();
            field?.select();
        },
        previous: () => navigate(true),
        replace: (text: string) => host.edit(() => {
            state.replacement = text;

            let index = state.index,
                matches = current().matches,
                selection = host.selection();

            if (index < 0 || matches[index]?.from !== selection.start || matches[index]?.to !== selection.end) {
                state.index = -1;
                navigate(false);
                index = state.index;
            }

            return index >= 0 && replaceMatches(host.document, result, false, index);
        }),
        replaceAll: (text: string) => host.edit(() => {
            state.replacement = text;

            return replaceMatches(host.document, current());
        }),
        result: () => current(),
        state,
        // Keeps the replace buttons' state current after a readonly change.
        status,
        template: () => html`
            <div
                aria-label='Find and replace'
                class='code-editor-find'
                role='search'
                ${{
                    class: () => state.open && '--active',
                    onkeydown: (e: KeyboardEvent) => {
                        if (e.isComposing) {
                            return;
                        }

                        let mod = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey,
                            key = e.key.toLowerCase();

                        if (e.key === 'Escape') {
                            e.preventDefault();
                            api.close();
                        }
                        else if (mod && (key === 'f' || key === 'h')) {
                            e.preventDefault();
                            reopen(key === 'h');
                        }
                        else if (
                            ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') ||
                            (e.key === 'Enter' && (e.target === field || e.target === replacement))
                        ) {
                            e.preventDefault();
                            navigate(e.shiftKey);
                        }
                    }
                }}
            >
                <div class='code-editor-find-row'>
                    ${input({
                        'aria-invalid': () => state.error ? 'true' : 'false',
                        'aria-label': 'Find text',
                        autocomplete: 'off',
                        class: 'code-editor-find-input',
                        onconnect: (element: HTMLInputElement) => {
                            field = element;
                        },
                        oninput: (e: Event) => {
                            state.query = (e.target as HTMLInputElement).value;
                            refresh();
                        },
                        placeholder: 'Find',
                        spellcheck: false,
                        value: () => state.query
                    })}
                    ${TOGGLES.map(toggle)}
                    <span aria-live='polite' class='code-editor-find-status'>${() => state.status}</span>
                    ${action('Previous match', up, () => navigate(true))}
                    ${action('Next match', down, () => navigate(false))}
                    ${action('Close find', close, () => api.close())}
                </div>
                <div class='code-editor-find-row code-editor-find-row--replace' ${{ class: () => state.replace && '--active' }}>
                    ${input({
                        'aria-label': 'Replacement text',
                        autocomplete: 'off',
                        class: 'code-editor-find-input',
                        onconnect: (element: HTMLInputElement) => {
                            replacement = element;
                        },
                        oninput: (e: Event) => {
                            state.replacement = (e.target as HTMLInputElement).value;
                            refresh();
                        },
                        placeholder: 'Replace',
                        spellcheck: false,
                        value: () => state.replacement
                    })}
                    <button
                        class='button code-editor-find-button code-editor-find-button--text'
                        type='button'
                        ${{ disabled: () => !state.replaceable, onclick: (e: MouseEvent) => keep(e, () => api.replace(state.replacement)) }}
                    >
                        Replace
                    </button>
                    <button
                        class='button code-editor-find-button code-editor-find-button--text'
                        type='button'
                        ${{
                            disabled: () => !state.replaceable || state.truncated,
                            onclick: (e: MouseEvent) => keep(e, () => api.replaceAll(state.replacement))
                        }}
                    >
                        Replace all
                    </button>
                </div>
            </div>
        `
    };

    return api;
};


export { action, find, matchAt };
