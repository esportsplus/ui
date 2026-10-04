import { peek, reactive, read, write, type Signal } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import icon from '~/components/icon';
import down from '@esportsplus/ui/svg/arrow-down.svg';
import up from '@esportsplus/ui/svg/arrow-up.svg';
import cross from '@esportsplus/ui/svg/close.svg';
import sliders from '@esportsplus/ui/svg/sliders.svg';
import fuzzy from './fuzzy';
import Selection from './selection';
import type { FileTreeElement as Element } from '.';


type Hit = {
    // The folder's children that match or hold a match, in the tree's order.
    children: Hit[];
    element: Element;
    match: boolean;
};

// What the finder asks of its tree.
type Host = {
    compare?: (a: Element, b: Element) => number;
    cursor: () => string | null;
    elements: Element[];
    folder: (element: Element) => boolean;
    // Moves the cursor onto the row, opening the folders down to it and scrolling it into view.
    go: (id: string) => void;
    // Hidden for good, like an excluded path: never searched, and neither is anything inside it.
    gone: (id: string) => boolean;
    // Whether folders given without children fetch them, so they hold what the search can't see yet.
    lazy: boolean;
    // Hands focus back to the tree.
    leave: VoidFunction;
    // Whether the row is on screen now, with every folder above it open.
    shows: (id: string) => boolean;
    // Filter mode's view: the folders down to the matches, in tree order, to open; null ends it. The rows are on
    // screen by the time it returns, so a match can be scrolled to straight after.
    sift: (folders: string[] | null) => void;
};

type Mode = 'filter' | 'highlight';

type Result = {
    // The folders holding a match, each before those inside it.
    folders: string[];
    matches: string[];
    // Folders whose children haven't loaded, so weren't searched.
    unloaded: number;
};


// Long enough that a burst of keys searches the tree once, short enough to follow typing.
const SETTLE = 80;


function collect(elements: Element[], query: string, host: Host, result: Result) {
    let out: Hit[] = [];

    for (let i = 0, n = elements.length; i < n; i++) {
        let element = elements[i];

        if (host.gone(element.id)) {
            continue;
        }

        let children: Hit[] = [];

        // A locked folder never opens, so nothing inside it could be shown.
        if (host.folder(element) && element.selectable !== false) {
            if (element.children) {
                children = collect(element.children, query, host, result);
            }
            else if (host.lazy) {
                result.unloaded++;
            }
        }

        let match = fuzzy(query, element.name) !== null;

        if (match || children.length) {
            out.push({ children, element, match });
        }
    }

    // Only what matches is put in order, not whole folders, so a narrow search of a large tree stays cheap.
    if (host.compare) {
        let compare = host.compare;

        out.sort((a, b) => compare(a.element, b.element));
    }

    return out;
}

function flatten(hits: Hit[], result: Result) {
    for (let i = 0, n = hits.length; i < n; i++) {
        let hit = hits[i];

        if (hit.match) {
            result.matches.push(hit.element.id);
        }

        if (hit.children.length) {
            result.folders.push(hit.element.id);
            flatten(hit.children, result);
        }
    }

    return result;
}

// Every match in the tree, closed and never built folders included, in the order the tree shows them.
function search(query: string, host: Host) {
    let result: Result = { folders: [], matches: [], unloaded: 0 };

    return flatten(collect(host.elements, query, host, result), result);
}


// The find bar laid over the tree, as VS Code's explorer has: 'highlight' marks the matches among every row,
// 'filter' leaves only them and the folders they sit in.
class Finder {
    private host: Host;
    private input: HTMLInputElement | undefined;
    // Filter mode's rows: the matches and the folders above them; null while nothing is filtered.
    private keep: Set<string> | null = null;
    private matched = new Selection();
    private matches: string[] = [];
    private query: Signal<string>;
    // Opened by a key rather than by typing, so what the input held last is selected, to type over or keep.
    private selecting = false;
    // Whether the last search filtered, so the next one ends it when it no longer does.
    private sifting = false;
    private timer: ReturnType<typeof setTimeout> | undefined;

    readonly state: {
        count: number;
        external: boolean;
        // The match the cursor was last moved to; empty when it's on none.
        current: string;
        index: number;
        mode: Mode;
        open: boolean;
        text: string;
        unloaded: number;
    };


    // 'query' is the search applied to the rows: empty while the bar is closed, and behind the input by a beat.
    constructor(mode: Mode, query: Signal<string>, host: Host) {
        this.host = host;
        this.query = query;
        this.state = reactive({ count: 0, external: false, current: '', index: -1, mode, open: false, text: '', unloaded: 0 });
    }


    // The match to stay on: the current one while it still matches, else the cursor's row if it's one. Failing both,
    // a search typed moves to the first match shown, and leaves the cursor be when none is, so typing never opens
    // folders; Enter and the arrows go on from there. Returns the match to move the cursor to, if any.
    private land(jump: boolean) {
        let matches = this.matches,
            state = this.state,
            index = matches.indexOf(state.current);

        if (index === -1) {
            index = matches.indexOf(this.host.cursor() ?? '');
        }

        if (index === -1 && jump) {
            index = matches.findIndex(this.host.shows);
        }

        state.current = matches[index] ?? '';
        state.index = index;

        return jump ? state.current : '';
    }

    private run(jump: boolean) {
        clearTimeout(this.timer);

        let state = this.state,
            text = state.open ? state.text : '',
            result = text ? search(text, this.host) : { folders: [], matches: [], unloaded: 0 },
            filter = text !== '' && state.mode === 'filter',
            sifted = filter || this.sifting;

        this.keep = filter ? new Set([...result.matches, ...result.folders]) : null;
        this.matched.replace(result.matches);
        this.matches = result.matches;
        state.count = result.matches.length;
        state.unloaded = result.unloaded;
        write(this.query, text);

        if (sifted) {
            this.sifting = filter;
            this.host.sift(filter ? result.folders : null);
        }

        // Once filtering ends, the row the reader is on is brought back into view among the rows returning.
        let target = this.land(jump) || (sifted && !filter ? this.host.cursor() : '');

        if (target) {
            this.host.go(target);
        }
    }


    close(refocus: boolean) {
        if (!this.state.open) {
            return;
        }

        this.state.open = false;
        this.run(false);

        if (refocus) {
            this.host.leave();
        }
    }

    dispose() {
        clearTimeout(this.timer);
    }

    // Tracked: whether rows are being filtered out, so an empty tree is taken for no matches rather than no files.
    filtering() {
        return this.state.mode === 'filter' && read(this.query) !== '';
    }

    hides(id: string) {
        return this.keep !== null && !this.keep.has(id);
    }

    // Keys pressed in the tree; true when the finder took the key.
    key(event: KeyboardEvent) {
        let state = this.state;

        // By code, since macOS turns Option+F into a symbol.
        if (event.altKey && (event.ctrlKey || event.metaKey) && event.code === 'KeyF') {
            this.open();
            return true;
        }

        if (!state.open) {
            return false;
        }

        if (event.key === 'Escape') {
            this.close(false);
            return true;
        }

        if (event.key === 'F3' && state.count) {
            this.step(event.shiftKey ? -1 : 1);
            return true;
        }

        // Letters typed in the tree join the search, as those typed before its input has mounted do; a space still
        // opens the row.
        if (event.key.length === 1 && event.key !== ' ' && !event.altKey && !event.ctrlKey && !event.metaKey) {
            this.type(event.key);
            return true;
        }

        return false;
    }

    // Tracked, for a row's template.
    mark(id: string) {
        return this.matched.read(id) && (this.state.current === id ? 'current' : 'true');
    }

    // Opens the bar with 'text', or with what it last held, selected, and searches straight away.
    open(text?: string) {
        let state = this.state;

        state.external = false;

        if (text !== undefined) {
            state.text = text;
        }

        this.selecting = text === undefined;

        if (state.open) {
            if (this.input) {
                this.input.value = state.text;
                this.input.focus();

                if (this.selecting) {
                    this.input.select();
                }
            }
        }
        else {
            state.open = true;
        }

        this.run(true);
    }

    // An external search field applies the same filter without creating or focusing another input.
    set(text: string) {
        this.state.external = true;
        this.state.text = text;
        this.state.open = text.trim() !== '';
        this.run(false);
    }

    // The tree changed under the search: a file added may match, one renamed may no longer.
    refresh() {
        if (!peek(this.query)) {
            return;
        }

        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.run(false), SETTLE);
    }

    render(tree: string) {
        let state = this.state;

        return html`
            ${() => state.open && !state.external && html`
                <div class='file-tree-find' role='search'>
                    <div class='file-tree-find-bar'>
                        <input
                            aria-controls='${tree}'
                            aria-label='Find'
                            autocomplete='off'
                            class='file-tree-find-input'
                            placeholder='Find'
                            spellcheck='false'
                            type='text'
                            ${{
                                'aria-invalid': () => read(this.query) !== '' && !state.count ? 'true' : 'false',
                                onconnect: (element: HTMLInputElement) => {
                                    this.input = element;
                                    element.value = state.text;
                                    element.focus({ preventScroll: true });

                                    if (this.selecting) {
                                        element.select();
                                    }
                                },
                                ondisconnect: () => {
                                    this.input = undefined;
                                },
                                oninput: (event: Event) => {
                                    state.text = (event.currentTarget as HTMLInputElement).value;
                                    clearTimeout(this.timer);
                                    this.timer = setTimeout(() => this.run(true), SETTLE);
                                },
                                onkeydown: (event: KeyboardEvent) => {
                                    if (event.isComposing) {
                                        return;
                                    }

                                    switch (event.key) {
                                        case 'ArrowDown':
                                            this.step(1);
                                            break;
                                        case 'ArrowUp':
                                            this.step(-1);
                                            break;
                                        case 'Enter':
                                        case 'F3':
                                            this.step(event.shiftKey ? -1 : 1);
                                            break;
                                        case 'Escape':
                                            this.close(true);
                                            break;
                                        default:
                                            if (!this.key(event)) {
                                                return;
                                            }
                                    }

                                    event.preventDefault();
                                }
                            }}
                        />
                        <span aria-live='polite' class='file-tree-find-count'>
                            ${() => {
                                let count = state.count;

                                if (!read(this.query)) {
                                    return '';
                                }

                                if (!count) {
                                    return 'No results';
                                }

                                return state.index === -1 ? `${count} ${count === 1 ? 'result' : 'results'}` : `${state.index + 1} of ${count}`;
                            }}
                        </span>
                        <button
                            aria-label='Previous match'
                            class='file-tree-find-button'
                            onclick='${() => this.step(-1)}'
                            title='Previous match (Shift+Enter)'
                            type='button'
                            ${{ disabled: () => !state.count && 'true' }}
                        >
                            ${icon({ 'aria-hidden': 'true', class: 'file-tree-find-icon' }, up)}
                        </button>
                        <button
                            aria-label='Next match'
                            class='file-tree-find-button'
                            onclick='${() => this.step(1)}'
                            title='Next match (Enter)'
                            type='button'
                            ${{ disabled: () => !state.count && 'true' }}
                        >
                            ${icon({ 'aria-hidden': 'true', class: 'file-tree-find-icon' }, down)}
                        </button>
                        <button
                            aria-label='Filter'
                            class='file-tree-find-button'
                            onclick='${() => this.toggle()}'
                            title='Show only matches'
                            type='button'
                            ${{ 'aria-pressed': () => state.mode === 'filter' ? 'true' : 'false' }}
                        >
                            ${icon({ 'aria-hidden': 'true', class: 'file-tree-find-icon' }, sliders)}
                        </button>
                        <button
                            aria-label='Close'
                            class='file-tree-find-button'
                            onclick='${() => this.close(true)}'
                            title='Close (Escape)'
                            type='button'
                        >
                            ${icon({ 'aria-hidden': 'true', class: 'file-tree-find-icon' }, cross)}
                        </button>
                    </div>
                    ${() => state.unloaded > 0 && html`
                        <p class='file-tree-find-note'>Unloaded folders not searched</p>
                    `}
                </div>
            `}
        `;
    }

    // Wraps round, as VS Code's does.
    step(by: 1 | -1) {
        let n = this.matches.length,
            state = this.state;

        if (!n) {
            return;
        }

        state.index = state.index === -1 ? (by === 1 ? 0 : n - 1) : (state.index + by + n) % n;
        state.current = this.matches[state.index];
        this.host.go(state.current);
    }

    toggle() {
        this.state.mode = this.state.mode === 'filter' ? 'highlight' : 'filter';
        this.run(true);
    }

    // A letter typed in the tree, when typing finds: it starts a search, or adds to the one open.
    type(character: string) {
        this.open(this.state.open ? this.state.text + character : character);
    }
}


export default Finder;
export type { Mode };
