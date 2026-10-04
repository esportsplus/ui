import { html } from '~/app';
import { highlight, icon } from '@esportsplus/ui/components';
import code from '@esportsplus/ui/svg/code.svg';
import eye from '@esportsplus/ui/svg/eye.svg';
import '~/components/example-view/scss/index.scss';


type View = 'preview' | 'code';


const exampleView = (state: { view: View }, onchange: (view: View) => void, label = 'Example view') => html`
    <div class='example-view' role='group' aria-label='${label}'>
        ${highlight({ class: 'example-view-highlight', target: '.example-view-button' })}
        ${(['preview', 'code'] as const).map((view) => html`
            <button
                class='example-view-button ${() => state.view === view && '--active'}'
                type='button'
                ${{
                    'aria-pressed': () => String(state.view === view),
                    onclick: () => onchange(view)
                }}
            >
                ${icon({ 'aria-hidden': 'true' }, view === 'preview' ? eye : code)}
                ${view === 'preview' ? 'Preview' : 'Code'}
            </button>
        `)}
    </div>
`;


export { exampleView };
export type { View };
