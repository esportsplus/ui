import { effect, untrack } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import { EditorDocument } from './document';
import { mountMarkdownEditor, type MarkdownCallbacks, type MarkdownController, type MarkdownOptions } from './markdown-view';
import './scss/_markdown.scss';

export type MarkdownEditorAttributes = Attributes & MarkdownCallbacks & {
    document: EditorDocument;
    options?: MarkdownOptions | (() => MarkdownOptions);
    controller?: (controller: MarkdownController) => void;
};
function template(this: { attributes?: Partial<MarkdownEditorAttributes> } | void, input: MarkdownEditorAttributes) {
    let props = untrack(() => ({ ...this?.attributes, ...input })),
        { document: doc, options, controller: receive, onChange, onSelection, onSave, onconnect, ondisconnect, ...attributes } = props,
        view: MarkdownController | undefined, stop: VoidFunction | undefined,
        resolveOptions = () => { let value = input.options ?? this?.attributes?.options; return { ...(typeof value === 'function' ? value() : value) }; };
    return html`<div class='markdown-editor' ${attributes} ${{
        onconnect: (host: HTMLElement) => {
            stop?.(); view?.dispose(); view = mountMarkdownEditor(host, doc, untrack(resolveOptions), { onChange, onSave, onSelection });
            let mounted = view, stopOptions = effect(() => { let next = resolveOptions(); untrack(() => mounted.setOptions(next, true)); }), disposeView = mounted.dispose;
            stop = stopOptions;
            mounted.dispose = () => { stopOptions(); if (stop === stopOptions) stop = undefined; disposeView(); };
            receive?.(mounted); onconnect?.(host);
        },
        ondisconnect: (host: HTMLElement) => { stop?.(); stop = undefined; view?.dispose(); view = undefined; ondisconnect?.(host); }
    }}></div>`;
}
export { EditorDocument, mountMarkdownEditor };
export type { MarkdownOptions, MarkdownController, MarkdownCallbacks };
export const markdownEditor = component(template);
export default markdownEditor;
