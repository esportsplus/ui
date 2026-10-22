import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import icon from '~/components/icon';
import { mac } from '~/shared/platform';
import cmd from '@esportsplus/ui/svg/command.svg';
import magnifier from '@esportsplus/ui/svg/search.svg';
import command, { type State, type Tab } from './index';


type Modal = Parameters<typeof command>[0] & {
    state: State;
};

type Trigger = Attributes & {
    label?: string;
    onclick?: never;
    state: State;
};


// A search's open state, view and query, shared by its modal and every trigger that opens it.
const state = (): State => reactive({ active: false, index: 0, query: '', tab: 'all' as Tab });


// The palette on its own, without the built-in trigger, so it can mount once where Mod+K reaches it from anywhere
// while its triggers sit elsewhere.
const modal = component(
    function({ state, ...attributes }: Modal) {
        return command({ [command.trigger]: { hidden: true }, ...attributes, state });
    }
);

// Opens the search it shares a state with, showing the Mod+K the modal answers to.
const trigger = component(
    function({ label = 'Search', state, ...attributes }: Trigger) {
        let apple = mac();

        return html`
            <button
                aria-haspopup='dialog'
                aria-keyshortcuts='${apple ? 'Meta+K' : 'Control+K'}'
                aria-label='${label}'
                class='button command-trigger'
                title='${label} (${apple ? '⌘' : 'Ctrl+'}K)'
                type='button'
                ${attributes}
                ${{
                    'aria-expanded': () => state.active ? 'true' : 'false',
                    onclick: () => {
                        state.active = true;
                    }
                }}
            >
                ${icon({ 'aria-hidden': 'true', class: 'command-trigger-icon command-trigger-icon--search' }, magnifier)}
                <span class='command-trigger-label'>${label}</span>
                <span aria-hidden='true' class='command-keys'>
                    <kbd class='button button--kbd'>${apple ? icon({ 'aria-hidden': 'true', class: 'command-kbd-icon' }, cmd) : 'Ctrl'}</kbd>
                    <kbd class='button button--kbd'>K</kbd>
                </span>
            </button>
        `;
    }
);


export default { modal, state, trigger };
