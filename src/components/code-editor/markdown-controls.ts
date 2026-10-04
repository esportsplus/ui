import { flush, reactive, root } from '@esportsplus/reactivity';
import { html, render } from '@esportsplus/template';
import { lineEnd } from './document';
import { highlightLine, type LexState } from './highlight';
import { nextMatch, replaceMatches, search, type SearchOptions, type SearchResult } from './search';
import type { Controller } from './view';

type Geometry = { total: number; top: number; height: number; from: number; to: number; y(offset: number): number; scroll(y: number): void };
type ControlsOptions = { readonly?: boolean; minimap?: boolean; whitespace?: boolean };
type Mark = { style: string; className: string; text: string };
export function mountMarkdownControls(host: HTMLElement, controller: Controller, geometry: () => Geometry, mutable: () => boolean, initial: ControlsOptions) {
    return root(disposeScope => {
        let doc = controller.document, dom = host.ownerDocument, win = dom.defaultView!, layer = dom.createElement('div'), disposed = false, frame = 0,
            query = '', searchOptions: SearchOptions = {}, active = -1, result: SearchResult = search(doc.value, ''), options = initial,
            ui = reactive({ findOpen: false, replaceOpen: false, query: '', replacement: '', status: '', error: '', invalid: false, goOpen: false, go: '', goInvalid: false,
                readonly: !!initial.readonly, minimap: !!initial.minimap, thumb: '', mapHeight: 320, caseSensitive: false, wholeWord: false, regex: false, allDisabled: true, replaceDisabled: true }),
            mapRevision = -1, mapRows: { from: number; spans: { from: number; to: number; color: string }[] }[] = [],
            marks = reactive([] as Mark[]), bars = reactive([] as { style: string }[]),
            choices: { key: keyof SearchOptions; label: string }[] = [{ key: 'caseSensitive', label: 'Match case' }, { key: 'wholeWord', label: 'Whole word' }, { key: 'regex', label: 'Regex' }];
        layer.className = 'markdown-controls'; host.append(layer);
        function refreshSearch() {
            result = search(doc.value, query, searchOptions, ui.replacement); active = result.matches.findIndex(match => match.from === doc.selection.start && match.to === doc.selection.end);
            ui.error = result.error; ui.invalid = !!result.error;
            ui.status = result.error || `${active >= 0 ? active + 1 : 0} / ${result.matches.length}${result.truncated ? '+' : ''}`;
            ui.caseSensitive = !!searchOptions.caseSensitive; ui.wholeWord = !!searchOptions.wholeWord; ui.regex = !!searchOptions.regex;
            ui.replaceDisabled = ui.readonly || !!result.error || !result.matches.length; ui.allDisabled = ui.replaceDisabled || result.truncated;
            schedule(); return result;
        }
        function navigate(backwards: boolean) {
            if (disposed) return null;
            active = nextMatch(result.matches, doc.selection.start, doc.selection.end, backwards, active);
            let match = result.matches[active]; if (!match) return null;
            controller.select({ start: match.from, end: match.to }); ui.status = `${active + 1} / ${result.matches.length}${result.truncated ? '+' : ''}`; schedule(); return match;
        }
        let unrender = render(layer, {}, () => html`
            <div class='markdown-find' role='search' aria-label='Find and replace' ${{ hidden: () => !ui.findOpen, onkeydown: (e: KeyboardEvent) => {
                if (e.isComposing) return;
                if (e.key === 'Escape') { e.preventDefault(); api.closeFind(); }
                else if (e.key === 'Enter' || (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') { e.preventDefault(); navigate(e.shiftKey); }
            } }}>
                <input aria-label='Find text' placeholder='Find' ${{ value: () => ui.query, 'aria-invalid': () => String(ui.invalid), oninput: (e: Event) => { query = ui.query = (e.target as HTMLInputElement).value; refreshSearch(); } }}>
                <input aria-label='Replacement text' placeholder='Replace' ${{ value: () => ui.replacement, hidden: () => !ui.replaceOpen, oninput: (e: Event) => { ui.replacement = (e.target as HTMLInputElement).value; refreshSearch(); } }}>
                <button type='button' ${{ onclick: () => navigate(true) }}>Previous</button><button type='button' ${{ onclick: () => navigate(false) }}>Next</button>
                <button type='button' ${{ hidden: () => !ui.replaceOpen, disabled: () => ui.replaceDisabled, onclick: () => api.replace(ui.replacement) }}>Replace</button>
                <button type='button' ${{ hidden: () => !ui.replaceOpen, disabled: () => ui.allDisabled, onclick: () => api.replaceAll(ui.replacement) }}>Replace all</button>
                ${choices.map(choice => html`<button type='button' ${{ 'aria-pressed': () => String(ui[choice.key]), onclick: () => { searchOptions = { ...searchOptions, [choice.key]: !searchOptions[choice.key] }; refreshSearch(); } }}>${choice.label}</button>`)}
                <span aria-live='polite'>${() => ui.status}</span><button type='button' ${{ onclick: () => api.closeFind() }}>Close</button>
            </div>
            <form class='markdown-go' ${{ hidden: () => !ui.goOpen, onsubmit: (e: SubmitEvent) => {
                e.preventDefault(); let match = /^\s*(\d+)(?::(\d+))?\s*$/.exec(ui.go); ui.goInvalid = !match;
                if (match) { ui.goOpen = false; controller.goToLine(Number(match[1]), Number(match[2] ?? 1)); }
            }, onkeydown: (e: KeyboardEvent) => { if (!e.isComposing && e.key === 'Escape') { e.preventDefault(); ui.goOpen = false; controller.focus(); } } }}>
                <input aria-label='Go to line and optional column' placeholder='Line:column' ${{ value: () => ui.go, 'aria-invalid': () => String(ui.goInvalid), oninput: (e: Event) => { ui.go = (e.target as HTMLInputElement).value; ui.goInvalid = false; } }}>
                <button type='submit'>Go</button><button type='button' ${{ onclick: () => { ui.goOpen = false; controller.focus(); } }}>Close</button>
            </form>
            <div class='markdown-overlays' aria-hidden='true'>${html.reactive(marks, mark => html`<span ${{ class: mark.className, style: mark.style }}>${mark.text}</span>`)}</div>
            <div class='markdown-minimap' role='slider' tabindex='0' aria-label='Document minimap' aria-valuemin='1' ${{ hidden: () => !ui.minimap, style: () => `height:${ui.mapHeight}px`, 'aria-valuemax': () => String(doc.state.lineCount), 'aria-valuenow': () => String(doc.position().line),
                onpointerdown: (e: PointerEvent) => { e.preventDefault(); drag = true; mapPoint(e.clientY); },
                onkeydown: (e: KeyboardEvent) => { if (['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) { e.preventDefault(); let geo = geometry(); geo.scroll(e.key === 'Home' ? 0 : e.key === 'End' ? geo.total : geo.top + (e.key.endsWith('Up') ? -1 : 1) * (e.key.startsWith('Page') ? geo.height : 20)); schedule(); } }
            }}>${html.reactive(bars, bar => html`<span class='markdown-minimap-line' ${{ style: bar.style }}></span>`)}<span class='markdown-minimap-thumb' ${{ style: () => ui.thumb }}></span></div>
        `);
        let drag = false, map = layer.querySelector<HTMLElement>('.markdown-minimap')!;
        function mapPoint(clientY: number) { let geo = geometry(), box = map.getBoundingClientRect(); geo.scroll(Math.max(0, (clientY - box.top) / (box.height || geo.height) * geo.total - geo.height / 2)); schedule(); }
        const move = (e: PointerEvent) => { if (drag) mapPoint(e.clientY); }, up = () => { drag = false; };
        win.addEventListener('pointermove', move); win.addEventListener('pointerup', up);
        function rects(from: number, to: number, className: string, text = '') {
            let geo = geometry(), box = host.querySelector('.markdown-surface')!.getBoundingClientRect(); if (to < geo.from || from > geo.to || marks.length >= 1000) return;
            let first = doc.position(Math.max(from, geo.from)).line - 1, last = doc.position(Math.min(to, geo.to)).line - 1;
            for (let index = first; index <= last && marks.length < 1000; index++) {
                let start = Math.max(from, doc.starts[index]!), end = Math.min(to, lineEnd(doc.value, doc.starts, index)), a = controller.rectAt(start), b = controller.rectAt(end);
                if (!a || !b || box.height && (a.top + a.height < box.top || a.top >= box.bottom)) continue;
                // Wrapped ranges use each visual row rather than spanning unrelated lines.
                if (Math.abs(b.top - a.top) < a.height / 2) marks.push({ className, text, style: `left:${a.left}px;top:${a.top}px;width:${Math.max(2, b.left - a.left)}px;height:${a.height}px;` });
                else for (let offset = start; offset < end && marks.length < 1000; offset++) { let r = controller.rectAt(offset); if (r) marks.push({ className, text: '', style: `left:${r.left}px;top:${r.top}px;width:${Math.max(2, r.width)}px;height:${r.height}px;` }); }
            }
        }
        function paint() {
            frame = 0; if (disposed) return; let geo = geometry(); marks.splice(0);
            active = result.matches.findIndex(match => match.from === doc.selection.start && match.to === doc.selection.end);
            ui.status = result.error || `${active >= 0 ? active + 1 : 0} / ${result.matches.length}${result.truncated ? '+' : ''}`;
            for (let [index, match] of result.matches.entries()) { if (match.from > geo.to) break; rects(match.from, match.to, `markdown-search-match${index === active ? ' markdown-search-match--active' : ''}`); }
            for (let selection of doc.selections.slice(1)) rects(selection.start, selection.end, selection.start === selection.end ? 'markdown-extra-caret' : 'markdown-extra-selection');
            if (options.whitespace) { let box = host.querySelector('.markdown-surface')!.getBoundingClientRect(); for (let match of doc.value.slice(geo.from, geo.to).matchAll(/[ \t]/g)) { if (marks.length >= 1000) break; let at = geo.from + match.index!, rect = controller.rectAt(at); if (rect && (!box.height || rect.top + rect.height >= box.top && rect.top < box.bottom)) marks.push({ className: 'markdown-whitespace', text: match[0] === '\t' ? '→' : '·', style: `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;` }); } }
            if (ui.minimap) {
                ui.mapHeight = geo.height; bars.splice(0);
                if (mapRevision !== doc.state.revision) {
                    mapRevision = doc.state.revision; mapRows = [];
                    let count = doc.starts.length, step = Math.max(1, Math.ceil(count / 512)), state: LexState = '', scanned = 0;
                    for (let index = 0; index < count; index++) {
                        let from = doc.starts[index]!, text = doc.value.slice(from, lineEnd(doc.value, doc.starts, index));
                        scanned += text.length;
                        let lex = scanned <= 200_000 && index < 10_000 ? highlightLine(text, 'markdown', state) : { tokens: [], state: '' };
                        state = lex.state;
                        if (index % step || !text.trim()) continue;
                        let start = text.search(/\S/), end = Math.min(96, text.trimEnd().length);
                        let spans = [{ from: start, to: end, color: 'var(--editor-color)' }];
                        for (let token of lex.tokens.slice(0, 16)) {
                            let colors: Record<string, string> = { tag: 'keyword', type: 'keyword', function: 'keyword', regexp: 'string', property: 'number', variable: 'color', operator: 'color' };
                            if (token.from < end) spans.push({ from: token.from, to: Math.min(end, token.to), color: `var(--editor-${colors[token.kind] ?? token.kind}, var(--editor-color))` });
                        }
                        mapRows.push({ from, spans });
                    }
                }
                for (let row of mapRows) for (let span of row.spans) if (span.to > span.from) bars.push({ style: `top:${geo.y(row.from) / Math.max(1, geo.total) * geo.height}px;left:${span.from * .6}px;width:${Math.max(1, (span.to - span.from) * .6)}px;background:${span.color};` });
                ui.thumb = `top:${geo.top / Math.max(1, geo.total) * geo.height}px;height:${Math.max(8, Math.min(geo.height, geo.height * geo.height / Math.max(1, geo.total)))}px;`;
            } else bars.splice(0);
        }
        function schedule() { if (!disposed && !frame) frame = win.requestAnimationFrame(paint); }
        let unsubscribe = doc.subscribe((_state, change) => { if (change.textChanged) refreshSearch(); else schedule(); });
        win.addEventListener('scroll', schedule, true); win.addEventListener('resize', schedule);
        const api = {
            find(next = query, nextOptions = searchOptions) { query = ui.query = next; searchOptions = { ...nextOptions }; return refreshSearch(); },
            findNext: () => navigate(false), findPrevious: () => navigate(true),
            replace(replacement: string) {
                if (!mutable()) return false; ui.replacement = replacement; result = search(doc.value, query, searchOptions, replacement);
                if (result.error) { refreshSearch(); return false; }
                if (active < 0 || result.matches[active]?.from !== doc.selection.start || result.matches[active]?.to !== doc.selection.end) navigate(false);
                return active >= 0 && replaceMatches(doc, result, false, active);
            },
            replaceAll(replacement: string) { if (!mutable()) return false; ui.replacement = replacement; result = search(doc.value, query, searchOptions, replacement); return replaceMatches(doc, result); },
            openFind(replace = false) { if (disposed) return; let selected = doc.value.slice(doc.selection.start, doc.selection.end); if (selected && !/[\r\n]/.test(selected)) api.find(selected); ui.findOpen = true; ui.replaceOpen = replace; ui.goOpen = false; flush(); let input = layer.querySelector<HTMLInputElement>('[aria-label="Find text"]')!; input.focus(); input.select(); },
            closeFind() { ui.findOpen = false; api.find(''); controller.focus(); },
            openGoToLine() { if (disposed) return; ui.goOpen = true; ui.findOpen = false; ui.goInvalid = false; ui.go = String(doc.position().line); flush(); let input = layer.querySelector<HTMLInputElement>('[aria-label="Go to line and optional column"]')!; input.focus(); input.select(); },
            setOptions(next: ControlsOptions) { options = next; ui.readonly = !!next.readonly; ui.minimap = !!next.minimap; refreshSearch(); },
            refresh: schedule,
            dispose() { disposed = true; win.cancelAnimationFrame(frame); unsubscribe(); win.removeEventListener('scroll', schedule, true); win.removeEventListener('resize', schedule); win.removeEventListener('pointermove', move); win.removeEventListener('pointerup', up); unrender(); layer.remove(); disposeScope(); }
        };
        refreshSearch(); return api;
    });
}
