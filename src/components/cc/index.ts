import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import faces from '~/components/button/faces';
import { check as checkmark } from '~/components/button/icons';
import input from '~/components/input';
import amex from '@esportsplus/ui/svg/amex.svg';
import card from '@esportsplus/ui/svg/card.svg';
import chip from '@esportsplus/ui/svg/chip.svg';
import discover from '@esportsplus/ui/svg/discover.svg';
import lock from '@esportsplus/ui/svg/lock.svg';
import mastercard from '@esportsplus/ui/svg/mastercard.svg';
import visa from '@esportsplus/ui/svg/visa.svg';
import '~/components/button/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    [CC_FIELD]?: FieldAttributes;
    [CC_SUBMIT]?: Attributes;
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

type D = Attributes & Pick<A, typeof CC_FIELD | typeof CC_SUBMIT>;

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
    icon: string;
    // Valid lengths; the first is what the card face shows as placeholders.
    lengths: number[];
    name: string;
    test: RegExp;
};

type State = Record<Field, string>;


const BRANDS: Record<Brand, Spec> = {
    // Amex groups 4-6-5 and puts a 4 digit code on the front.
    amex: { cvc: 4, gaps: [4, 10], icon: amex, lengths: [15], name: 'American Express', test: /^3[47]/ },
    discover: { cvc: 3, gaps: [4, 8, 12, 16], icon: discover, lengths: [16, 19], name: 'Discover', test: /^(6011|65|64[4-9])/ },
    mastercard: { cvc: 3, gaps: [4, 8, 12], icon: mastercard, lengths: [16], name: 'Mastercard', test: /^(5[1-5]|2[2-7])/ },
    // An unrecognised prefix stops at 16, the length nearly every card has, so a typo never spills past the card.
    unknown: { cvc: 3, gaps: [4, 8, 12, 16], icon: card, lengths: [16, 12, 13, 14, 15], name: 'Card', test: /^/ },
    visa: { cvc: 3, gaps: [4, 8, 12, 16], icon: visa, lengths: [16, 13, 19], name: 'Visa', test: /^4/ }
};

const CC_FIELD = Symbol.for('@esportsplus/ui/cc.field');

const CC_SUBMIT = Symbol.for('@esportsplus/ui/cc.submit');

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

function detect(value: string): Brand {
    let digits = digitsOf(value);

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
    return html`
        <span aria-hidden='true' class='cc-brand cc-brand--${size}'>
            ${(Object.keys(BRANDS) as Brand[]).map((b) => html`
                <span class='cc-brand-mark ${() => brand() === b && '--active'}'>
                    <svg><use href='#${BRANDS[b].icon}' /></svg>
                </span>
            `)}
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

    return value;
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
    let spec = BRANDS[detect(values.number)],
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


export default component(
    function(
        this: { attributes?: D } | void,
        {
            note = '',
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
            id = `cc-${++uid}`,
            local = reactive({ confirmed: false, ring: false }),
            parts = { ...this?.attributes?.[CC_FIELD], ...attributes[CC_FIELD] },
            reduced = matchMedia('(prefers-reduced-motion: reduce)'),
            regions: Partial<Record<Field, HTMLElement>> = {},
            ring: HTMLElement | undefined,
            slots = reactive([] as Slot[]),
            timer: ReturnType<typeof setTimeout> | undefined;

        function brand() {
            return detect(state.number);
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
                ((e.currentTarget as HTMLFormElement).elements.namedItem(bad) as HTMLInputElement).focus();
                return;
            }

            local.confirmed = true;
            onvalid?.({ brand: brand(), expiry: state.expiry, last4: digitsOf(state.number).slice(-4), name: state.name.trim() });

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
                class: `cc-field cc-field--${field}`,
                id: `${id}-${field}`,
                name: field,
                onblur: () => {
                    fields[field].error = validate(field, state, false);
                },
                state: fields[field],
                value: () => state[field]
            });
        }

        function focused() {
            return FIELDS.find((field) => fields[field].active) ?? '';
        }

        // The ring is measured with offset* values, which ignore the flip's transform.
        function frame(field: Field | '') {
            let region = field && field !== 'cvc' ? regions[field] : undefined;

            if (!ring) {
                return;
            }

            if (!region) {
                local.ring = false;
                return;
            }

            let style = `height: ${region.offsetHeight + 12}px; left: ${region.offsetLeft - 8}px; top: ${region.offsetTop - 6}px; width: ${region.offsetWidth + 16}px;`;

            // Coming from nowhere it appears in place; only a move between fields slides. Written straight to the
            // element because the transition has to be off for exactly one style flush.
            if (!local.ring || reduced.matches) {
                ring.style.cssText = `${style} transition-property: opacity;`;
                ring.getBoundingClientRect();
                ring.style.removeProperty('transition-property');
            }
            else {
                ring.style.cssText = style;
            }

            local.ring = true;
        }

        function set(field: Field, value: string) {
            state[field] = value;
            // Typing is the fix, so the error goes at once rather than fading.
            fields[field].error = '';
            local.confirmed = false;
        }

        function shell(field: Field, label: string, content: Renderable<unknown>) {
            return html`
                <div class='cc-shell cc-shell--${field}'>
                    <div class='cc-shell-header'>
                        <label class='cc-label' for='${id}-${field}'>${label}</label>
                        ${() => {
                            let error = fields[field].error;

                            return error ? html`<span class='cc-error' id='${id}-${field}-error'>${error}</span>` : '';
                        }}
                    </div>
                    ${content}
                </div>
            `;
        }

        effect(() => digitsOf(state.number), (digits) => {
            let initial = slots.length === 0,
                spec = BRANDS[detect(digits)],
                length = Math.max(spec.lengths[0], digits.length);

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

        effect(focused, frame);

        onCleanup(() => {
            clearTimeout(timer);
        });

        return html`
            <form
                aria-label='Card details'
                class='cc'
                novalidate
                ${this?.attributes}
                ${attributes}
                ${{ onsubmit: check }}
            >
                <div aria-hidden='true' class='cc-preview'>
                    <div class='cc-card ${() => focused() === 'cvc' && 'cc-card--flipped'}'>
                        <div class='cc-face cc-face--front'>
                            <span
                                class='cc-ring ${() => local.ring && '--active'}'
                                ${{ onrender: (element: HTMLElement) => { ring = element; } }}
                            ></span>
                            <div class='cc-face-top'>
                                <svg class='cc-chip'><use href='#${chip}' /></svg>
                                ${mark(brand, 'large')}
                            </div>
                            <div class='cc-number' ${{ onrender: (element: HTMLElement) => { regions.number = element; } }}>
                                ${html.reactive(slots, (slot) => html`
                                    <span
                                        class='cc-digit ${() => slot.gap && 'cc-digit--gap'} ${() => slot.char === '•' && 'cc-digit--placeholder'}'
                                        data-roll='${() => slot.roll}'
                                    >${() => slot.char}</span>
                                `)}
                            </div>
                            <div class='cc-face-bottom'>
                                <div class='cc-holder' ${{ onrender: (element: HTMLElement) => { regions.name = element; } }}>
                                    <span class='cc-caption'>Card holder</span>
                                    <span class='cc-holder-value'>${() => state.name.trim() || 'Your name'}</span>
                                </div>
                                <div class='cc-expires' ${{ onrender: (element: HTMLElement) => { regions.expiry = element; } }}>
                                    <span class='cc-caption'>Expires</span>
                                    <span class='cc-expires-value'>${() => state.expiry || 'MM/YY'}</span>
                                </div>
                            </div>
                        </div>
                        <div class='cc-face cc-face--back'>
                            <div class='cc-stripe'></div>
                            <div class='cc-signature'>
                                <div class='cc-signature-value'>${() => state.cvc || (brand() === 'amex' ? '••••' : '•••')}</div>
                                <span class='cc-caption'>CVC</span>
                            </div>
                            <p class='cc-disclaimer'>Not a real card. Nothing you type leaves this page.</p>
                        </div>
                    </div>
                </div>

                <div class='cc-fields'>
                    ${shell('number', 'Card number', html`
                        <div class='cc-control'>
                            ${control('number', {
                                autocomplete: 'cc-number',
                                inputmode: 'numeric',
                                oninput: (e: Event) => {
                                    let element = e.currentTarget as HTMLInputElement,
                                        spec = BRANDS[detect(element.value)];

                                    set('number', reformat(element, Math.max(...spec.lengths), (d) => group(d, spec.gaps)));

                                    // A shorter code is required once the brand changes away from Amex.
                                    if (state.cvc.length > spec.cvc) {
                                        state.cvc = state.cvc.slice(0, spec.cvc);
                                    }
                                },
                                onkeydown: skip,
                                placeholder: '1234 5678 9012 3456'
                            })}
                            <span class='cc-control-brand ${() => brand() !== 'unknown' && 'cc-control-brand--known'}'>${mark(brand, 'small')}</span>
                        </div>
                    `)}
                    <div class='cc-row'>
                        ${shell('expiry', 'Expiry', control('expiry', {
                            autocomplete: 'cc-exp',
                            inputmode: 'numeric',
                            oninput: (e: Event) => {
                                // A first digit of 2 to 9 can only be a single digit month.
                                set('expiry', reformat(e.currentTarget as HTMLInputElement, 4, expiry, (d) => /^[2-9]/.test(d) ? `0${d}`.slice(0, 4) : d));
                            },
                            onkeydown: skip,
                            placeholder: 'MM/YY'
                        }))}
                        ${shell('cvc', 'CVC', control('cvc', {
                            autocomplete: 'cc-csc',
                            inputmode: 'numeric',
                            oninput: (e: Event) => {
                                set('cvc', reformat(e.currentTarget as HTMLInputElement, BRANDS[brand()].cvc, (d) => d));
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

                <div class='cc-actions'>
                    <button
                        class='button button--feedback cc-submit'
                        type='submit'
                        ${this?.attributes?.[CC_SUBMIT]}
                        ${attributes[CC_SUBMIT]}
                    >
                        ${faces(() => local.confirmed ? 'valid' : 'idle', [
                            { content: submit, key: 'idle' },
                            { content: 'Details look valid', icon: checkmark, key: 'valid' }
                        ])}
                    </button>
                    ${note ? html`
                        <p class='cc-note'>
                            <svg aria-hidden='true'><use href='#${lock}' /></svg>
                            ${note}
                        </p>
                    ` : ''}
                    <span aria-live='polite' class='button-status' role='status'>${() => local.confirmed ? 'Card details look valid' : ''}</span>
                    <span aria-live='polite' class='cc-live'>${() => brand() === 'unknown' ? '' : `${BRANDS[brand()].name} card`}</span>
                </div>
            </form>
        `;
    },
    { field: CC_FIELD, submit: CC_SUBMIT }
);
