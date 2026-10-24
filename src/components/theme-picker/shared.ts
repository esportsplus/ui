import icon from '~/components/icon';
import monitor from '@esportsplus/ui/svg/monitor.svg';
import moon from '@esportsplus/ui/svg/moon.svg';
import sun from '@esportsplus/ui/svg/sun.svg';
import type { Attributes } from '@esportsplus/template';
import type { Mode, Preference } from '~/components/theme';


type A = Attributes & {
    mode: Theme;
};

type Choice = {
    icon: string;
    label: string;
    value: Preference;
};

// The slice of a 'theme()' instance the pickers read and drive.
type Theme = {
    readonly mode: Mode;
    readonly preference: Preference;
    set(preference: Preference): void;
};


const CHOICES: Choice[] = [
    { icon: sun, label: 'Light', value: 'light' },
    { icon: moon, label: 'Dark', value: 'dark' },
    { icon: monitor, label: 'System', value: 'system' }
];


function choice(mode: Theme) {
    return CHOICES.find((choice) => choice.value === mode.preference) ?? CHOICES[2];
}

function glyph(id: string) {
    return icon({ 'aria-hidden': 'true', class: 'theme-picker-icon' }, id);
}

// Chosen-ness lives in 'aria-checked' alone: '--active' on a tooltip trigger means its tooltip is showing.
function radio(mode: Theme, choice: Choice) {
    return {
        'aria-checked': () => mode.preference === choice.value ? 'true' : 'false',
        onclick: () => mode.set(choice.value),
        role: 'radio',
        type: 'button'
    };
}


export { CHOICES, choice, glyph, radio };
export type { A, Choice, Theme };
