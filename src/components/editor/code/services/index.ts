import { html, type Attributes, type Renderable } from '@esportsplus/template';
import type { Mark } from '../rows';
import type { Options } from '../view';
import { fileUri, languageIdFor } from './model';
import type { CompletionItem, Diagnostic, Hover, LanguageTransport, Notification, Position, Range, TextEdit } from './protocol';
import { session, type Host, type LanguageServiceOptions } from './session';
import { referenceRpcTransport } from './transport';


type Services = {
    anchors: () => Renderable<unknown>;
    aria: Attributes;
    configure: (options: Options) => void;
    dismiss: VoidFunction;
    dispose: VoidFunction;
    keydown: (e: KeyboardEvent) => boolean;
    leave: VoidFunction;
    marks: (from: number, to: number) => readonly Mark[];
    paint: VoidFunction;
    pointer: (e: PointerEvent) => void;
    retarget: VoidFunction;
    template: () => Renderable<unknown>;
};


// The editor's language services addon: the session's logic with its templates. 'anchors' render in the layer that
// scrolls with the text; the popovers and problems list render in the editor itself.
const services = (host: Host): Services => {
    let api = session(host),
        { anchors, card, complete, diagnostics, id } = api;

    return {
        anchors: () => html`
            <div
                aria-hidden='true'
                class='code-editor-anchor'
                ${{ style: () => `anchor-name: --code-editor-completion-${id}; ${anchors.completion}` }}
            ></div>
            <div
                aria-hidden='true'
                class='code-editor-anchor'
                ${{ style: () => `anchor-name: --code-editor-hover-${id}; ${anchors.hover}` }}
            ></div>
        `,
        aria: api.aria,
        configure: api.configure,
        dismiss: api.dismiss,
        dispose: api.dispose,
        keydown: api.keydown,
        leave: api.leave,
        marks: api.marks,
        paint: api.paint,
        pointer: api.pointer,
        retarget: api.retarget,
        template: () => html`
            <div
                aria-label='Completions'
                class='code-editor-completions'
                id='${complete.id}'
                popover='manual'
                role='listbox'
                style='${`--anchor: --code-editor-completion-${id};`}'
                ${{ onconnect: complete.attach }}
            >
                ${html.reactive(complete.rows, (row) => html`
                    <div
                        class='code-editor-completion'
                        id='${`${complete.id}-${row.index}`}'
                        role='option'
                        ${{
                            'aria-selected': () => String(complete.state.selected === row.index),
                            class: () => complete.state.selected === row.index && '--active',
                            onclick: () => api.accept(row.index),
                            // Keeps focus, and so the caret and selection, in the editor.
                            onpointerdown: (e: PointerEvent) => e.preventDefault(),
                            onpointermove: () => {
                                complete.state.selected = row.index;
                            }
                        }}
                    >
                        <span class='code-editor-completion-label'>${row.label}</span>
                        <span class='code-editor-completion-detail'>${row.detail}</span>
                    </div>
                `)}
            </div>
            <div
                class='code-editor-hover'
                popover='manual'
                role='tooltip'
                style='${`--anchor: --code-editor-hover-${id};`}'
                ${{ onconnect: card.attach }}
            >${() => card.state.text}</div>
            <div
                aria-label='Problems'
                aria-live='polite'
                class='code-editor-problems'
                ${{ class: () => diagnostics.problems.length > 0 && '--active' }}
            >
                ${html.reactive(diagnostics.problems, (entry) => html`
                    <button
                        class='code-editor-problem ${`code-editor-problem--${entry.severity}`}'
                        type='button'
                        ${{ onclick: () => api.reveal(entry.from, entry.to) }}
                    >${entry.label}</button>
                `)}
            </div>
        `
    };
};


export { fileUri, languageIdFor, referenceRpcTransport, services };
export type { CompletionItem, Diagnostic, Hover, LanguageServiceOptions, LanguageTransport, Notification, Position, Range, Services, TextEdit };
