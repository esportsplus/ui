import { untrack } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import type { State } from './index';


type A = Attributes & {
    state?: State;
};


// Where the example renders. With a state it waits for its example to mount and hides while the source shows; without
// one it renders at once. The render runs untracked, so state the example reads while building itself never rebuilds
// the stage.
export default component(
    function({ state, ...attributes }: A, render: () => Renderable<unknown>) {
        if (!state) {
            return html`<div class='preview-stage' ${attributes}>${untrack(render)}</div>`;
        }

        return html`
            <div
                class='preview-stage ${() => !state.mounted && 'preview-stage--pending'}'
                ${attributes}
                ${{
                    'aria-busy': () => state.mounted ? 'false' : 'true',
                    hidden: () => state.view !== 'preview'
                }}
            >
                ${() => state.mounted ? untrack(render) : undefined}
            </div>
        `;
    }
);
