import { input, textarea } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Variant } from '../types';
import './board-fields.scss';


type Field = {
    disabled?: boolean;
    invalid?: boolean;
    size?: 'medium' | 'small';
    value?: string;
};

type Otp = {
    disabled?: boolean;
    group?: number;
    invalid?: boolean;
    length?: number;
    value?: string;
};

type Notes = {
    autoresize?: boolean;
    count?: boolean;
    disabled?: boolean;
    hint: string;
    invalid?: boolean;
    label: string;
    placeholder: string;
    required?: boolean;
    rows?: number;
    size?: 'medium' | 'small';
    value?: string;
};


const COUNTRIES = [
    { code: 'us', dial: '+1', name: 'United States' },
    { code: 'fr', dial: '+33', name: 'France' },
    { code: 'de', dial: '+49', name: 'Germany' },
    { code: 'jp', dial: '+81', name: 'Japan' }
];

const HINT = 'This is a hint about this input.';

const ICONS = {
    chevron: () => html`<svg class='board-icon board-icon--chevron' viewBox='0 0 24 24' aria-hidden='true'><path d='m6 9 6 6 6-6' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2'/></svg>`,
    help: () => html`<svg class='board-icon' viewBox='0 0 24 24' aria-hidden='true'><g fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='1.75'><circle cx='12' cy='12' r='9'/><path d='M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.4'/></g><circle cx='12' cy='17' r='1.1' fill='currentColor'/></svg>`,
    info: () => html`<svg class='board-icon board-icon--info' viewBox='0 0 24 24' aria-hidden='true'><path d='M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm-1-11v6h2v-6h-2Zm0-4v2h2V7h-2Z' fill='currentColor'/></svg>`,
    mail: () => html`<svg class='board-icon' viewBox='0 0 24 24' aria-hidden='true'><g fill='none' stroke='currentColor' stroke-linejoin='round' stroke-width='1.75'><rect x='3' y='5' width='18' height='14' rx='2'/><path d='m3.5 6 8.5 7 8.5-7'/></g></svg>`,
    search: () => html`<svg class='board-icon' viewBox='0 0 24 24' aria-hidden='true'><g fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='1.75'><circle cx='11' cy='11' r='7'/><path d='m20 20-3.5-3.5'/></g></svg>`,
    smile: () => html`<svg class='board-icon' viewBox='0 0 24 24' aria-hidden='true'><g fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='1.75'><circle cx='12' cy='12' r='9'/><path d='M8.5 14a4 4 0 0 0 7 0'/></g><circle cx='9' cy='9.75' r='1.1' fill='currentColor'/><circle cx='15' cy='9.75' r='1.1' fill='currentColor'/></svg>`
};


let instance = 0;


function boxes(target: HTMLInputElement) {
    return Array.from(target.closest('.board-otp-boxes')!.querySelectorAll<HTMLInputElement>('input'));
}

function code(target: HTMLInputElement) {
    return boxes(target).map((box) => box.value).join('');
}

function field({ disabled, invalid, size = 'medium', value }: Field = {}) {
    let id = `board-input-${++instance}`;

    return html`
        <div class='board-input board-input--${size} ${invalid && 'board-input--invalid'} ${disabled && 'board-input--disabled'}'>
            ${label(id, 'Email')}
            <div class='board-input-field'>
                ${ICONS.smile()}
                ${input.call({}, {
                    'aria-describedby': `${id}-hint`,
                    'aria-invalid': invalid ? 'true' : undefined,
                    disabled,
                    id,
                    placeholder: 'Enter your email',
                    required: true,
                    type: 'email',
                    value
                })}
                ${ICONS.help()}
            </div>
            <small id='${id}-hint'>${HINT}</small>
        </div>
    `;
}

function focus(target: HTMLInputElement, index: number) {
    let list = boxes(target),
        box = list[Math.max(0, Math.min(index, list.length - 1))];

    box.focus();
    box.select();
}

function label(id: string, text: string, required = true, info = true) {
    return html`
        <label class='board-input-label' for='${id}'>
            ${text}${required && html`<span aria-hidden='true'>*</span>`}${info && ICONS.info()}
        </label>
    `;
}

function notes({ autoresize, count, disabled, hint, invalid, label: text, placeholder, required, rows = 3, size = 'medium', value = '' }: Notes) {
    let id = `board-input-${++instance}`,
        state = reactive({ length: value.length });

    return html`
        <div class='board-input board-input--${size} board-input--textarea ${invalid && 'board-input--invalid'} ${disabled && 'board-input--disabled'}'>
            ${label(id, text, !!required, !!required)}
            <div class='board-input-field'>
                ${textarea.call({}, {
                    'aria-describedby': `${id}-hint`,
                    'aria-invalid': invalid ? 'true' : undefined,
                    autoresize: autoresize ? { height: { max: '160px', min: '20px' } } : undefined,
                    disabled,
                    id,
                    maxlength: count ? 160 : undefined,
                    oninput: (event: Event) => {
                        state.length = (event.target as HTMLTextAreaElement).value.length;
                    },
                    placeholder,
                    required,
                    rows: autoresize ? 1 : rows,
                    value
                })}
            </div>
            <div class='board-input-hint'>
                <small id='${id}-hint'>${hint}</small>
                ${count && html`<small class='board-input-count'>${() => state.length}/160</small>`}
            </div>
        </div>
    `;
}

function otp({ disabled, group, invalid, length = 6, value = '' }: Otp = {}) {
    let state = reactive({ code: value, status: '' }),
        sync = (target: HTMLInputElement) => {
            state.code = code(target);
            state.status = state.code.length === length ? `Complete · ${state.code}` : '';
        },
        write = (target: HTMLInputElement, index: number, digits: string) => {
            let clean = digits.replace(/\D/g, ''),
                list = boxes(target);

            if (!clean) {
                return;
            }

            for (let i = 0, n = Math.min(clean.length, list.length - index); i < n; i++) {
                list[index + i].value = clean[i];
            }

            sync(target);
            focus(target, index + clean.length);
        };

    return html`
        <div class='board-otp ${invalid && 'board-otp--invalid'}'>
            <div class='board-otp-boxes' role='group' aria-label='Verification code'>
                ${Array.from({ length }, (_, index) => html`
                    <span class='board-otp-box ${group && index > 0 && index % group === 0 && 'board-otp-box--gap'}'>
                        ${input.call({}, {
                            'aria-invalid': invalid ? 'true' : undefined,
                            'aria-label': `Digit ${index + 1} of ${length}`,
                            autocomplete: 'one-time-code',
                            disabled,
                            inputmode: 'numeric',
                            maxlength: length,
                            onclick: (event: MouseEvent) => (event.target as HTMLInputElement).select(),
                            oninput: (event: Event) => {
                                let target = event.target as HTMLInputElement,
                                    digits = target.value.replace(/\D/g, '');

                                target.value = '';

                                if (digits) {
                                    write(target, index, digits);
                                }
                                else {
                                    sync(target);
                                }
                            },
                            onkeydown: (event: KeyboardEvent) => {
                                let target = event.target as HTMLInputElement;

                                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                                    event.preventDefault();
                                    focus(target, index + (event.key === 'ArrowLeft' ? -1 : 1));
                                }
                                else if (event.key === 'Backspace') {
                                    event.preventDefault();

                                    if (target.value) {
                                        target.value = '';
                                    }
                                    else if (index > 0) {
                                        boxes(target)[index - 1].value = '';
                                        focus(target, index - 1);
                                    }

                                    sync(target);
                                }
                                else if (/^\d$/.test(event.key) && !event.ctrlKey && !event.metaKey) {
                                    event.preventDefault();
                                    write(target, index, event.key);
                                }
                            },
                            onpaste: (event: ClipboardEvent) => {
                                event.preventDefault();
                                write(event.target as HTMLInputElement, index, event.clipboardData?.getData('text') ?? '');
                            },
                            type: 'text',
                            value: value[index] ?? ''
                        })}
                    </span>
                `)}
            </div>
            <small>${() => state.status || `Value · "${state.code}"`}</small>
        </div>
    `;
}

function phone(value = '') {
    let id = `board-input-${++instance}`,
        state = reactive({ country: 0 });

    return html`
        <div class='board-input board-input--medium board-input--phone'>
            ${label(id, 'Phone Number')}
            <div class='board-input-field'>
                <label class='board-input-country'>
                    <span class='${() => `board-flag board-flag--${COUNTRIES[state.country].code}`}' aria-hidden='true'></span>
                    <span>${() => COUNTRIES[state.country].dial}</span>
                    ${ICONS.chevron()}
                    <select aria-label='Country code' onchange='${(event: Event) => state.country = (event.target as HTMLSelectElement).selectedIndex}'>
                        ${COUNTRIES.map(({ dial, name }) => html`<option>${name} (${dial})</option>`)}
                    </select>
                </label>
                ${input.call({}, {
                    'aria-describedby': `${id}-hint`,
                    autocomplete: 'tel-national',
                    id,
                    inputmode: 'tel',
                    oninput: (event: Event) => {
                        let target = event.target as HTMLInputElement;

                        target.value = state.country === 0 ? format(target.value) : target.value.replace(/[^\d ]/g, '');
                    },
                    placeholder: '(123) 000-0000',
                    required: true,
                    type: 'tel',
                    value: format(value)
                })}
                ${ICONS.help()}
            </div>
            <small id='${id}-hint'>${HINT}</small>
        </div>
    `;
}

function format(value: string) {
    let digits = value.replace(/\D/g, '').slice(0, 10);

    if (digits.length < 4) {
        return digits;
    }

    if (digits.length < 7) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }

    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function quick(icon: keyof typeof ICONS, placeholder: string, type: string) {
    return html`
        <div class='board-input board-input--medium'>
            <div class='board-input-field'>
                ${ICONS[icon]()}
                ${input.call({}, { 'aria-label': placeholder, placeholder, type })}
            </div>
        </div>
    `;
}


const boardInputVariations = (): Variant[] => [
    {
        render: () => html`<div class='board-demo'>${field()}</div>`,
        title: 'Board · Label, icons and hint'
    },
    {
        render: () => html`<div class='board-demo'>${field({ size: 'medium' })}${field({ size: 'small' })}</div>`,
        title: 'Board · Sizes (medium, small)'
    },
    {
        render: () => html`
            <div class='board-demo board-demo--grid'>
                ${field()}
                ${field({ value: 'hello@example.com' })}
                ${field({ disabled: true })}
                ${field({ invalid: true, value: 'not-a-real-email' })}
            </div>
        `,
        title: 'Board · States (default, filled, disabled, invalid)'
    },
    {
        render: () => html`<div class='board-demo'>${phone()}${phone('4155550132')}</div>`,
        title: 'Board · Phone number with country code'
    },
    {
        render: () => html`<div class='board-demo board-demo--narrow'>${quick('mail', 'you@company.com', 'email')}${quick('search', 'Search', 'search')}</div>`,
        title: 'Board · Compact icon fields'
    }
];

const boardOtpVariations = (): Variant[] => [
    {
        render: () => html`<div class='board-demo'>${otp()}</div>`,
        title: 'Board OTP · Six digits'
    },
    {
        render: () => html`<div class='board-demo'>${otp({ length: 4 })}</div>`,
        title: 'Board OTP · Four digit PIN'
    },
    {
        render: () => html`<div class='board-demo'>${otp({ group: 3 })}</div>`,
        title: 'Board OTP · Grouped (000 000)'
    },
    {
        render: () => html`<div class='board-demo'>${otp({ invalid: true, value: '204915' })}</div>`,
        title: 'Board OTP · Invalid'
    },
    {
        render: () => html`<div class='board-demo'>${otp({ disabled: true, value: '1234' })}</div>`,
        title: 'Board OTP · Disabled'
    }
];

const boardTextareaVariations = (): Variant[] => {
    let letter = { hint: 'This is a hint about this field.', label: 'Cover letter', placeholder: 'Why are you a good fit?', required: true };

    return [
        {
            render: () => html`
                <div class='board-demo'>
                    ${notes({ hint: 'Markdown is supported.', label: 'Release notes', placeholder: 'What changed in this version?', required: true })}
                </div>
            `,
            title: 'Board · Label, hint and resize handle'
        },
        {
            render: () => html`
                <div class='board-demo'>
                    ${notes({ hint: 'Medium is the default, 14px type in a 8px shell.', label: 'Description', placeholder: 'Tell us about this workspace', rows: 2 })}
                    ${notes({ hint: 'Small tightens the horizontal inset to match a small input.', label: 'Description', placeholder: 'Tell us about this workspace', rows: 2, size: 'small' })}
                </div>
            `,
            title: 'Board · Sizes (medium, small)'
        },
        {
            render: () => html`
                <div class='board-demo'>
                    ${notes({ autoresize: true, hint: 'The field grows to eight lines, then scrolls.', label: 'Message', placeholder: 'Write as much as you need' })}
                </div>
            `,
            title: 'Board · Auto resize (1 to 8 lines)'
        },
        {
            render: () => html`
                <div class='board-demo'>
                    ${notes({ count: true, hint: 'Appears on your public profile.', label: 'Bio', placeholder: 'A sentence or two about you', value: 'Design engineer. I build dashboards for a living.' })}
                </div>
            `,
            title: 'Board · Character count'
        },
        {
            render: () => html`
                <div class='board-demo board-demo--grid'>
                    ${notes(letter)}
                    ${notes({ ...letter, value: 'I have shipped design systems for six years.' })}
                    ${notes({ ...letter, disabled: true })}
                    ${notes({ ...letter, hint: 'Please write at least 200 characters.', invalid: true, value: 'Too short.' })}
                </div>
            `,
            title: 'Board · States (default, filled, disabled, invalid)'
        }
    ];
};


export { boardInputVariations, boardOtpVariations, boardTextareaVariations };
