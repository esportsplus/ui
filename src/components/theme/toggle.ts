import { component, type Attributes } from '@esportsplus/template';
import expand, { EXPAND_OPTION, EXPAND_TRIGGER, type A as ExpandAttributes } from '~/components/select/expand';
import { CHOICES, glyph, type Theme } from './shared';


type T = Omit<ExpandAttributes, 'label' | 'options' | 'selected' | 'state'> & {
    [EXPAND_TRIGGER]?: Attributes;
    mode: Theme;
};


const OPTIONS = CHOICES.map((choice) => ({
    content: () => glyph(choice.icon),
    label: choice.label,
    value: choice.value
}));


// The current choice's icon, opening on hover into a row of every choice. A pick folds the row back onto the button,
// so the mode is painted outward from the button.
export default component(({ mode, [EXPAND_TRIGGER]: trigger, ...attributes }: T) => {
    let button: HTMLElement | undefined,
        triggers: Attributes = {
            ...trigger,
            onconnect: (element, on) => {
                button = element;
                trigger?.onconnect?.(element, on);
            }
        };

    return expand({
        [EXPAND_TRIGGER]: triggers,
        label: 'Theme',
        openOn: 'hover',
        options: OPTIONS,
        state: {
            error: '',
            get selected() {
                return mode.preference;
            },
            set selected(value) {
                mode.set(value as Theme['preference'], button);
            }
        },
        ...attributes
    });
}, { option: EXPAND_OPTION, trigger: EXPAND_TRIGGER });
