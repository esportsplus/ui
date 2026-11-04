import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import group from '~/components/group';
import type { State } from './index';


type A = Attributes & {
    state: State;
};

type View = {
    content: Renderable<unknown>;
    view: State['view'];
};


// Switches an example between its stage and its source, one button per view the consumer lists. Choosing the view
// already showing asks the source to try again, so a failed load retries from the same control.
export default component(
    function({ state, ...attributes }: A, views: View[]) {
        return group(
            {
                [group.highlight]: { class: 'preview-view-highlight' },
                class: 'preview-view',
                role: 'group',
                ...attributes
            },
            views.map(({ content, view }) => html`
                <button
                    class='button button--group preview-view-button ${() => state.view === view && '--active'}'
                    type='button'
                    ${{
                        'aria-pressed': () => String(state.view === view),
                        onclick: () => {
                            if (state.view === view) {
                                state.retry++;
                            }
                            else {
                                state.view = view;
                            }
                        }
                    }}
                >
                    ${content}
                </button>
            `)
        );
    }
);
