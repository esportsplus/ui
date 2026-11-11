import { reactive } from '@esportsplus/reactivity';
import { component, html } from '@esportsplus/template';
import eye from '@esportsplus/ui/svg/eye.svg';
import hidden from '@esportsplus/ui/svg/eye-off.svg';
import checkbox from '~/components/checkbox';
import group from '~/components/group';
import icon from '~/components/icon';
import progress from '~/components/progress';
import input from './field';


type A = Omit<NonNullable<Field>, 'oninput' | 'state'> & {
    oninput?: (e: Event) => void;
    state?: State;
    // Shows a meter scoring the password and the rules it meets under the field.
    strength?: boolean;
    // How the eye reveals the password: a press flips it, a hover shows it while the pointer rests on the eye.
    toggle?: 'click' | 'hover';
};

type Field = Parameters<typeof input>[0];

type State = {
    value: string;
};


const COMMON = ['123456', '12345678', 'abc123', 'admin', 'letmein', 'password', 'password1', 'qwerty', 'welcome'];

const DIGIT = /\d/;

const LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

const LOWERCASE = /[a-z]/;

const REPEATED = /(.)\1{2,}/;

const SYMBOL = /[^a-zA-Z\d\s]/;

const UPPERCASE = /[A-Z]/;

const WORD = /[a-z\d]/;

const RULES: [string, (value: string) => boolean][] = [
    ['12 characters or more', (value) => value.length >= 12],
    ['Upper and lower case', (value) => LOWERCASE.test(value) && UPPERCASE.test(value)],
    ['A number', (value) => DIGIT.test(value)],
    ['A symbol', (value) => SYMBOL.test(value)]
];


// Common passwords, a character repeated three times, or a run of three ascending characters ("abc", "123").
function guessable(value: string) {
    let lower = value.toLowerCase();

    if (COMMON.includes(lower) || REPEATED.test(value)) {
        return true;
    }

    for (let i = 2, n = lower.length; i < n; i++) {
        let a = lower.charCodeAt(i - 2),
            b = lower.charCodeAt(i - 1),
            c = lower.charCodeAt(i);

        if (b - a === 1 && c - b === 1 && WORD.test(lower[i])) {
            return true;
        }
    }

    return false;
}

function score(value: string) {
    if (!value) {
        return 0;
    }

    if (guessable(value)) {
        return 1;
    }

    let met = 0;

    for (let i = 0, n = RULES.length; i < n; i++) {
        if (RULES[i][1](value)) {
            met++;
        }
    }

    return Math.max(1, met);
}


export default component(
    function(
        this: { attributes?: Field } | void,
        {
            oninput,
            strength = false,
            toggle = 'click',
            value = '',
            state = reactive({ value: String(value) }),
            ...attributes
        }: A
    ) {
        let field: HTMLInputElement | undefined,
            local = reactive({ hovering: false, revealed: false }),
            meter = reactive({ value: score(state.value) / RULES.length * 100 }),
            visible = () => local.revealed || local.hovering;

        attributes.autocomplete ??= strength ? 'new-password' : 'current-password';

        return html`
            ${group({}, html`
                ${input.call(this, {
                    ...attributes,
                    onconnect: (element: HTMLInputElement) => {
                        field = element;
                    },
                    oninput: (e: Event) => {
                        state.value = (e.currentTarget as HTMLInputElement).value;
                        meter.value = score(state.value) / RULES.length * 100;
                        oninput?.(e);
                    },
                    type: () => visible() ? 'text' : 'password',
                    value: state.value
                })}
                <button
                    class='group-item group-item--overlay input-password-toggle'
                    type='button'
                    ${{
                        'aria-label': () => visible() ? 'Hide password' : 'Show password',
                        'aria-pressed': () => visible() ? 'true' : 'false',
                        // A hover reveal is the pointer's; a click still flips it from the keyboard, whose
                        // clicks carry no detail.
                        onclick: (e: MouseEvent) => {
                            if (toggle === 'click' || !e.detail) {
                                local.revealed = !local.revealed;
                            }
                        },
                        onpointerdown: (e: PointerEvent) => {
                            // Keeps focus and the caret in the field.
                            if (field && document.activeElement === field) {
                                e.preventDefault();
                            }
                        },
                        onpointerenter: () => {
                            if (toggle === 'hover') {
                                local.hovering = true;
                            }
                        },
                        onpointerleave: () => {
                            local.hovering = false;
                        }
                    }}
                >
                    ${() => icon({ 'aria-hidden': 'true', class: 'input-password-icon' }, visible() ? hidden : eye)}
                </button>
            `)}
            ${strength && html`
                ${progress({
                    class: 'group-progress progress--segmented',
                    percent: false,
                    state: meter,
                    status: (value) => `${LABELS[Math.round(value / 100 * RULES.length)]}${guessable(state.value) ? ' · commonly guessed' : ''}`
                })}
                ${RULES.map(([label, test]) => html`
                    <div class='group group--row' inert>
                        ${checkbox({ [checkbox.input]: { checked: () => test(state.value), tabindex: -1 } })}
                        <span class='group-label group-label--small'>${label}</span>
                    </div>
                `)}
            `}
        `;
    }
);

export type { State };
