import { stepCharacter } from './multiselection';
import { flush, reactive, root } from '@esportsplus/reactivity';
import { html, render } from '@esportsplus/template';
import { EditorDocument, lineEnd, preferredEol, sameSelection, type Change, type Selection, type Snapshot } from './document';
import { closeIndent, reindent, transpose, addNextOccurrence, deleteCharacter, lineCommand, selectLine, bracket, deletePair, indent, insertText, newline, toggleComment } from './commands';
import { commentSyntax, highlightLine, languageFor, type Language, type LexState, type Token } from './highlight';
import { EditorLayout, type Rect } from './layout';
import { structures, matchingPair, outerFolds, mapFolds, type FoldRange } from './folding';
import { minimapMetrics, minimapScroll } from './minimap';
import { NativeText } from './native';
import { nextMatch, replaceMatches, search, type Match, type SearchOptions, type SearchResult } from './search';

export type Options = {
    wrap?: boolean;
    whitespace?: boolean;
    minimap?: boolean;
    fold?: boolean;
    /** Services may handle completion keys before the built-in keymap. Return true when consumed. */
    onCompletionKey?: (event: KeyboardEvent, controller: Controller) => boolean;
    /** Ctrl/Command+Space requests completion; text changes remain observable through onChange. */
    onAutocomplete?: (controller: Controller, explicit: boolean) => void;
    label?: string;
    name?: string;
    placeholder?: string;
    fileName?: string;
    language?: Language;
    readonly?: boolean;
    lineNumbers?: boolean;
    highlight?: boolean;
    tabSize?: number;
    indent?: string;
    autoIndent?: boolean;
    autoBrackets?: boolean;
    /** Tab inserts indentation by default. Escape then Tab always moves focus. */
    captureTab?: boolean;
    lineComment?: string | false;
    blockComment?: readonly [string, string];
};
export type Callbacks = {
    onChange?: (value: string, change: Change, state: Snapshot) => void;
    onSelection?: (selection: Selection, position: { line: number; column: number }) => void;
    /** Does not mark saved; call document.markSaved() after persistence succeeds. */
    onSave?: (value: string, state: Snapshot) => void;
};
export type Controller = {
    readonly document: EditorDocument;
    /** A reactive snapshot for toolbars/status. Treat it as read-only. */
    readonly state: Snapshot;
    readonly textarea: HTMLTextAreaElement;
    rectAt(offset: number): Rect | null;
    offsetAt(clientX: number, clientY: number): number | null;
    refresh(): void;
    selectMany(selections: readonly Partial<Selection>[], reveal?: boolean): void;
    addNextOccurrence(all?: boolean): boolean;
    fold(line?: number): boolean;
    unfold(line?: number): boolean;
    foldAll(): void;
    unfoldAll(): void;
    lineCommand(command: 'moveUp' | 'moveDown' | 'copyUp' | 'copyDown' | 'delete' | 'blank'): boolean;
    focus(): void;
    setValue(value: string): boolean;
    setOptions(options: Options, replace?: boolean): void;
    select(selection: Partial<Selection>, reveal?: boolean): void;
    insert(text: string): boolean;
    undoSelection(): boolean;
    redoSelection(): boolean;
    undo(): boolean;
    redo(): boolean;
    indent(): boolean;
    outdent(): boolean;
    newline(): boolean;
    toggleComment(): boolean;
    find(query?: string, options?: SearchOptions): SearchResult;
    findNext(): Match | null;
    findPrevious(): Match | null;
    replace(replacement: string): boolean;
    replaceAll(replacement: string): boolean;
    openFind(replace?: boolean): void;
    closeFind(): void;
    goToLine(line: number, column?: number): void;
    openGoToLine(): void;
    save(): void;
    dispose(): void;
};

type Slice = { text: string; className: string };
type VisibleRow = { number: number; active: boolean; slices: Slice[]; top: number; height: number; foldable: boolean; folded: boolean };
type Decoration = {left:number;top:number;width:number;height:number;kind:string};

/** Owns the children of an empty .code-editor host. The textarea is never replaced during editing. */
export function mountEditor(host: HTMLElement, model = new EditorDocument(), initial: Options = {}, callbacks: Callbacks = {}): Controller {
    return root((disposeScope) => mountView(host, model, initial, callbacks, disposeScope));
}

function mountView(host: HTMLElement, model: EditorDocument, initial: Options, callbacks: Callbacks, disposeScope: VoidFunction): Controller {
    let dom = host.ownerDocument, win = dom.defaultView!;
    let surface: HTMLElement, mirror: HTMLElement, mapCanvas: HTMLCanvasElement, mapElement: HTMLElement, measurement: HTMLCanvasElement,
        textarea: HTMLTextAreaElement,
        queryField: HTMLInputElement, replacementField: HTMLInputElement, goField: HTMLInputElement,
        state = reactive({ ...model.state, selection: { ...model.selection }, selections: model.selections.map(range=>({...range})) }),
        rows = reactive([] as VisibleRow[]),
        decorations = reactive([] as Decoration[]),
        choices = reactive([
            { key: 'caseSensitive' as const, label: 'Case' },
            { key: 'wholeWord' as const, label: 'Word' },
            { key: 'regex' as const, label: 'Regex' }
        ]),
        ui = reactive({
            findOpen: false, replaceOpen: false, goOpen: false,
            query: '', replacement: '', goValue: '', goInvalid: false,
            caseSensitive: false, wholeWord: false, regex: false,
            searchError: false, status: '0 / 0', replaceDisabled: true, allDisabled: true,
            highlight: true, readonly: false, lineNumbers: true, composing: false,
            tabSize: 4, gutterWidth: '5ch', label: 'Code editor', name: '', placeholder: '',
            x: 12, y: 12, width: 0, height: 0, wrap: false, whitespace: false, minimap: false, fold: true,
            display: model.value, contentWidth: 500, mapTop: 0, mapHeight: 24, mapContentHeight: 200, crosshair: false
        }),
        helpId = `code-editor-help-${++uid}`,
        options: Options = {},
        projection = new NativeText(model.value),
        projectedSource: string | undefined = model.value,
        folded: FoldRange[] = [], syntax = structures(model.value, initial.language ?? languageFor(initial.fileName)),
        layout: EditorLayout | undefined, layoutDirty = true, layoutWidth = -1,
        mapGrab: number | null = null, mapSignature = '', rectangleAnchor: {x:number;y:number} | null = null, dropOffset: number | null = null, dragSource: {revision:number;ranges:readonly Selection[];text:string} | null = null,
        beforeInput: Selection | undefined, beforeRanges: readonly Selection[] = [],
        inputType = '', composing = false, compositionPending = false,
        compositionTimer: number | undefined, pendingValue: string | undefined, compositionConflict = false,
        disposed = false, disposing = false, frame = 0, escapeTab = false,
        lineHeight = 20, padTop = 12, padLeft = 12,
        language: Language = 'plain', verticalGoals: number[] = [],
        cache: { tokens: Token[]; state: LexState }[] = [], cachedCharacters = 0,
        query = '', searchOptions: SearchOptions = {}, result: SearchResult = { matches: [], error: '', truncated: false },
        activeMatch = -1,
        removers: VoidFunction[] = [];

    // Construct the entire view inside render's owned scope. Reactive bindings update existing controls;
    // only the bounded row array changes shape, so the textarea never belongs to a replacement slot.
    let unrender = render(host, {}, () => html`
        <div class='code-editor-view' ${{
            'data-highlight': () => String(ui.highlight),
            'data-readonly': () => String(ui.readonly),
            'data-line-numbers': () => String(ui.lineNumbers),
            'data-composing': () => String(ui.composing),
            'data-wrap': () => String(ui.wrap),
            'data-crosshair': () => String(ui.crosshair),
            style: () => `--editor-tab-size: ${ui.tabSize}; --editor-gutter-width: ${ui.gutterWidth}; --editor-minimap-width: ${ui.minimap ? 80 : 0}px;`
        }}>
        <div class='code-editor-find' role='search' aria-label='Find and replace' ${{
            hidden: () => !ui.findOpen,
            onkeydown: (e: KeyboardEvent) => {
                if (e.isComposing) return;
                if (e.key === 'Escape') { e.preventDefault(); controller.closeFind(); }
                else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') { e.preventDefault(); navigate(e.shiftKey); }
                else if (e.key === 'Enter' && (e.target === queryField || e.target === replacementField)) {
                    e.preventDefault(); navigate(e.shiftKey);
                }
            }
        }}>
            <input placeholder='Find' aria-label='Find text' ${{
                value: () => ui.query,
                'aria-invalid': () => String(ui.searchError),
                oninput: () => { ui.query = query = queryField.value; refreshSearch(); }
            }}>
            <input placeholder='Replace' aria-label='Replacement text' ${{
                value: () => ui.replacement,
                hidden: () => !ui.replaceOpen,
                oninput: () => { ui.replacement = replacementField.value; refreshSearch(); }
            }}>
            <button type='button' ${{ onclick: () => navigate(true) }}>Previous</button>
            <button type='button' ${{ onclick: () => navigate(false) }}>Next</button>
            <button type='button' ${{
                hidden: () => !ui.replaceOpen,
                disabled: () => ui.replaceDisabled,
                onclick: () => controller.replace(ui.replacement)
            }}>Replace</button>
            <button type='button' ${{
                hidden: () => !ui.replaceOpen,
                disabled: () => ui.allDisabled,
                onclick: () => controller.replaceAll(ui.replacement)
            }}>Replace all</button>
            ${html.reactive(choices, (choice) => html`
                <button type='button' ${{
                    'aria-pressed': () => String(ui[choice.key]),
                    onclick: () => {
                        searchOptions = { ...searchOptions, [choice.key]: !searchOptions[choice.key] };
                        refreshSearch();
                    }
                }}>${choice.label}</button>
            `)}
            <span class='code-editor-find-status' aria-live='polite'>${() => ui.status}</span>
            <button type='button' ${{ onclick: () => controller.closeFind() }}>Close</button>
        </div>
        <form class='code-editor-go' ${{
            hidden: () => !ui.goOpen,
            onsubmit: (event: SubmitEvent) => {
                event.preventDefault();
                let match = /^\s*(\d+)(?::(\d+))?\s*$/.exec(ui.goValue);
                ui.goInvalid = !match;
                if (match) {
                    ui.goOpen = false;
                    controller.goToLine(Number(match[1]), Number(match[2] ?? 1));
                }
            },
            onkeydown: (e: KeyboardEvent) => {
                if (e.key === 'Escape' && !e.isComposing) { e.preventDefault(); closeGo(); }
            }
        }}>
            <input type='text' inputmode='numeric' placeholder='Line:column' aria-label='Go to line and optional column' ${{
                value: () => ui.goValue,
                'aria-invalid': () => String(ui.goInvalid),
                oninput: () => { ui.goValue = goField.value; ui.goInvalid = false; }
            }}>
            <button type='submit'>Go</button>
            <button type='button' ${{ onclick: closeGo }}>Close</button>
        </form>
        <div class='code-editor-surface' ${{ ondisconnect: () => controller.dispose() }}>
            <div class='code-editor-overlay' aria-hidden='true' ${{
                style: () => `width: ${ui.width}px; height: ${ui.height}px;`
            }}>
                <div class='code-editor-lines' ${{ style: () => `transform: translate(${ui.x}px, ${ui.y}px);` }}>
                    ${html.reactive(rows, (row) => {
                        let slices = reactive(row.slices);
                        return html`<div class='code-editor-line' ${{style: () => `top: ${row.top}px; height: ${row.height}px; width: ${ui.wrap ? ui.contentWidth + 'px' : 'max-content'};`,class: row.active && 'code-editor-line--active'}}>${html.reactive(slices, (slice) => html`<span class='${slice.className}'>${slice.text}</span>`)}</div>`;
                    })}
                </div>
            </div>
            <div class='code-editor-gutter' aria-hidden='true' ${{ style: () => `height: ${ui.height}px;` }}>
                <div class='code-editor-numbers' ${{ style: () => `transform: translateY(${ui.y}px);` }}>
                    ${html.reactive(rows, (row) => html`<div class='code-editor-number' ${{
                        class: row.active && 'code-editor-number--active',
                        style: `top: ${row.top}px; height: ${row.height}px;`
                    }}><span>${row.number}</span><button type='button' class='code-editor-fold-button' ${{
                        hidden: !row.foldable || !ui.fold, 'aria-label': `${row.folded ? 'Unfold' : 'Fold'} line ${row.number}`,
                        onpointerdown: (event: PointerEvent) => event.preventDefault(),
                        onclick: () => {row.folded ? controller.unfold(row.number) : controller.fold(row.number);controller.focus();}
                    }}>${row.foldable ? (row.folded ? '▸' : '▾') : ''}</button></div>`)}
                </div>
            </div>
            <div class='code-editor-decorations' aria-hidden='true'>${html.reactive(decorations, decoration => html`<div class='code-editor-decoration ${decoration.kind}' ${{style: `left: ${decoration.left}px; top: ${decoration.top}px; width: ${decoration.width}px; height: ${decoration.height}px;`}}></div>`)}</div>
            <div class='code-editor-minimap' ${{hidden: () => !ui.minimap, onpointerdown: mapDown, onpointermove: mapMove, onpointerup: mapUp, onpointercancel: mapUp, onwheel: mapWheel}}>
                <canvas aria-hidden='true'></canvas><div class='code-editor-minimap-slider' ${{style: () => `top: ${ui.mapTop}px; height: ${ui.mapHeight}px;`}}></div>
            </div>
            <div class='code-editor-mirror' aria-hidden='true' ${{textContent: () => ui.display + '\n',style: () => `width: ${ui.contentWidth}px;`}}></div>
            <textarea class='code-editor-input' spellcheck='false' autocomplete='off' autocapitalize='off' autocorrect='off' dir='ltr' aria-describedby='${helpId}' ${{
                wrap: () => ui.wrap ? 'soft' : 'off',
                readOnly: () => ui.readonly,
                name: () => ui.name,
                placeholder: () => ui.placeholder,
                'aria-label': () => ui.label
            }}></textarea>
        </div>
        <span class='code-editor-help' id='${helpId}'>Press Escape then Tab to move focus out of the editor.</span>
        <canvas class='code-editor-measure' width='1' height='1' hidden aria-hidden='true'></canvas>
        </div>
    `);

    // render is synchronous. Querying template-owned nodes supplies immediate public/native refs without
    // delaying mount for onconnect or making a reactive ref attribute own the input value/selection.
    surface = host.querySelector<HTMLElement>('.code-editor-surface')!;
    textarea = host.querySelector<HTMLTextAreaElement>('.code-editor-input')!;
    queryField = host.querySelector<HTMLInputElement>('[aria-label="Find text"]')!;
    replacementField = host.querySelector<HTMLInputElement>('[aria-label="Replacement text"]')!;
    goField = host.querySelector<HTMLInputElement>('[aria-label="Go to line and optional column"]')!;
    measurement = host.querySelector<HTMLCanvasElement>('.code-editor-measure')!;
    mirror = host.querySelector<HTMLElement>('.code-editor-mirror')!;
    mapElement = host.querySelector<HTMLElement>('.code-editor-minimap')!;
    mapCanvas = mapElement.querySelector<HTMLCanvasElement>('canvas')!;

    function listen(target: EventTarget, type: string, listener: EventListener) {
        target.addEventListener(type, listener);
        removers.push(() => target.removeEventListener(type, listener));
    }

    function closeGo() {
        if (disposed) return;
        ui.goOpen = false;
        textarea.focus();
        schedule();
    }

    function readSelection(): Selection {
        return {
            start: projection.toSource(textarea.selectionStart), end: projection.toSource(textarea.selectionEnd),
            direction: textarea.selectionDirection
        };
    }

    function captureSelection() {
        if (!disposed && !composing && !compositionPending && textarea.value === projection.value) {
            let next=readSelection();
            if(!sameSelection(next,model.selection))model.selectMany([next,...model.selections.slice(1)]);
        }
    }

    function sync(reveal = false) {
        if (disposed || composing || compositionPending) return;
        let top = textarea.scrollTop, left = textarea.scrollLeft, changed = false;
        if (projectedSource !== model.value) {
            projectedSource = model.value;
            projection = new NativeText(projectedSource, folded);
            layoutDirty = true;
        }
        ui.display = projection.value;
        // Never assign an unchanged native value: that resets browser selection and IME state.
        if (textarea.value !== projection.value) {
            textarea.value = projection.value;
            changed = true;
        }
        let { start, end, direction } = model.selection,
            nativeStart = projection.toNative(start), nativeEnd = projection.toNative(end);
        if (textarea.selectionStart !== nativeStart || textarea.selectionEnd !== nativeEnd || textarea.selectionDirection !== direction) {
            textarea.setSelectionRange(nativeStart, nativeEnd, direction);
            changed = true;
        }
        // Writing even the current scroll position cancels the browser's pending caret reveal after native
        // navigation/input. Restore it only when this sync actually changed native value or selection.
        if (changed) {
            textarea.scrollTop = top;
            textarea.scrollLeft = left;
        }
        if (reveal) revealSelection();
        schedule();
    }

    function measure() {
        let style = win.getComputedStyle(textarea);
        lineHeight = parseFloat(style.lineHeight) || 20;
        padTop = parseFloat(style.paddingTop) || 0;
        padLeft = parseFloat(style.paddingLeft) || 0;
    }

    function ensureLayout() {
        flush();measure();
        let style=win.getComputedStyle(textarea),width=Math.max(1,textarea.clientWidth-padLeft-(parseFloat(style.paddingRight)||padLeft));
        if(!layout || layoutDirty || layoutWidth!==width) {
            ui.contentWidth=width;ui.display=projection.value;flush();
            let ctx=measurement.getContext('2d');if(ctx)ctx.font=`${style.fontSize} ${style.fontFamily}`;
            layout=new EditorLayout(projection,model.value,width,lineHeight,ctx?.measureText(' ').width||7,options.tabSize??4,!!options.wrap,mirror);
            layoutWidth=width;layoutDirty=false;
        }
        return layout;
    }
    function rectAt(offset:number):Rect|null {
        if(disposed || offset<0 || offset>model.value.length || folded.some(range=>offset>range.from&&offset<range.to))return null;
        let geometry=ensureLayout().rect(projection.toNative(offset)),box=textarea.getBoundingClientRect();
        return {...geometry,left:box.left+padLeft+geometry.left-textarea.scrollLeft,top:box.top+padTop+geometry.top-textarea.scrollTop};
    }
    function offsetAt(clientX:number,clientY:number) {
        if(disposed)return null;
        let box=textarea.getBoundingClientRect(),native=ensureLayout().offset(clientX-box.left-padLeft+textarea.scrollLeft,clientY-box.top-padTop+textarea.scrollTop);
        return projection.toSource(native);
    }
    function revealSelection() {
        let offset=model.selection.direction==='backward'?model.selection.start:model.selection.end;
        if(folded.some(range=>offset>range.from&&offset<range.to)) {folded=folded.filter(range=>offset<range.from||offset>=range.to);projectedSource=undefined;sync();}
        let r=ensureLayout().rect(projection.toNative(offset)),top=r.top+padTop;
        if(top<textarea.scrollTop)textarea.scrollTop=Math.max(0,top-padTop);
        else if(top+lineHeight>textarea.scrollTop+textarea.clientHeight)textarea.scrollTop=Math.max(0,top+lineHeight+padTop-textarea.clientHeight);
        if(!options.wrap) {
            let x=r.left+padLeft;
            if(x<textarea.scrollLeft+padLeft)textarea.scrollLeft=Math.max(0,x-padLeft);
            else if(x+padLeft>textarea.scrollLeft+textarea.clientWidth)textarea.scrollLeft=x+padLeft-textarea.clientWidth;
        }
        schedule();
    }

    function schedule() {
        if (!disposed && !frame) frame = win.requestAnimationFrame(paint);
    }

    function paint() {
        frame=0;if(disposed)return;
        let geometry=ensureLayout(),visible:VisibleRow[]=[],budget=3000;
        let visibleLines=geometry.visible(textarea.scrollTop-padTop-4*lineHeight,textarea.scrollTop+textarea.clientHeight+4*lineHeight);
        let last=options.minimap?Math.min(model.starts.length,30000):(model.position(projection.toSource(visibleLines.at(-1)?.to??0)).line);
        if(options.highlight!==false&&language!=='plain')while(cache.length<last&&cache.length<30000&&cachedCharacters<1_000_000) {
            let index=cache.length,text=model.value.slice(model.starts[index],lineEnd(model.value,model.starts,index));cachedCharacters+=text.length+1;
            cache.push(highlightLine(text,language,cache.at(-1)?.state));
        }
        let selected=model.value.slice(model.selection.start,model.selection.end),occurrences=selected&&selected.length<=10000&&!/[\r\n]/.test(selected)?search(model.value,selected,{wholeWord:false}).matches:[];
        let pair=matchingPair(syntax.pairs,model.selection.end),activeLines=new Set(model.selections.map(range=>model.position(range.direction==='backward'?range.start:range.end).line));
        for(let line of visibleLines) {
            let index=line.number-1,from=model.starts[index],text=projection.value.slice(line.from,line.to),tokens:Token[]=[],boundaries=new Set([0,text.length]);
            if(options.highlight!==false)for(let row=index;row<cache.length&&model.starts[row]<=projection.toSource(line.to);row++)for(let token of cache[row].tokens){let a=model.starts[row]+token.from,b=model.starts[row]+token.to;if(folded.some(fold=>a>=fold.from&&b<=fold.to))continue;let start=Math.max(0,projection.toNative(a)-line.from),end=Math.min(text.length,projection.toNative(b)-line.from);if(end>start)tokens.push({...token,from:start,to:end});}
            let marks:{from:number;to:number;kind:string}[]=[];
            for(let placeholder of projection.placeholders())if(placeholder.at>=line.from&&placeholder.at<line.to){let start=placeholder.at-line.from;marks.push({from:start,to:start+1,kind:'code-editor-fold-placeholder'});boundaries.add(start);boundaries.add(start+1);}
            for(let token of tokens){boundaries.add(Math.min(text.length,token.from));boundaries.add(Math.min(text.length,token.to));}
            for(let [list,kind] of [[result.matches,'code-editor-match'],[occurrences,'code-editor-occurrence']] as const) {
                let count=0;for(let j=Math.max(0,matchAt(list,from));j<list.length&&list[j].from<=from+text.length&&count<200;j++,count++) {
                    let start=Math.max(0,list[j].from-from),end=Math.min(text.length,list[j].to-from);
                    if(end>start){marks.push({from:start,to:end,kind:kind+(list===result.matches&&j===activeMatch?' code-editor-match--active':'')});boundaries.add(start);boundaries.add(end);}
                }
            }
            if(pair)for(let at of [pair.from,pair.to])if(at>=from&&at<from+text.length){marks.push({from:at-from,to:at-from+1,kind:'code-editor-bracket-match'});boundaries.add(at-from);boundaries.add(at-from+1);}
            if(options.whitespace&&text.length<20000)for(let match of text.matchAll(/[ \t]/g)){boundaries.add(match.index);boundaries.add(match.index+1);}
            let parts=[...boundaries].sort((a,b)=>a-b),slices:Slice[]=[];
            if(parts.length>budget||tokens.length>1000)slices.push({text,className:''});
            else for(let j=0,tokenIndex=0;j<parts.length-1;j++) {
                let start=parts[j],end=parts[j+1];while(tokens[tokenIndex]?.to<=start)tokenIndex++;
                let token=tokens[tokenIndex],classes=token&&token.from<=start?[`code-editor-token--${token.kind}`]:[];
                classes.push(...marks.filter(mark=>mark.from<=start&&mark.to>start).map(mark=>mark.kind));
                if(options.whitespace&&end===start+1&&/[ \t]/.test(text[start]))classes.push(text[start]==='\t'?'code-editor-whitespace-tab':'code-editor-whitespace-space');
                slices.push({text:text.slice(start,end),className:classes.join(' ')});budget--;
            }
            visible.push({number:line.number,active:activeLines.has(line.number),slices,top:line.top,height:line.height,foldable:syntax.folds.some(range=>range.line===line.number),folded:folded.some(range=>range.line===line.number)});
        }
        rows.splice(0,rows.length,...visible);
        ui.x=padLeft-textarea.scrollLeft;ui.y=padTop-textarea.scrollTop;ui.width=textarea.clientWidth;ui.height=textarea.clientHeight;
        paintSelections();paintMinimap();
    }
    function paintSelections() {
        let geometry=ensureLayout(),items:Decoration[]=[],box=textarea.getBoundingClientRect(),surfaceBox=surface.getBoundingClientRect();
        for(let range of model.selections.slice(1)) {
            let first=geometry.rect(projection.toNative(range.start)),last=geometry.rect(projection.toNative(range.end));
            if(range.start!==range.end)for(let y=first.top+Math.max(0,Math.floor((textarea.scrollTop-first.top)/lineHeight))*lineHeight;y<=Math.min(last.top,textarea.scrollTop+textarea.clientHeight)&&items.length<1000;y+=lineHeight) {
                if(y+lineHeight<textarea.scrollTop||y>textarea.scrollTop+textarea.clientHeight)continue;
                let left=y===first.top?first.left:0,right=y===last.top?last.left:geometry.width;
                items.push({left:box.left-surfaceBox.left+padLeft+left-textarea.scrollLeft,top:padTop+y-textarea.scrollTop,width:Math.max(1,right-left),height:lineHeight,kind:'code-editor-secondary-selection'});
            }
            let caret=range.direction==='backward'?first:last;
            items.push({left:box.left-surfaceBox.left+padLeft+caret.left-textarea.scrollLeft,top:padTop+caret.top-textarea.scrollTop,width:1,height:lineHeight,kind:'code-editor-secondary-caret'});
        }
        if(dropOffset!==null) {let rect=rectAt(dropOffset);if(rect)items.push({left:rect.left-surfaceBox.left,top:rect.top-surfaceBox.top,width:2,height:rect.height,kind:'code-editor-drop-caret'});}
        decorations.splice(0,decorations.length,...items);
    }
    function paintMinimap() {
        if(!options.minimap)return;
        let geometry=ensureLayout(),height=textarea.clientHeight,width=80,dpr=win.devicePixelRatio||1,ctx=mapCanvas.getContext('2d');
        if(mapCanvas.width!==width*dpr||mapCanvas.height!==height*dpr){mapCanvas.width=width*dpr;mapCanvas.height=height*dpr;}
        ui.mapContentHeight=Math.min(height,Math.max(1,geometry.height/lineHeight)*4);
        let metrics=minimapMetrics(ui.mapContentHeight,Math.max(textarea.scrollHeight,geometry.height+2*padTop),height,textarea.scrollTop);ui.mapTop=metrics.top;ui.mapHeight=metrics.height;
        if(!ctx?.clearRect)return;
        let style=win.getComputedStyle(host),colors:Record<string,string>={};
        for(let kind of ['comment','keyword','string','number','function','property','type','variable','tag','operator','regexp'])colors[kind]=style.getPropertyValue('--editor-'+kind).trim()||style.getPropertyValue('--editor-color').trim()||'#889099';
        let signature=[model.state.revision,geometry.width,geometry.height,height,dpr,language,options.wrap,options.tabSize,folded.map(range=>range.from+'-'+range.to).join(','),Object.values(colors).join(',')].join('|');
        if(signature===mapSignature)return;mapSignature=signature;
        ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
        let scale=ui.mapContentHeight/Math.max(1,geometry.height),step=Math.max(1,Math.ceil(geometry.lines.length/Math.max(1,height)));
        for(let index=0;index<geometry.lines.length;index+=step) {
            let line=geometry.lines[index],text=projection.value.slice(line.from,line.to),tokens=cache[line.number-1]?.tokens??[],pitch=Math.max(1,Math.min(3,lineHeight*scale));
            if(model.value.length>2_000_000||text.length>10000) {ctx.fillStyle=colors.comment;ctx.fillRect(3,line.top*scale,Math.min(74,text.trim().length),pitch);continue;}
            let tokenIndex=0;
            for(let [row,from] of line.breaks.entries()) {
                let to=Math.min(line.breaks[row+1]??line.to,from+70),x=3,y=(line.top+row*lineHeight)*scale;
                for(let offset=from;offset<to;offset++) {
                    let column=offset-line.from;
                    while(tokens[tokenIndex]?.to<=column)tokenIndex++;
                    let character=projection.value[offset],token=tokens[tokenIndex];
                    if(!/\s/.test(character)){ctx.fillStyle=colors[token&&token.from<=column?token.kind:'variable'];ctx.fillRect(x,y,1.15,pitch);}
                    x+=character==='\t'?(options.tabSize??4)*1.15:1.15;
                    if(x>78)break;
                }
            }
        }
    }
    function mapDown(event:PointerEvent) {
        if(!options.minimap)return;event.preventDefault();controller.focus();
        let y=event.clientY-mapElement.getBoundingClientRect().top;
        mapGrab=y>=ui.mapTop&&y<=ui.mapTop+ui.mapHeight?y-ui.mapTop:ui.mapHeight/2;
        mapElement.setPointerCapture?.(event.pointerId);mapMove(event);
    }
    function mapMove(event:PointerEvent) {
        if(mapGrab===null)return;
        textarea.scrollTop=minimapScroll(event.clientY-mapElement.getBoundingClientRect().top,mapGrab,ui.mapContentHeight,Math.max(textarea.scrollHeight,ensureLayout().height+2*padTop),textarea.clientHeight);schedule();
    }
    function mapUp() {mapGrab=null;}
    function mapWheel(event:WheelEvent) {event.preventDefault();textarea.scrollTop+=event.deltaY*(event.deltaMode===1?lineHeight:event.deltaMode===2?textarea.clientHeight:1);schedule();}
    function changeFold(line:number,close:boolean) {
        if(disposed||composing||compositionPending||options.fold===false)return false;
        let range=syntax.folds.find(range=>range.line===line);if(!range)return false;
        if(close) {if(folded.some(item=>item.line===line))return false;folded=outerFolds([...folded,range]);}
        else folded=folded.filter(item=>item.line!==line);
        if(close&&model.selections.some(selection=>selection.start>=range.from&&selection.start<range.to))model.select({start:Math.max(0,range.from-1)});
        projectedSource=undefined;layoutDirty=true;sync();return true;
    }

    function refreshSearch() {
        result=search(model.value,query,searchOptions,ui.replacement);
        activeMatch=-1;
        Object.assign(ui, {searchError:!!result.error,
            caseSensitive: !!searchOptions.caseSensitive,
            wholeWord: !!searchOptions.wholeWord,
            regex: !!searchOptions.regex
        });
        updateStatus();
        schedule();
        return result;
    }

    function updateStatus() {
        ui.status = result.error || `${activeMatch >= 0 ? activeMatch + 1 : 0} / ${result.matches.length}${result.truncated ? '+' : ''}`;
        ui.replaceDisabled = !!options.readonly || !result.matches.length || !!result.error;
        ui.allDisabled = ui.replaceDisabled || result.truncated;
    }

    function navigate(backwards: boolean) {
        if (disposed) return null;
        captureSelection();
        activeMatch = nextMatch(result.matches, model.selection.start, model.selection.end, backwards, activeMatch);
        let match = result.matches[activeMatch];
        if (!match) return null;
        model.select({ start: match.from, end: match.to });
        sync(true);
        updateStatus();
        return match;
    }

    function revealEditedSelection(editing=false) {
        let next=folded.filter(fold=>!model.selections.some(range=>
            (range.start>fold.from&&range.start<fold.to)||(range.end>fold.from&&range.end<fold.to)||(editing&&range.start<fold.to&&range.end>fold.from)));
        if(next.length!==folded.length){folded=next;projectedSource=undefined;sync();}
    }

    function deleteVisibleCharacter(backwards:boolean,word=false) {
        let affected=folded.filter(fold=>model.selections.some(range=>range.start===range.end&&range.start===(backwards?fold.to:fold.from)));
        if(affected.length){folded=folded.filter(fold=>!affected.includes(fold));projectedSource=undefined;sync();return true;}
        return deleteCharacter(model,backwards,word);
    }

    function editable(run: () => boolean) {
        if (disposed || options.readonly || composing || compositionPending) return false;
        captureSelection();
        revealEditedSelection();
        let changed = run();
        sync(true);
        return changed;
    }

    function setOptions(next: Options, replace = false) {
        if (disposed) return;
        options = { ...(replace ? {} : options), ...next };
        options.tabSize = Math.max(1, Math.min(16, Math.trunc(options.tabSize ?? 4) || 4));
        if (!options.indent || !/^[\t ]+$/.test(options.indent)) options.indent = '    ';
        let nextLanguage = options.language ?? languageFor(options.fileName);
        if (nextLanguage !== language) { language = nextLanguage; cache = []; cachedCharacters = 0; syntax=structures(model.value,language); }
        layoutDirty=true;
        if(options.fold===false&&folded.length){folded=[];projectedSource=undefined;sync();}
        Object.assign(ui, {
            readonly: !!options.readonly, name: options.name ?? '', placeholder: options.placeholder ?? '',
            label: options.label ?? 'Code editor', highlight: options.highlight !== false,
            wrap:!!options.wrap, whitespace:!!options.whitespace, minimap:!!options.minimap, fold:options.fold!==false,
            lineNumbers: options.lineNumbers !== false, tabSize: options.tabSize,
            gutterWidth: options.lineNumbers === false ? (options.fold === false ? '0px' : '2ch') : `${Math.max(3, String(model.starts.length).length) + 2}ch`
        });
        updateStatus();
        schedule();
    }

    function acceptNative(group?: string) {
        if (disposed) return;
        if (options.readonly) { beforeInput = undefined; sync(); return; }
        let nativeValue = textarea.value, start = textarea.selectionStart, end = textarea.selectionEnd, direction = textarea.selectionDirection;
        if(group==='composition'&&nativeValue===projection.value&&beforeInput&&beforeInput.start<beforeInput.end&&beforeRanges.length>1&&start===end&&start===projection.toNative(beforeInput.end)) {
            insertText(model,model.value.slice(beforeInput.start,beforeInput.end),'composition');
        }
        else if (nativeValue !== projection.value) {
            let edit = projection.edit(model.value, nativeValue, beforeInput, inputType),
                next = model.value.slice(0, edit.from) + edit.insert + model.value.slice(edit.to), nextProjection = new NativeText(next,mapFolds(folded,[[edit]],next));
            let original=beforeRanges.length?beforeRanges:model.selections;
            if(original.length>1) {
                let primary=original[0],left=edit.from-primary.start,right=edit.to-primary.end,
                    edits=original.map(range=>({from:Math.max(0,range.start+left),to:Math.min(model.value.length,range.end+right),insert:edit.insert}));
                let sorted=[...edits].sort((a,b)=>a.from-b.from),ranges=edits.map((item)=>{
                    let shift=sorted.filter(other=>other.from<item.from).reduce((sum,other)=>sum+other.insert.length-(other.to-other.from),0),caret=item.from+shift+item.insert.length;
                    return {start:caret,end:caret};
                });
                let accepted=model.tryTransact(edits,{source:group==='composition'?'composition':'input',selections:ranges});
                if(!accepted.accepted) {beforeInput=undefined;beforeRanges=[];sync();return;}
            } else model.replace(edit.from, edit.to, edit.insert, {
                source: group === 'composition' ? 'composition' : 'input', group: group === 'composition' ? undefined : group,
                selection: { start: nextProjection.toSource(start), end: nextProjection.toSource(end), direction }
            });
        }
        else captureSelection();
        beforeInput = undefined; beforeRanges=[];
        inputType = '';
        sync();
    }

    function finishComposition() {
        if (disposed || composing) return;
        compositionPending = false;
        if (compositionTimer !== undefined) win.clearTimeout(compositionTimer);
        compositionTimer = undefined;
        // Keep the whole composition as one history entry and only now allow controlled updates.
        if (!compositionConflict) acceptNative('composition');
        else { compositionConflict = false; beforeInput = undefined; sync(); }
        ui.composing = false;
        if (pendingValue !== undefined) {
            let value = pendingValue;
            pendingValue = undefined;
            model.setValue(value, { source: 'external' });
            sync();
        }
    }

    const controller: Controller = {
        document: model, state, textarea, rectAt, offsetAt,
        refresh: () => {if(!disposed){layoutDirty=true;mapSignature='';schedule();}},
        selectMany: (ranges,reveal=true) => {if(!disposed&&!composing&&!compositionPending){model.selectMany(ranges);sync(reveal);}},
        addNextOccurrence: (all=false) => {if(disposed||composing||compositionPending)return false;captureSelection();let changed=addNextOccurrence(model,all);sync(true);return changed;},
        fold: (line=model.position().line) => changeFold(line,true),
        unfold: (line=model.position().line) => changeFold(line,false),
        foldAll: () => {if(disposed||composing||compositionPending||options.fold===false)return;folded=outerFolds(syntax.folds);model.select({start:0});projectedSource=undefined;sync();},
        unfoldAll: () => {if(disposed||composing||compositionPending)return;folded=[];projectedSource=undefined;sync();},
        lineCommand: command => editable(()=>lineCommand(model,command)),
        focus: () => { if (!disposed) textarea.focus(); },
        setValue: (value) => {
            if (disposed) return false;
            if (composing || compositionPending) { pendingValue = value; return false; }
            return model.setValue(value);
        },
        setOptions,
        select: (next, reveal = true) => {
            if (disposed || composing || compositionPending) return;
            model.select(next); sync(reveal);
        },
        insert: (text) => editable(() => insertText(model, text)),
        undoSelection: () => {if(disposed||composing||compositionPending)return false;let changed=model.undoSelection();sync(true);return changed;},
        redoSelection: () => {if(disposed||composing||compositionPending)return false;let changed=model.redoSelection();sync(true);return changed;},
        undo: () => editable(() => model.undo()), redo: () => editable(() => model.redo()),
        indent: () => editable(() => indent(model, options.indent)),
        outdent: () => editable(() => indent(model, options.indent, true)),
        newline: () => editable(() => newline(model, options.indent, language)),
        toggleComment: () => editable(() => {
            let syntax = commentSyntax(language);
            return toggleComment(model, options.lineComment ?? syntax.line, options.blockComment ?? syntax.block);
        }),
        find: (nextQuery = query, nextOptions = searchOptions) => {
            if (disposed) return result;
            ui.query = query = nextQuery; searchOptions = { ...nextOptions };
            return refreshSearch();
        },
        findNext: () => navigate(false), findPrevious: () => navigate(true),
        replace: (replacement) => editable(() => {
            ui.replacement = replacement;
            // Preserve current match index across recomputing replacement expansions.
            let index = activeMatch;
            result = search(model.value, query, searchOptions, replacement);
            if (index < 0 || result.matches[index]?.from !== model.selection.start || result.matches[index]?.to !== model.selection.end) {
                activeMatch = -1;
                navigate(false);
                index = activeMatch;
            }
            return index >= 0 && replaceMatches(model, result, false, index);
        }),
        replaceAll: (replacement) => editable(() => {
            ui.replacement = replacement;
            result = search(model.value, query, searchOptions, replacement);
            return replaceMatches(model, result);
        }),
        openFind: (replace = false) => {
            if (disposed || composing || compositionPending) return;
            captureSelection();
            let selected = model.value.slice(model.selection.start, model.selection.end);
            if (selected && !/[\r\n]/.test(selected)) controller.find(selected);
            ui.replaceOpen = replace; ui.findOpen = true; ui.goOpen = false;
            flush();
            queryField.focus(); queryField.select(); schedule();
        },
        closeFind: () => {
            if (disposed) return;
            ui.findOpen = false; ui.query = query = ''; refreshSearch(); textarea.focus();
        },
        goToLine: (line, column = 1) => {
            if (disposed || composing || compositionPending) return;
            let offset = model.offset(line, column);
            model.select({ start: offset }); sync(true); textarea.focus();
        },
        openGoToLine: () => {
            if (disposed || composing || compositionPending) return;
            captureSelection(); ui.goOpen = true; ui.findOpen = false; ui.goInvalid = false;
            ui.goValue = String(model.position().line); flush(); goField.focus(); goField.select(); schedule();
        },
        save: () => { if (!disposed && !composing && !compositionPending) callbacks.onSave?.(model.value, model.state); },
        dispose: () => {
            if (disposed || disposing) return;
            disposing = true;
            try {
                // Flush native composition and pending values, even when disconnected mid-composition.
                composing = false; finishComposition();
            }
            finally {
                disposed = true;
                if (frame) win.cancelAnimationFrame(frame);
                if (compositionTimer !== undefined) win.clearTimeout(compositionTimer);
                observer?.disconnect(); unsubscribe();
                for (let remove of removers) remove();
                try { unrender(); }
                finally { disposeScope(); }
                cache = []; pendingValue = undefined;
            }
        }
    };

    let unsubscribe = model.subscribe((snapshot, change) => {
        if(change.source!=='navigation')verticalGoals=[];
        let {selections, ...single} = snapshot;
        state.selections.splice(0,state.selections.length,...selections.map(range=>({...range})));
        Object.assign(state, single, { selection: { ...snapshot.selection } });
        if (change.textChanged) {
            if (composing || compositionPending) compositionConflict = true;
            cache = []; cachedCharacters = 0;
            folded=change.editBatches?mapFolds(folded,change.editBatches,model.value):[];syntax=structures(model.value,language);projectedSource=undefined;layoutDirty=true;
            setOptions({});
            refreshSearch();
        }
        if(change.selectionChanged) revealEditedSelection();
        sync();
        if (change.selectionChanged) callbacks.onSelection?.(snapshot.selection, model.position());
        if (change.textChanged) callbacks.onChange?.(snapshot.value, change, snapshot);
    });

    listen(textarea, 'beforeinput', (event) => {
        let e = event as InputEvent;
        if (composing || e.isComposing || compositionPending) return;
        captureSelection();
        // Reveal only the selected source being edited before native mutation.
        revealEditedSelection(!e.inputType.startsWith('history')&&!options.readonly);
        if(e.cancelable&&!options.readonly&&e.inputType.startsWith('delete')) {
            let start=textarea.selectionStart,end=textarea.selectionEnd;
            let affected=projection.placeholders().filter(range=>start===end?
                (e.inputType.endsWith('Backward')?start===range.at+1:start===range.at):start<=range.at&&end>range.at);
            if(affected.length){e.preventDefault();folded=folded.filter(fold=>!affected.some(range=>range.from===fold.from));projectedSource=undefined;sync();return;}
        }
        beforeInput = model.selection; beforeRanges=model.selections; inputType = e.inputType;
        if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
            if (e.cancelable) { e.preventDefault(); e.inputType === 'historyUndo' ? controller.undo() : controller.redo(); }
            return;
        }
        if (!e.cancelable || options.readonly) return;
        if(model.selections.length>1) {
            if(e.inputType==='insertText'&&e.data!==null) {
                e.preventDefault();
                if(!(e.data.length===1&&((options.autoIndent!==false&&editable(()=>closeIndent(model,e.data!,language)))||(options.autoBrackets!==false&&editable(()=>bracket(model,e.data!,language))))))editable(()=>insertText(model,e.data!,'input'));
                return;
            }
            if(/^delete(?:Content|Word)(?:Backward|Forward)$/.test(e.inputType)) {
                e.preventDefault();editable(()=>deleteVisibleCharacter(e.inputType.endsWith('Backward'),e.inputType.startsWith('deleteWord')));return;
            }
        }
        if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
            if (options.autoIndent !== false) { e.preventDefault(); controller.newline(); }
        }
        else if (e.inputType === 'insertText' && e.data?.length === 1 && options.autoBrackets !== false) {
            if (editable(() => bracket(model, e.data!,language)) || (options.autoIndent!==false&&editable(()=>closeIndent(model,e.data!,language)))) e.preventDefault();
        }
        else if (e.inputType === 'deleteContentBackward' && options.autoBrackets !== false) {
            if (editable(() => deletePair(model))) e.preventDefault();
        }
    });
    listen(textarea, 'input', (event) => {
        let e = event as InputEvent;
        if (composing || e.isComposing) return;
        if (compositionPending) { finishComposition(); return; }
        if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
            e.inputType === 'historyUndo' ? controller.undo() : controller.redo();
            sync();
            return;
        }
        acceptNative(/^(insertText|deleteContentBackward|deleteContentForward)$/.test(e.inputType) ? e.inputType : undefined);
    });
    listen(textarea, 'compositionstart', () => {
        if (compositionPending) finishComposition();
        captureSelection();
        revealEditedSelection(true);
        beforeInput = model.selection;beforeRanges=model.selections;
        model.breakHistory(); composing = true; compositionConflict = false; ui.composing = true;
    });
    listen(textarea, 'compositionend', () => {
        composing = false; compositionPending = true;
        // Engines differ on whether the final input is before or after compositionend.
        compositionTimer = win.setTimeout(finishComposition, 0);
    });
    listen(textarea, 'paste', (event) => {
        let e = event as ClipboardEvent;
        if (composing || compositionPending || options.readonly || !e.clipboardData) return;
        e.preventDefault();
        let text=e.clipboardData.getData('text/plain'),chunks=text.split(/\r\n|\r|\n/),encoded=e.clipboardData.getData('application/x-esportsplus-code-editor');
        if(encoded) {
            // Malformed external clipboard metadata falls back to its plain text, never to a partial edit.
            let decoded:unknown;try{decoded=JSON.parse(encoded);}catch{decoded=null;}
            if(Array.isArray(decoded)&&decoded.length===model.selections.length&&decoded.every(value=>typeof value==='string')) {
                let pieces=decoded;if(['\n','\r\n','\r'].some(eol=>pieces.join(eol)===text))chunks=pieces;
            }
        }
        editable(()=>insertText(model,model.selections.length>1&&chunks.length===model.selections.length?chunks:text,'paste'));
    });
    for (let name of ['copy', 'cut']) listen(textarea, name, (event) => {
        let e = event as ClipboardEvent;
        if (disposed || composing || compositionPending || !e.clipboardData) return;
        captureSelection();
        let ranges=model.selections;
        if(ranges.every(range=>range.start===range.end)) {
            ranges=ranges.map(range=>{let position=model.position(range.start);return {start:model.offset(position.line),end:model.starts[position.line]??model.value.length,direction:'none' as const};});
        }
        let chunks=ranges.map(range=>model.value.slice(range.start,range.end));
        e.clipboardData.setData('text/plain', chunks.join(preferredEol(model.value)));
        e.clipboardData.setData('application/x-esportsplus-code-editor',JSON.stringify(chunks));
        e.preventDefault();
        if (name === 'cut' && !options.readonly) {model.selectMany(ranges);controller.insert('');}
    });
    for (let name of ['select', 'selectionchange', 'keyup', 'pointerup', 'focus', 'blur']) listen(textarea, name, captureSelection);
    listen(dom, 'selectionchange', () => { if (dom.activeElement === textarea) captureSelection(); });
    listen(textarea, 'scroll', schedule);
    listen(textarea,'pointerdown',event=> {
        let e=event as PointerEvent;if(composing||compositionPending)return;verticalGoals=[];
        let box=textarea.getBoundingClientRect(),x=e.clientX-box.left-padLeft+textarea.scrollLeft,y=e.clientY-box.top-padTop+textarea.scrollTop,geometry=ensureLayout();
        let placeholder=projection.placeholders().find(range=>{let r=geometry.rect(range.at),end=geometry.rect(range.at+1);return y>=r.top&&y<r.top+r.height&&x>=r.left&&x< (end.top===r.top?end.left:r.left+Math.max(7,r.width));});
        if(placeholder){e.preventDefault();folded=folded.filter(fold=>fold.from!==placeholder.from);projectedSource=undefined;sync();textarea.focus();return;}
        if(e.altKey) {
            e.preventDefault();let offset=offsetAt(e.clientX,e.clientY);if(offset===null)return;
            if(e.shiftKey){rectangleAnchor={x:e.clientX,y:e.clientY};textarea.setPointerCapture?.(e.pointerId);model.select({start:offset});}
            else model.selectMany([...model.selections,{start:offset}]);
            textarea.focus();sync();
        } else if(model.selections.length>1)model.select(model.selection);
    });
    listen(textarea,'pointermove',event=> {
        let e=event as PointerEvent;ui.crosshair=e.altKey;
        if(!rectangleAnchor)return;e.preventDefault();
        let box=textarea.getBoundingClientRect(),origin=box.top+padTop-textarea.scrollTop,
            first=Math.floor((rectangleAnchor.y-origin)/lineHeight),last=Math.floor((e.clientY-origin)/lineHeight),ranges:Partial<Selection>[]=[];
        for(let row=Math.max(0,Math.min(first,last));row<=Math.max(first,last)&&ranges.length<1000;row++) {
            let y=origin+row*lineHeight+lineHeight/2;
            let start=offsetAt(rectangleAnchor.x,y),end=offsetAt(e.clientX,y);
            if(start!==null&&end!==null)ranges.push({start,end,direction:end<start?'backward':'forward'});
        }
        model.selectMany(ranges);sync();
    });
    listen(textarea,'pointerup',()=>{rectangleAnchor=null;});
    listen(textarea,'pointercancel',()=>{rectangleAnchor=null;});
    listen(textarea,'dragstart',event=> {
        let e=event as DragEvent;captureSelection();
        let ranges=model.selections.filter(range=>range.start!==range.end);
        if(!ranges.length||!e.dataTransfer)return;
        let text=ranges.map(range=>model.value.slice(range.start,range.end)).join(preferredEol(model.value));
        dragSource={revision:model.state.revision,ranges,text};e.dataTransfer.setData('text/plain',text);e.dataTransfer.effectAllowed=options.readonly?'copy':'copyMove';
    });
    listen(textarea,'dragend',()=>{dragSource=null;dropOffset=null;schedule();});
    listen(textarea,'dragover',event=> {if(options.readonly)return;let e=event as DragEvent;e.preventDefault();dropOffset=offsetAt(e.clientX,e.clientY);schedule();});
    listen(textarea,'dragleave',()=>{dropOffset=null;schedule();});
    listen(textarea,'drop',event=> {
        let e=event as DragEvent;if(options.readonly||composing||compositionPending)return;
        let text=e.dataTransfer?.getData('text/plain'),offset=offsetAt(e.clientX,e.clientY);dropOffset=null;
        if(text!==undefined&&offset!==null) {
            e.preventDefault();
            if(dragSource&&dragSource.revision===model.state.revision&&!e.ctrlKey&&!e.altKey&&!e.metaKey) {
                if(!dragSource.ranges.some(range=>offset!>=range.start&&offset!<=range.end)) {
                    let edits=dragSource.ranges.map(range=>({from:range.start,to:range.end,insert:''}));
                    let shift=edits.filter(edit=>edit.from<offset!).reduce((sum,edit)=>sum-(edit.to-edit.from),0),caret=offset+shift+dragSource.text.length;
                    edits.push({from:offset,to:offset,insert:dragSource.text});model.transact(edits,{source:'drop',selection:{start:caret}});sync(true);
                }
            } else {model.select({start:offset});controller.insert(text);}
        }
        dragSource=null;schedule();
    });
    listen(win,'pointerup',()=>{rectangleAnchor=null;mapGrab=null;});
    listen(win,'pointercancel',()=>{rectangleAnchor=null;mapGrab=null;});
    listen(win,'keydown',event=>{ui.crosshair=(event as KeyboardEvent).altKey;});
    listen(win,'keyup',event=>{ui.crosshair=(event as KeyboardEvent).altKey;});
    listen(win,'blur',()=>{ui.crosshair=false;rectangleAnchor=null;mapGrab=null;});
    function moveSelection(key:string,extend:boolean,word=false,add=false,documentBoundary=false) {
        let vertical=/^(ArrowUp|ArrowDown|PageUp|PageDown)$/.test(key)&&!documentBoundary;
        if(!vertical||add)verticalGoals=[];
        let geometry=ensureLayout(),ranges=model.selections.map((range,index)=> {
            let head=range.direction==='backward'?range.start:range.end,anchor=range.direction==='backward'?range.end:range.start,next=head,r=geometry.rect(projection.toNative(head));
            if(documentBoundary&&(key==='Home'||key==='ArrowUp'))next=0;
            else if(documentBoundary&&(key==='End'||key==='ArrowDown'))next=model.value.length;
            else if(key==='ArrowLeft'||key==='ArrowRight') {
                let backward=key==='ArrowLeft';
                if(!extend&&range.start!==range.end)next=backward?range.start:range.end;
                else if(word)next=backward?head-(/(?:\s+|[\w$]+|[^\w\s$]+)$/.exec(model.value.slice(0,head))?.[0].length??0):head+(/^(?:\s+|[\w$]+|[^\w\s$]+)/.exec(model.value.slice(head))?.[0].length??0);
                else next=stepCharacter(model.value,head,backward);
            } else if(key==='Home'||key==='End') {
                let at=geometry.offset(key==='Home'?0:1e9,r.top+lineHeight/2);
                if(key==='Home') {let padding=/^[\t ]*/.exec(projection.value.slice(at))![0].length,indented=at+padding;at=projection.toNative(head)===indented?at:indented;}
                next=projection.toSource(at);
            }
            else {let delta=(key==='ArrowUp'||key==='PageUp'?-1:1)*(key.startsWith('Page')?Math.max(lineHeight,textarea.clientHeight-lineHeight):lineHeight);let x=verticalGoals[index]??r.left;verticalGoals[index]=x;next=projection.toSource(geometry.offset(x,r.top+delta+lineHeight/2));}
            return extend?{start:Math.min(anchor,next),end:Math.max(anchor,next),direction:next<anchor?'backward' as const:'forward' as const}:{start:next,end:next};
        });
        model.selectMany(add?[...model.selections,...ranges]:ranges,'navigation');sync(true);
    }
    listen(textarea, 'keydown', (event) => {
        let e = event as KeyboardEvent;
        if (composing || compositionPending || e.isComposing || e.keyCode === 229) return;
        let mod=e.ctrlKey||e.metaKey,handled=true,key=e.key.toLowerCase(),mac=/Mac|iPhone|iPad/.test(win.navigator.platform);
        if(options.onCompletionKey?.(e,controller)){e.preventDefault();return;}
        if(e.key==='Escape') {escapeTab=true;if(model.selections.length>1){model.select(model.selection);sync();e.preventDefault();}return;}
        if(e.key==='Tab'&&escapeTab){escapeTab=false;return;}escapeTab=false;
        if((mod&&e.key===' ')||(mac&&e.altKey&&(key==='i'||key==='`'))){options.onAutocomplete?.(controller,true);}
        else if((mod&&e.shiftKey&&(e.key==='['||e.key===']')) || (mac&&e.metaKey&&e.altKey&&(e.key==='['||e.key===']')))e.key==='['?controller.fold():controller.unfold();
        else if(e.ctrlKey&&e.altKey&&(e.key==='['||e.key===']'))e.key==='['?controller.foldAll():controller.unfoldAll();
        else if(mod&&e.altKey&&key==='g')controller.openGoToLine();
        else if(e.altKey&&(e.key==='ArrowUp'||e.key==='ArrowDown')) {
            if(mod)moveSelection(e.key,false,false,true);
            else controller.lineCommand(e.shiftKey?(e.key==='ArrowUp'?'copyUp':'copyDown'):(e.key==='ArrowUp'?'moveUp':'moveDown'));
        }
        else if((e.altKey&&!mod&&key==='l')||(mac&&e.ctrlKey&&!e.metaKey&&key==='l')){captureSelection();selectLine(model);sync(true);}
        else if((e.altKey&&e.shiftKey&&key==='a')||(mac&&e.ctrlKey&&e.shiftKey&&key==='a'))editable(()=>toggleComment(model,false,options.blockComment??commentSyntax(language).block??['/*','*/']));
        else if(mod&&e.altKey&&e.key==='\\')editable(()=>reindent(model,language,options.indent));
        else if(e.altKey&&!mod&&key==='u')controller.redoSelection();
        else if(e.ctrlKey&&key==='m'){options.captureTab=options.captureTab===false;}
        else if(mac&&e.ctrlKey&&!e.metaKey&&['b','f','p','n','a','e','d','h','k','o','t','v'].includes(key)) {
            let movements:Record<string,string>={b:'ArrowLeft',f:'ArrowRight',p:'ArrowUp',n:'ArrowDown',a:'Home',e:'End',v:'PageDown'};
            if(movements[key])moveSelection(movements[key],e.shiftKey);
            else if(key==='d'||key==='h')editable(()=>deleteVisibleCharacter(key==='h',e.altKey));
            else if(key==='t')editable(()=>transpose(model));
            else if(key==='o')editable(()=>{let ranges=model.selections;let changed=insertText(model,preferredEol(model.value),'splitLine');model.selectMany(ranges);return changed;});
            else if(key==='k')editable(()=>{model.selectMany(model.selections.map(range=>({start:range.end,end:model.offset(model.position(range.end).line,1e9)})));return insertText(model,'','deleteLineEnd');});
        }
        else if(mod&&!e.altKey) {
            switch(key) {
                case 'z':e.shiftKey?controller.redo():controller.undo();break;
                case 'y':controller.redo();break;
                case 'u':e.shiftKey?controller.redoSelection():controller.undoSelection();break;
                case 's':controller.save();break;
                case 'f':controller.openFind();break;
                case 'h':controller.openFind(true);break;
                case 'g':e.shiftKey?controller.findPrevious():controller.findNext();break;
                case 'l':if(e.shiftKey)controller.addNextOccurrence(true);else handled=false;break;
                case '/':controller.toggleComment();break;
                case ']':controller.indent();break;
                case '[':controller.outdent();break;
                case 'd':controller.addNextOccurrence();break;
                case 'a':if(e.shiftKey)controller.addNextOccurrence(true);else {model.select({start:0,end:model.value.length});sync();}break;
                case 'k':if(e.shiftKey)controller.lineCommand('delete');else handled=false;break;
                case 'enter':controller.lineCommand('blank');break;
                case '\\':if(e.shiftKey){let pair=matchingPair(syntax.pairs,model.selection.end);if(pair){model.select({start:model.selection.end<=pair.from+1?pair.to+1:pair.from});sync(true);}}else handled=false;break;
                case 'i':{let range=model.selection,pair=syntax.pairs.filter(pair=>pair.from<=range.start&&pair.to>=range.end&&(pair.from<range.start||pair.to>range.end)).sort((a,b)=>(a.to-a.from)-(b.to-b.from))[0];if(pair){model.select({start:pair.from,end:pair.to+1});sync(true);}break;}
                default:handled=false;
            }
            if(!handled&&/^(ArrowLeft|ArrowRight|Home|End|ArrowUp|ArrowDown)$/.test(e.key)&&model.selections.length>1){moveSelection(e.key,e.shiftKey,e.ctrlKey||e.altKey,false,/^(Home|End)$/.test(e.key)||mac&&/^(ArrowUp|ArrowDown)$/.test(e.key));handled=true;}
        }
        else if(e.key==='Tab'&&!e.altKey&&options.captureTab!==false&&!options.readonly)e.shiftKey?controller.outdent():controller.indent();
        else if(e.key==='Enter'&&!e.altKey&&!options.readonly&&options.autoIndent!==false)controller.newline();
        else if(e.key==='F3')e.shiftKey?controller.findPrevious():controller.findNext();
        else if(e.altKey&&/^(ArrowLeft|ArrowRight)$/.test(e.key))moveSelection(e.key,e.shiftKey,true);
        else if(mac&&e.altKey&&key==='v')moveSelection('PageUp',e.shiftKey);
        else if((model.selections.length>1||e.key==='Home')&&/^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|PageUp|PageDown|Home|End)$/.test(e.key))moveSelection(e.key,e.shiftKey,e.altKey);
        else if((e.key==='Backspace'||e.key==='Delete')&&model.selections.length>1)editable(()=>deleteVisibleCharacter(e.key==='Backspace',mod||e.altKey));
        else handled=false;
        if (handled) e.preventDefault();
    });
    let Observer = (win as Window & typeof globalThis).ResizeObserver,
        observer = Observer ? new Observer(schedule) : undefined;
    observer?.observe(surface);
    listen(win, 'resize', schedule);
    if (dom.fonts) listen(dom.fonts, 'loadingdone', ()=>{layoutDirty=true;schedule();});
    setOptions({ highlight: true, lineNumbers: true, ...initial });
    sync();
    flush();
    return controller;
}

function matchAt(matches: readonly Match[], offset: number) {
    let lo = 0, hi = matches.length;
    while (lo < hi) {
        let mid = (lo + hi) >>> 1;
        if (matches[mid].to < offset) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

let uid = 0;
