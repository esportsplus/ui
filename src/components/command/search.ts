import { reactive } from '@esportsplus/reactivity';
import { component } from '@esportsplus/template';
import command, { opener, type State, type Tab } from './palette';
import './scss/index.scss';


type Modal = Parameters<typeof command>[0] & {
    state: State;
};

type Trigger = Omit<Parameters<typeof opener>[0], 'state'> & {
    onclick?: never;
    onkeydown?: never;
    state: State;
};


// A search's open state, view and query, shared by its modal and every trigger that opens it.
const state = (): State => reactive({ active: false, index: -1, query: '', tab: 'all' as Tab });


// The palette on its own, without the built-in trigger, so it can mount once where Mod+K reaches it from anywhere
// while its triggers sit elsewhere.
const modal = component(
    function({ state, ...attributes }: Modal) {
        return command({ hotkey: ['Mod', 'K'], ...attributes, state, trigger: false });
    }
);

// Opens the search it shares a state with, showing the Mod+K the modal answers to.
const trigger = component(
    function({ state, ...attributes }: Trigger) {
        return opener({ kbd: ['Mod', 'K'], ...attributes }, state, () => {
            state.active = true;
        });
    }
);


export default { modal, state, trigger };
