import { component, html } from '@esportsplus/template';
import copy from '~/components/copy';
import viewer, { type CodeViewerAttributes } from '~/components/editor/viewer';


type A = Pick<CodeViewerAttributes, 'fold' | 'language' | 'lineNumbers' | 'value' | 'whitespace' | 'wrap'> & {
    class?: string;
    // What the copy button announces, e.g. 'Copy theme.ts'.
    label?: string;
};


// Source flush in its frame, with a copy button floating over it that writes the same value.
export default component(
    function({ class: classname, label = 'Copy code', ...attributes }: A) {
        return html`
            <div class='preview-code'>
                ${copy({
                    class: 'preview-copy',
                    error: 'Copy unavailable. Select and copy the code.',
                    label,
                    value: attributes.value
                })}
                ${viewer({ ...attributes, class: `preview-viewer ${classname ?? ''}` })}
            </div>
        `;
    }
);
