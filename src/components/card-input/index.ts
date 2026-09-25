import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import input from '~/components/input';
import './scss/index.scss';


type A = Attributes & {
    [CARD_INPUT_FIELD]?: FieldAttributes;
    [CARD_INPUT_SUBMIT]?: Attributes;
    note?: Renderable<unknown>;
    onvalid?: (card: Card) => void;
    state?: State;
    submit?: Renderable<unknown>;
};

type Brand = 'amex' | 'discover' | 'mastercard' | 'unknown' | 'visa';

type Card = {
    brand: Brand;
    expiry: string;
    last4: string;
    name: string;
};

type D = Attributes & Pick<A, typeof CARD_INPUT_FIELD | typeof CARD_INPUT_SUBMIT>;

type Field = 'cvc' | 'expiry' | 'name' | 'number';

type FieldAttributes = Parameters<typeof input>[0];

type Slot = {
    char: string;
    gap: boolean;
    roll: number;
};

type Spec = {
    cvc: number;
    gaps: number[];
    // Valid lengths; the first is what the card face shows as placeholders.
    lengths: number[];
    name: string;
    test: RegExp;
};

type State = Record<Field, string>;


const BRANDS: Record<Brand, Spec> = {
    // Amex groups 4-6-5 and puts a 4 digit code on the front.
    amex: { cvc: 4, gaps: [4, 10], lengths: [15], name: 'American Express', test: /^3[47]/ },
    discover: { cvc: 3, gaps: [4, 8, 12, 16], lengths: [16, 19], name: 'Discover', test: /^(6011|65|64[4-9])/ },
    mastercard: { cvc: 3, gaps: [4, 8, 12], lengths: [16], name: 'Mastercard', test: /^(5[1-5]|2[2-7])/ },
    // An unrecognised prefix stops at 16, the length nearly every card has, so a typo never spills past the card.
    unknown: { cvc: 3, gaps: [4, 8, 12, 16], lengths: [16, 12, 13, 14, 15], name: 'Card', test: /^/ },
    visa: { cvc: 3, gaps: [4, 8, 12, 16], lengths: [16, 13, 19], name: 'Visa', test: /^4/ }
};

const CARD_INPUT_FIELD = Symbol.for('@esportsplus/ui/card-input.field');

const CARD_INPUT_SUBMIT = Symbol.for('@esportsplus/ui/card-input.submit');

// Long enough to read, short enough that a second check isn't blocked.
const CONFIRM_FOR = 2000;

const FIELDS: Field[] = ['number', 'expiry', 'cvc', 'name'];

const ORDER: Brand[] = ['visa', 'mastercard', 'amex', 'discover'];


let uid = 0;


function caret(value: string, count: number) {
    if (count <= 0) {
        return 0;
    }

    let seen = 0;

    for (let i = 0, n = value.length; i < n; i++) {
        if (/\d/.test(value[i]) && ++seen === count) {
            return i + 1;
        }
    }

    return value.length;
}

function detect(digits: string): Brand {
    return ORDER.find((brand) => BRANDS[brand].test.test(digits)) ?? 'unknown';
}

function digitsOf(value: string) {
    return value.replace(/\D/g, '');
}

function expiry(digits: string) {
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

function group(digits: string, gaps: number[]) {
    let out = '';

    for (let i = 0, n = digits.length; i < n; i++) {
        if (gaps.includes(i)) {
            out += ' ';
        }

        out += digits[i];
    }

    return out;
}

function luhn(digits: string) {
    let sum = 0;

    for (let i = 0, n = digits.length; i < n; i++) {
        let d = Number(digits[n - 1 - i]);

        if (i % 2) {
            d *= 2;

            if (d > 9) {
                d -= 9;
            }
        }

        sum += d;
    }

    return sum % 10 === 0;
}

// Monochrome marks in currentColor, so they take the theme instead of fighting it.
function mark(brand: () => Brand, size: 'large' | 'small') {
    let active = (b: Brand) => () => brand() === b && '--active';

    return html`
        <span aria-hidden='true' class='card-input-brand card-input-brand--${size}'>
            <span class='card-input-brand-mark ${active('unknown')}'>
                <svg viewBox='0 0 36 24'>
                    <g fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5'>
                        <rect height='14.5' rx='2.5' width='22.5' x='6.75' y='4.75' />
                        <path d='M6.75 9.25h22.5M10.5 15.5h4' />
                    </g>
                </svg>
            </span>
            <span class='card-input-brand-mark ${active('visa')}'>
                <svg viewBox='0 0 36 24'>
                    <text fill='currentColor' font-size='12.5' font-style='italic' font-weight='800' letter-spacing='-0.3' text-anchor='middle' x='18' y='16.5'>VISA</text>
                </svg>
            </span>
            <span class='card-input-brand-mark ${active('mastercard')}'>
                <svg viewBox='0 0 36 24'>
                    <circle cx='14' cy='12' fill='currentColor' opacity='0.55' r='7' />
                    <circle cx='22' cy='12' fill='currentColor' opacity='0.9' r='7' />
                </svg>
            </span>
            <span class='card-input-brand-mark ${active('amex')}'>
                <svg viewBox='0 0 36 24'>
                    <rect fill='none' height='14.5' rx='2.5' stroke='currentColor' stroke-width='1.5' width='28.5' x='3.75' y='4.75' />
                    <text fill='currentColor' font-size='8' font-weight='800' letter-spacing='0.4' text-anchor='middle' x='18' y='15.25'>AMEX</text>
                </svg>
            </span>
            <span class='card-input-brand-mark ${active('discover')}'>
                <svg viewBox='0 0 36 24'>
                    <text fill='currentColor' font-size='7.5' font-weight='700' letter-spacing='0.2' text-anchor='middle' x='15' y='15'>DISC</text>
                    <circle cx='28.5' cy='12.25' fill='currentColor' r='3.5' />
                </svg>
            </span>
        </span>
    `;
}

// Reformats in place and puts the caret back after the same number of digits it was after, so editing mid-number
// never throws it to the end.
function reformat(element: HTMLInputElement, max: number, format: (digits: string) => string, pad?: (digits: string) => string) {
    let at = element.selectionStart ?? element.value.length,
        before = digitsOf(element.value.slice(0, at)).length,
        digits = digitsOf(element.value).slice(0, max);

    if (pad) {
        let padded = pad(digits);

        before += padded.length - digits.length;
        digits = padded;
    }

    let value = format(digits);

    element.value = value;

    if (document.activeElement === element) {
        let position = caret(value, Math.min(before, digits.length));

        element.setSelectionRange(position, position);
    }

    return { digits, value };
}

// Backspace right after a space or slash would delete the separator, which reformatting puts straight back, leaving
// the caret stuck. Step over it so the digit before goes instead.
function skip(e: KeyboardEvent) {
    let element = e.currentTarget as HTMLInputElement,
        at = element.selectionStart;

    if (at === null || at !== element.selectionEnd) {
        return;
    }

    if (e.key === 'Backspace' && at > 0 && /\D/.test(element.value[at - 1])) {
        element.setSelectionRange(at - 1, at - 1);
    }

    if (e.key === 'Delete' && at < element.value.length && /\D/.test(element.value[at])) {
        element.setSelectionRange(at + 1, at + 1);
    }
}

function validate(field: Field, values: State, final: boolean) {
    let spec = BRANDS[detect(digitsOf(values.number))],
        value = values[field],
        digits = digitsOf(value);

    // Tabbing past an empty field isn't a mistake; only a full check flags it.
    if (!value.trim()) {
        return final ? 'Required' : '';
    }

    if (field === 'number') {
        if (!spec.lengths.includes(digits.length)) {
            return 'Too short';
        }

        if (!luhn(digits)) {
            return 'Not a valid number';
        }
    }

    if (field === 'expiry') {
        if (digits.length < 4) {
            return 'Use MM/YY';
        }

        let month = Number(digits.slice(0, 2)),
            now = new Date(),
            year = 2000 + Number(digits.slice(2));

        if (month < 1 || month > 12) {
            return 'Invalid month';
        }

        // Cards stay valid through the last day of their expiry month.
        if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
            return 'Card expired';
        }
    }

    if (field === 'cvc' && digits.length < spec.cvc) {
        return 'Too short';
    }

    return '';
}


export default Object.assign(
    function(
        this: { attributes?: D } | void,
        {
            note = 'Demo only. Nothing is charged or sent anywhere.',
            onvalid,
            state = reactive({ cvc: '', expiry: '', name: '', number: '' }),
            submit = 'Check details',
            ...attributes
        }: A
    ) {
        let fields: Record<Field, { active: boolean, error: string }> = {
                cvc: reactive({ active: false, error: '' }),
                expiry: reactive({ active: false, error: '' }),
                name: reactive({ active: false, error: '' }),
                number: reactive({ active: false, error: '' })
            },
            id = `card-input-${++uid}`,
            local = reactive({ confirmed: false, focused: '' as Field | '' }),
            parts = { ...this?.attributes?.[CARD_INPUT_FIELD], ...attributes[CARD_INPUT_FIELD] },
            reduced = matchMedia('(prefers-reduced-motion: reduce)'),
            regions: Partial<Record<Field, HTMLElement>> = {},
            ring: HTMLElement | undefined,
            slots = reactive([] as Slot[]),
            timer: ReturnType<typeof setTimeout> | undefined;

        function brand() {
            return detect(digitsOf(state.number));
        }

        function check(e: SubmitEvent) {
            e.preventDefault();

            let bad: Field | undefined;

            for (let i = 0, n = FIELDS.length; i < n; i++) {
                let error = validate(FIELDS[i], state, true);

                fields[FIELDS[i]].error = error;

                if (error && !bad) {
                    bad = FIELDS[i];
                }
            }

            if (bad) {
                document.getElementById(`${id}-${bad}`)?.focus();
                return;
            }

            let digits = digitsOf(state.number);

            local.confirmed = true;
            onvalid?.({ brand: detect(digits), expiry: state.expiry, last4: digits.slice(-4), name: state.name.trim() });

            clearTimeout(timer);
            timer = setTimeout(() => {
                local.confirmed = false;
            }, CONFIRM_FOR);
        }

        function control(field: Field, own: FieldAttributes) {
            return input.call({ attributes: parts }, {
                ...own,
                'aria-describedby': () => fields[field].error ? `${id}-${field}-error` : '',
                'aria-invalid': () => fields[field].error ? 'true' : 'false',
                class: `card-input-field card-input-field--${field}`,
                id: `${id}-${field}`,
                onblur: () => {
                    if (local.focused === field) {
                        local.focused = '';
                    }

                    fields[field].error = validate(field, state, false);
                },
                onfocus: () => {
                    local.focused = field;
                },
                state: fields[field],
                value: () => state[field]
            });
        }

        // The ring is measured with offset* values, which ignore the flip's transform.
        function frame(field: Field | '') {
            let region = field && field !== 'cvc' ? regions[field] : undefined;

            if (!ring) {
                return;
            }

            if (!region) {
                ring.classList.remove('--active');
                return;
            }

            let style = `height: ${region.offsetHeight + 12}px; left: ${region.offsetLeft - 8}px; top: ${region.offsetTop - 6}px; width: ${region.offsetWidth + 16}px;`;

            // Coming from nowhere it appears in place; only a move between fields slides.
            if (!ring.classList.contains('--active') || reduced.matches) {
                ring.style.cssText = `${style} transition-property: opacity;`;
                ring.getBoundingClientRect();
                ring.style.removeProperty('transition-property');
            }
            else {
                ring.style.cssText = style;
            }

            ring.classList.add('--active');
        }

        function set(field: Field, value: string) {
            state[field] = value;
            // Typing is the fix, so the error goes at once rather than fading.
            fields[field].error = '';
            local.confirmed = false;
        }

        function shell(field: Field, label: string, content: Renderable<unknown>) {
            return html`
                <div class='card-input-shell card-input-shell--${field}'>
                    <div class='card-input-shell-header'>
                        <label class='card-input-label' for='${id}-${field}'>${label}</label>
                        ${() => {
                            let error = fields[field].error;

                            return error ? html`<span class='card-input-error' id='${id}-${field}-error'>${error}</span>` : '';
                        }}
                    </div>
                    ${content}
                </div>
            `;
        }

        effect(() => {
            let digits = digitsOf(state.number),
                spec = BRANDS[detect(digits)],
                length = Math.max(spec.lengths[0], digits.length);

            untrack(() => {
                let initial = slots.length === 0;

                for (let i = 0; i < length; i++) {
                    let char = digits[i] ?? '•',
                        gap = spec.gaps.includes(i),
                        slot = slots[i];

                    if (!slot) {
                        slots.push(reactive({ char, gap, roll: initial ? 0 : 1 }));
                        continue;
                    }

                    slot.gap = gap;

                    // Alternating the roll parity swaps between identical keyframes, replaying the arrival for each new digit.
                    if (slot.char !== char) {
                        slot.char = char;
                        slot.roll = slot.roll === 1 ? 2 : 1;
                    }
                }

                if (slots.length > length) {
                    slots.splice(length);
                }
            });
        });

        effect(() => {
            let focused = local.focused;

            untrack(() => frame(focused));
        });

        onCleanup(() => {
            clearTimeout(timer);
        });

        return html`
            <form
                aria-label='Card details'
                class='card-input'
                novalidate
                ${this?.attributes}
                ${attributes}
                ${{ onsubmit: check }}
            >
                <div aria-hidden='true' class='card-input-preview'>
                    <div class='card-input-card ${() => local.focused === 'cvc' && '--flipped'}'>
                        <div class='card-input-face card-input-face--front'>
                            <span class='card-input-ring' ${{ onrender: (element: HTMLElement) => { ring = element; } }}></span>
                            <div class='card-input-face-top'>
                                <svg class='card-input-chip' fill='none' viewBox='0 0 44 32'>
                                    <rect fill='currentColor' height='32' opacity='0.22' rx='6' width='44' />
                                    <path d='M0 11h14m16 0h14M0 21h14m16 0h14M14 0v32M30 0v32M14 16h16' stroke='currentColor' stroke-opacity='0.3' />
                                </svg>
                                ${mark(brand, 'large')}
                            </div>
                            <div class='card-input-number' ${{ onrender: (element: HTMLElement) => { regions.number = element; } }}>
                                ${html.reactive(slots, (slot) => html`
                                    <span
                                        class='card-input-digit ${() => slot.gap && '--gap'} ${() => slot.char === '•' && '--placeholder'}'
                                        data-roll='${() => slot.roll}'
                                    >${() => slot.char}</span>
                                `)}
                            </div>
                            <div class='card-input-face-bottom'>
                                <div class='card-input-holder' ${{ onrender: (element: HTMLElement) => { regions.name = element; } }}>
                                    <span class='card-input-caption'>Card holder</span>
                                    <span class='card-input-holder-value'>${() => state.name.trim() || 'Your name'}</span>
                                </div>
                                <div class='card-input-expires' ${{ onrender: (element: HTMLElement) => { regions.expiry = element; } }}>
                                    <span class='card-input-caption'>Expires</span>
                                    <span class='card-input-expires-value'>${() => state.expiry || 'MM/YY'}</span>
                                </div>
                            </div>
                        </div>
                        <div class='card-input-face card-input-face--back'>
                            <div class='card-input-stripe'></div>
                            <div class='card-input-signature'>
                                <div class='card-input-signature-value'>${() => state.cvc || (brand() === 'amex' ? '••••' : '•••')}</div>
                                <span class='card-input-caption'>CVC</span>
                            </div>
                            <p class='card-input-disclaimer'>Not a real card. Nothing you type leaves this page.</p>
                        </div>
                    </div>
                </div>

                <div class='card-input-fields'>
                    ${shell('number', 'Card number', html`
                        <div class='card-input-control'>
                            ${control('number', {
                                autocomplete: 'cc-number',
                                inputmode: 'numeric',
                                oninput: (e: Event) => {
                                    let element = e.currentTarget as HTMLInputElement,
                                        next = BRANDS[detect(digitsOf(element.value))],
                                        { digits, value } = reformat(element, Math.max(...next.lengths), (d) => group(d, next.gaps));

                                    set('number', value);

                                    // A shorter code is required once the brand changes away from Amex.
                                    let max = BRANDS[detect(digits)].cvc;

                                    if (state.cvc.length > max) {
                                        state.cvc = state.cvc.slice(0, max);
                                    }
                                },
                                onkeydown: skip,
                                placeholder: '1234 5678 9012 3456'
                            })}
                            <span class='card-input-control-brand ${() => brand() !== 'unknown' && '--known'}'>${mark(brand, 'small')}</span>
                        </div>
                    `)}
                    <div class='card-input-row'>
                        ${shell('expiry', 'Expiry', control('expiry', {
                            autocomplete: 'cc-exp',
                            inputmode: 'numeric',
                            oninput: (e: Event) => {
                                // A first digit of 2 to 9 can only be a single digit month.
                                let { value } = reformat(e.currentTarget as HTMLInputElement, 4, expiry, (d) => /^[2-9]/.test(d) ? `0${d}`.slice(0, 4) : d);

                                set('expiry', value);
                            },
                            onkeydown: skip,
                            placeholder: 'MM/YY'
                        }))}
                        ${shell('cvc', 'CVC', control('cvc', {
                            autocomplete: 'cc-csc',
                            inputmode: 'numeric',
                            oninput: (e: Event) => {
                                let { value } = reformat(e.currentTarget as HTMLInputElement, BRANDS[brand()].cvc, (d) => d);

                                set('cvc', value);
                            },
                            placeholder: () => brand() === 'amex' ? '1234' : '123'
                        }))}
                    </div>
                    ${shell('name', 'Name on card', control('name', {
                        autocapitalize: 'words',
                        autocomplete: 'cc-name',
                        maxlength: 40,
                        oninput: (e: Event) => {
                            set('name', (e.currentTarget as HTMLInputElement).value);
                        },
                        placeholder: 'Ada Lovelace',
                        spellcheck: false
                    }))}
                </div>

                <div class='card-input-actions'>
                    <button
                        class='card-input-submit ${() => local.confirmed && '--active'}'
                        type='submit'
                        ${this?.attributes?.[CARD_INPUT_SUBMIT]}
                        ${attributes[CARD_INPUT_SUBMIT]}
                    >
                        <span class='card-input-submit-labels'>
                            <span aria-hidden=${() => local.confirmed ? 'true' : 'false'} class='card-input-submit-label card-input-submit-label--idle'>
                                <span class='card-input-submit-text'>${submit}</span>
                            </span>
                            <span aria-hidden=${() => local.confirmed ? 'false' : 'true'} class='card-input-submit-label card-input-submit-label--confirmed'>
                                <svg class='card-input-submit-icon' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 16 16'>
                                    <path d='m3.5 8.5 3 3 6-7' />
                                </svg>
                                <span class='card-input-submit-text'>Details look valid</span>
                            </span>
                        </span>
                    </button>
                    ${note ? html`
                        <p class='card-input-note'>
                            <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
                                <rect height='6.25' rx='1.5' width='9.5' x='3.25' y='7' />
                                <path d='M5.5 7V5a2.5 2.5 0 0 1 5 0v2' />
                            </svg>
                            ${note}
                        </p>
                    ` : ''}
                    <span aria-live='polite' class='card-input-live'>${() => local.confirmed ? 'Card details look valid' : ''}</span>
                    <span aria-live='polite' class='card-input-live'>${() => brand() === 'unknown' ? '' : `${BRANDS[brand()].name} card`}</span>
                </div>
            </form>
        `;
    },
    { field: CARD_INPUT_FIELD, submit: CARD_INPUT_SUBMIT } as const
);
