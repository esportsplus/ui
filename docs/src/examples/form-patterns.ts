import { input } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Variant } from '../types';
import './form-patterns.scss';

// Original previews recreating the behavior of these references, without copied source:
// https://www.interior.dev/docs/floating-label
// https://www.interior.dev/docs/inline-validation
// https://www.interior.dev/docs/password-strength
// https://www.interior.dev/docs/otp-input
// https://www.interior.dev/docs/tag-input
let instance = 0;


const COMMON_PASSWORDS = ['123456', '12345678', 'abc123', 'admin', 'letmein', 'password', 'password1', 'qwerty', 'welcome'];

const OTP_CODE = '424242';

const PASSWORD_LABELS = ['Empty', 'Weak', 'Fair', 'Good', 'Strong'];

const PASSWORD_RULES: [string, (value: string) => boolean][] = [
    ['12 characters or more', (value) => value.length >= 12],
    ['Upper and lower case', (value) => /[a-z]/.test(value) && /[A-Z]/.test(value)],
    ['A number', (value) => /\d/.test(value)],
    ['A symbol', (value) => /[^a-zA-Z\d\s]/.test(value)]
];

const TAG_SEPARATORS = /[,;]/;


function guessable(value: string) {
    let lower = value.toLowerCase();

    if (COMMON_PASSWORDS.includes(lower) || /(.)\1{2,}/.test(value)) {
        return true;
    }

    // Three or more consecutive ascending characters, e.g. "abc" or "123"
    for (let i = 2, n = lower.length; i < n; i++) {
        let a = lower.charCodeAt(i - 2),
            b = lower.charCodeAt(i - 1),
            c = lower.charCodeAt(i);

        if (b - a === 1 && c - b === 1 && /[a-z\d]/.test(lower[i])) {
            return true;
        }
    }

    return false;
}

function validateEmail(value: string) {
    if (!value.trim()) {
        return 'Enter an email address.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())) {
        return 'That does not look like an email address.';
    }

    return null;
}


const floatingLabel = (): Variant => ({
    render: () => {
        let id = `field-pattern-${++instance}`,
            max = 32,
            state = reactive({ length: 0 });

        return html`
            <div class='form-prototype field-pattern floating-pattern'>
                <div class='field-pattern-surface'>
                    ${input.call({}, {
                        'aria-describedby': `${id}-hint`,
                        id,
                        maxlength: max,
                        placeholder: ' ',
                        required: true,
                        oninput: (event: Event) => {
                            state.length = (event.target as HTMLInputElement).value.length;
                        }
                    })}
                    <label for='${id}'>Display name <span aria-hidden='true'>*</span></label>
                </div>
                <div class='field-pattern-footer'>
                    <small id='${`${id}-hint`}'>Shown on your public profile.</small>
                    <output for='${id}' style='${`--digits: ${String(max).length * 2 + 3}ch;`}'>${() => state.length} / ${max}</output>
                </div>
            </div>
        `;
    },
    title: 'Floating label · Rises above the field'
});

const inlineValidation = (): Variant => ({
    render: () => {
        let id = `field-pattern-${++instance}`,
            state = reactive({ error: '', touched: false, valid: false }),
            timer: ReturnType<typeof setTimeout> | undefined;

        function check(value: string) {
            let error = validateEmail(value);

            clearTimeout(timer);
            state.valid = !error;

            // Clearing is immediate, showing an error waits for the user to pause
            if (!error) {
                state.error = '';
            }
            else {
                timer = setTimeout(() => state.error = error, 400);
            }
        }

        return html`
            <div class='${() => `form-prototype field-pattern validation-pattern ${state.error ? '--invalid' : ''} ${state.valid ? '--valid' : ''}`}'>
                <label for='${id}'>Email</label>
                <div class='field-pattern-surface'>
                    ${input.call({}, {
                        'aria-describedby': `${id}-message`,
                        'aria-invalid': () => state.error ? 'true' : 'false',
                        autocomplete: 'email',
                        id,
                        placeholder: 'you@example.com',
                        type: 'email',
                        onblur: (event: Event) => {
                            state.touched = true;
                            check((event.target as HTMLInputElement).value);
                        },
                        oninput: (event: Event) => {
                            if (state.touched) {
                                check((event.target as HTMLInputElement).value);
                            }
                        }
                    })}
                    <span class='validation-pattern-icon' aria-hidden='true'>
                        <svg class='validation-pattern-check' viewBox='0 0 16 16'><path d='M3.5 8.5l3 3 6-7' /></svg>
                        <span class='validation-pattern-alert'>!</span>
                    </span>
                </div>
                <div class='validation-pattern-message' id='${`${id}-message`}' aria-live='polite'>
                    <small class='validation-pattern-hint'>We only use this for sign-in links.</small>
                    <small class='validation-pattern-error'>${() => state.error}</small>
                </div>
            </div>
        `;
    },
    title: 'Inline validation · Checks on blur'
});

const otp = (): Variant => ({
    render: () => {
        let id = `field-pattern-${++instance}`,
            length = OTP_CODE.length,
            state = reactive({ status: 'idle' as 'error' | 'idle' | 'success' });

        function cells(from: Element) {
            return [...from.closest('.otp-pattern-cells')!.querySelectorAll<HTMLInputElement>('input')];
        }

        function complete(all: HTMLInputElement[]) {
            let code = all.map((cell) => cell.value).join('');

            if (code.length < length) {
                return;
            }

            if (code === OTP_CODE) {
                state.status = 'success';
                all[length - 1].blur();
                return;
            }

            for (let i = 0, n = all.length; i < n; i++) {
                all[i].value = '';
            }

            state.status = 'error';
            all[0].focus();

            if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
                all[0].closest('.otp-pattern-cells')!.animate(
                    [0, -5, 4, -3, 0].map((x) => ({ transform: `translateX(${x}px)` })),
                    { duration: 320, easing: 'ease-out' }
                );
            }
        }

        function fill(cell: HTMLInputElement, text: string) {
            let all = cells(cell),
                start = all.indexOf(cell),
                characters = text.replace(/\D/g, '').slice(0, length - start).split('');

            if (!characters.length) {
                return;
            }

            for (let i = 0, n = characters.length; i < n; i++) {
                all[start + i].value = characters[i];
            }

            all[Math.min(start + characters.length, length - 1)].focus();
            state.status = 'idle';
            complete(all);
        }

        function onkeydown(event: KeyboardEvent) {
            let cell = event.target as HTMLInputElement,
                all = cells(cell),
                index = all.indexOf(cell),
                target: number | undefined;

            switch (event.key) {
                case 'ArrowLeft':
                    target = index - 1;
                    break;
                case 'ArrowRight':
                    target = index + 1;
                    break;
                case 'Backspace':
                    if (cell.value) {
                        cell.value = '';
                    }
                    else if (index > 0) {
                        all[index - 1].value = '';
                        target = index - 1;
                    }

                    state.status = 'idle';
                    break;
                case 'Delete':
                    cell.value = '';
                    state.status = 'idle';
                    break;
                case 'End':
                    target = length - 1;
                    break;
                case 'Home':
                    target = 0;
                    break;
                default:
                    return;
            }

            event.preventDefault();

            if (target !== undefined && all[target]) {
                all[target].focus();
                all[target].select();
            }
        }

        return html`
            <div class='${() => `form-prototype field-pattern otp-pattern --${state.status}`}'>
                <label for='${`${id}-0`}'>Verification code</label>
                <div class='otp-pattern-cells' role='group' aria-describedby='${`${id}-message`}'>
                    ${Array.from({ length }, (_, index) => html`
                        ${index > 0 && index % 3 === 0 && html`<span class='otp-pattern-separator' aria-hidden='true'></span>`}
                        <span class='otp-pattern-cell'>
                            <input
                                aria-label='${`Digit ${index + 1} of ${length}`}'
                                autocomplete='${index === 0 ? 'one-time-code' : 'off'}'
                                id='${`${id}-${index}`}'
                                inputmode='numeric'
                                placeholder=' '
                                onfocus='${(event: Event) => (event.target as HTMLInputElement).select()}'
                                oninput='${(event: InputEvent) => {
                                    let cell = event.target as HTMLInputElement,
                                        text = event.inputType === 'insertText' ? event.data ?? '' : cell.value;

                                    cell.value = '';
                                    fill(cell, text);
                                }}'
                                onkeydown='${onkeydown}'
                                onpaste='${(event: ClipboardEvent) => {
                                    event.preventDefault();
                                    fill(event.target as HTMLInputElement, event.clipboardData?.getData('text') ?? '');
                                }}'
                            />
                            <span class='otp-pattern-caret' aria-hidden='true'></span>
                        </span>
                    `)}
                </div>
                <small class='otp-pattern-message' id='${`${id}-message`}' aria-live='polite'>
                    ${() => state.status === 'error'
                        ? 'That code did not match. Try again.'
                        : state.status === 'success'
                            ? 'Verified.'
                            : `Paste or type the code. Try ${OTP_CODE}.`}
                </small>
            </div>
        `;
    },
    title: 'OTP · Six grouped cells'
});

const passwordStrength = (): Variant => ({
    render: () => {
        let id = `field-pattern-${++instance}`,
            state = reactive({ value: '' });

        function score() {
            let value = state.value;

            if (!value) {
                return 0;
            }

            if (guessable(value)) {
                return 1;
            }

            return Math.max(1, PASSWORD_RULES.filter(([, test]) => test(value)).length);
        }

        function tone() {
            let s = score();

            return s === 0 ? 'none' : s === 1 ? 'danger' : s < PASSWORD_RULES.length ? 'caution' : 'safe';
        }

        return html`
            <div class='${() => `form-prototype field-pattern strength-pattern --${tone()}`}'>
                <label for='${id}'>Password</label>
                <div class='field-pattern-surface'>
                    ${input.call({}, {
                        'aria-describedby': `${id}-strength`,
                        autocomplete: 'new-password',
                        id,
                        placeholder: 'Create a password',
                        type: 'password',
                        oninput: (event: Event) => {
                            state.value = (event.target as HTMLInputElement).value;
                        }
                    })}
                </div>
                <div class='strength-pattern-meter' aria-hidden='true'>
                    ${PASSWORD_RULES.map((_, index) => html`
                        <span class='${() => `strength-pattern-segment ${index < score() ? '--filled' : ''}`}' style='${`--index: ${index};`}'></span>
                    `)}
                </div>
                <div class='strength-pattern-status' id='${`${id}-strength`}' aria-live='polite'>
                    <span>${() => PASSWORD_LABELS[score()]}</span>
                    ${() => state.value && guessable(state.value) && html`<span class='strength-pattern-badge'>Commonly guessed</span>`}
                </div>
                <ul class='strength-pattern-rules'>
                    ${PASSWORD_RULES.map(([label, test]) => html`
                        <li class='${() => test(state.value) ? '--met' : ''}'>
                            <span class='strength-pattern-check' aria-hidden='true'>
                                <svg viewBox='0 0 16 16'><path d='M3.5 8.5l3 3 6-7' /></svg>
                            </span>
                            ${label}
                        </li>
                    `)}
                </ul>
            </div>
        `;
    },
    title: 'Password strength · Segmented meter'
});

const tags = (): Variant => ({
    render: () => {
        let id = `field-pattern-${++instance}`,
            list = reactive([{ value: 'design' }, { value: 'motion' }] as { value: string }[]),
            max = 8,
            state = reactive({ armed: '', duplicate: '', message: '' }),
            timer: ReturnType<typeof setTimeout> | undefined;

        function commit(text: string) {
            let value = text.trim().replace(/\s+/g, ' ');

            if (!value) {
                return true;
            }

            if (value.length > 24) {
                state.message = `"${value.slice(0, 24)}…" is not allowed here, keep it under 24 characters`;
                return false;
            }

            if (list.some((tag) => tag.value.toLowerCase() === value.toLowerCase())) {
                clearTimeout(timer);
                state.duplicate = value.toLowerCase();
                state.message = `${value} is already in the list`;
                timer = setTimeout(() => state.duplicate = '', 700);
                return false;
            }

            if (list.length >= max) {
                state.message = `That is the limit of ${max} tags`;
                return false;
            }

            list.push({ value });
            state.message = '';

            return true;
        }

        function onkeydown(event: KeyboardEvent) {
            let draft = event.target as HTMLInputElement,
                index = list.findIndex((tag) => tag.value === state.armed);

            if (event.key === 'Enter' || TAG_SEPARATORS.test(event.key)) {
                event.preventDefault();

                if (commit(draft.value)) {
                    draft.value = '';
                }

                return;
            }

            if (draft.value) {
                state.armed = '';
                return;
            }

            switch (event.key) {
                case 'ArrowLeft':
                    if (list.length) {
                        state.armed = list[index === -1 ? list.length - 1 : Math.max(index - 1, 0)].value;
                    }

                    break;
                case 'ArrowRight':
                    state.armed = index === -1 || index === list.length - 1 ? '' : list[index + 1].value;
                    break;
                case 'Backspace':
                    // First press arms the last tag, second press removes it
                    if (state.armed) {
                        remove(state.armed);
                    }
                    else if (list.length) {
                        state.armed = list[list.length - 1].value;
                    }

                    break;
                case 'Delete':
                    if (state.armed) {
                        remove(state.armed);
                    }

                    break;
                case 'Escape':
                    state.armed = '';
                    break;
                default:
                    return;
            }

            event.preventDefault();
        }

        function remove(value: string) {
            let index = list.findIndex((tag) => tag.value === value);

            if (index !== -1) {
                list.splice(index, 1);
            }

            state.armed = '';
            state.message = '';
        }

        return html`
            <div class='form-prototype field-pattern tag-pattern'>
                <div class='field-pattern-heading'>
                    <label for='${id}'>Topics</label>
                    <output for='${id}'>${() => list.length} / ${max}</output>
                </div>
                <div class='field-pattern-surface tag-pattern-surface' onclick='${(event: MouseEvent) => {
                    (event.currentTarget as HTMLElement).querySelector<HTMLInputElement>('.tag-pattern-draft')?.focus();
                }}'>
                    ${html.reactive(list, (tag) => html`
                        <span class='${() => `tag-pattern-chip ${state.armed === tag.value ? '--armed' : ''} ${state.duplicate === tag.value.toLowerCase() ? '--duplicate' : ''}`}'>
                            <span class='tag-pattern-label'>${tag.value}</span>
                            <button
                                aria-label='${`Remove ${tag.value}`}'
                                class='tag-pattern-remove'
                                type='button'
                                onclick='${(event: MouseEvent) => {
                                    event.stopPropagation();
                                    remove(tag.value);
                                }}'
                            >
                                <svg viewBox='0 0 16 16' aria-hidden='true'><path d='M4.5 4.5l7 7m0-7l-7 7' /></svg>
                            </button>
                        </span>
                    `)}
                    <input
                        aria-describedby='${`${id}-message`}'
                        class='tag-pattern-draft'
                        id='${id}'
                        placeholder='Add a tag'
                        onblur='${() => state.armed = ''}'
                        oninput='${() => state.message = ''}'
                        onkeydown='${onkeydown}'
                        onpaste='${(event: ClipboardEvent) => {
                            let text = event.clipboardData?.getData('text') ?? '';

                            if (!TAG_SEPARATORS.test(text)) {
                                return;
                            }

                            event.preventDefault();

                            for (let part of text.split(TAG_SEPARATORS)) {
                                commit(part);
                            }
                        }}'
                    />
                </div>
                <div class='${() => `tag-pattern-message ${state.message ? '--rejected' : ''}`}' id='${`${id}-message`}' aria-live='polite'>
                    <small class='tag-pattern-hint'>Enter adds · Backspace removes</small>
                    <small class='tag-pattern-rejection'>${() => state.message}</small>
                </div>
            </div>
        `;
    },
    title: 'Tag input · Enter, comma or paste'
});

const inputPatternVariations = (): Variant[] => [floatingLabel(), inlineValidation(), passwordStrength(), otp(), tags()];


export { inputPatternVariations };
