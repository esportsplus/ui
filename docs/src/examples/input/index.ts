import { command, field, form, icon, input, select } from '@esportsplus/ui/components';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { moreFieldVariations } from 'docs/examples/form-options';
import alert from '@esportsplus/ui/svg/circle-alert.svg';
import check from '@esportsplus/ui/svg/circle-check.svg';
import help from '@esportsplus/ui/svg/help.svg';
import user from '@esportsplus/ui/svg/user.svg';
import type { Tab } from '@esportsplus/ui/components/command';


const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const NON_DIGITS = /\D/g;

const TAG_HINT = 'Press Enter or comma to add. Backspace twice removes the last tag.';


let angle = html`
    <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
        <path d='M3 3v10h10' />
        <path d='M3 7.5a5.5 5.5 0 0 1 5.5 5.5' />
    </svg>
`,
    countries = { de: '+49', fr: '+33', jp: '+81', us: '+1' },
    instance = 0,
    modifiers = [
        ['', 'Default'],
        ['input--surface', 'Surface'],
        ['input--surface-primary', 'Surface Primary']
    ],
    stack = 'display: flex; flex-direction: column; gap: var(--size-500); width: min(100%, 320px);';


function code({ disabled, group, invalid, length = 6, value = '' }: { disabled?: boolean, group?: number, invalid?: boolean, length?: number, value?: string } = {}) {
    let id = `input-otp-${++instance}`,
        state = reactive({ value });

    return html`
        <div class='field ${invalid && 'field--invalid'}'>
            <span class='field-label' id='${id}'>Verification code</span>
            ${input.otp({ 'aria-labelledby': id, disabled, group, invalid, length, state })}
            <small class='field-description'>
                ${() => state.value.length === length ? `Complete · ${state.value}` : `Value · "${state.value}"`}
            </small>
        </div>
    `;
}

function compact() {
    return html`
        <div style='${stack}'>
            ${modifiers.map(([modifier]) => control(`${modifier} input--compact`.trim()))}
        </div>
    `;
}

function control(modifier: string, id?: string) {
    return field.tag({}, html`
        ${icon({ 'aria-hidden': 'true', class: 'field-tag-item' }, user)}
        ${input({
            'aria-describedby': id && `${id}-description`,
            'aria-label': id ? undefined : 'Email',
            class: modifier,
            id,
            placeholder: 'Enter your email',
            required: true,
            type: 'email'
        })}
        ${icon({ 'aria-hidden': 'true', class: 'field-tag-item' }, help)}
    `);
}

function fields() {
    return html`
        <div style='${stack}'>
            ${modifiers.map(([modifier, label]) => {
                let id = `input-default-${++instance}`;

                return html`
                    <div class='field'>
                        <label class='field-label' for='${id}'>
                            ${label}
                            <span aria-hidden='true' class='field-label-required'>*</span>
                        </label>
                        ${control(modifier, id)}
                        <small class='field-description' id='${`${id}-description`}'>This is a hint about this input.</small>
                    </div>
                `;
            })}
        </div>
    `;
}

function format(value: string) {
    let digits = value.replace(NON_DIGITS, '').slice(0, 10);

    if (digits.length < 4) {
        return digits;
    }

    if (digits.length < 7) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }

    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function password(toggle: 'click' | 'hover', strength = false) {
    let id = `input-password-${++instance}`;

    return html`
        <div class='field' style='width: min(100%, 320px);'>
            <label class='field-label' for='${id}'>Password</label>
            ${input.password({ id, placeholder: strength ? 'Create a password' : 'Enter your password', strength, toggle })}
        </div>
    `;
}

function validate(value: string) {
    if (!value.trim()) {
        return 'Enter an email address.';
    }

    if (!EMAIL.test(value.trim())) {
        return 'That does not look like an email address.';
    }

    return '';
}


export default {
    name: 'input',
    variants: [
        {
            render: () => fields(),
            title: 'default'
        },
        {
            render: () => compact(),
            title: 'compact'
        },
        {
            render: () => {
                let id = `input-phone-${++instance}`;

                return html`
                    <div class='field' style='width: min(100%, 320px);'>
                        <label class='field-label' for='${id}'>Phone number</label>
                        ${field.tag({}, html`
                            <div class='field-tag-item'>
                                ${select({ label: 'Country code', options: countries, selected: 'us', style: '--height: 28px; --width: max-content;' })}
                            </div>
                            ${input({
                                autocomplete: 'tel-national',
                                id,
                                inputmode: 'tel',
                                oninput: (e: Event) => {
                                    let target = e.currentTarget as HTMLInputElement;

                                    target.value = format(target.value);
                                },
                                placeholder: '(123) 000-0000',
                                type: 'tel'
                            })}
                        `)}
                    </div>
                `;
            },
            title: 'phone number'
        },
        {
            render: () => code(),
            title: 'otp'
        },
        {
            render: () => code({ length: 4 }),
            title: 'otp · four digit PIN'
        },
        {
            render: () => code({ group: 3 }),
            title: 'otp · grouped (000 000)'
        },
        {
            render: () => code({ invalid: true, value: '204915' }),
            title: 'otp · invalid'
        },
        {
            render: () => code({ disabled: true, length: 4, value: '1234' }),
            title: 'otp · disabled'
        },
        {
            render: () => {
                let id = `input-validation-${++instance}`,
                    state = reactive({ error: '', touched: false, valid: false }),
                    timer: ReturnType<typeof setTimeout> | undefined;

                // Clearing an error is immediate; showing one waits for the typist to pause.
                function verify(value: string) {
                    let error = validate(value);

                    clearTimeout(timer);
                    state.valid = !error;

                    if (!error) {
                        state.error = '';
                    }
                    else {
                        timer = setTimeout(() => state.error = error, 400);
                    }
                }

                return html`
                    <div class='field ${() => state.error && 'field--invalid'}' style='width: min(100%, 320px);'>
                        <label class='field-label' for='${id}'>Email</label>
                        ${field.tag({}, html`
                            ${input({
                                'aria-describedby': `${id}-description`,
                                'aria-invalid': () => state.error ? 'true' : 'false',
                                autocomplete: 'email',
                                id,
                                onblur: (e: Event) => {
                                    state.touched = true;
                                    verify((e.currentTarget as HTMLInputElement).value);
                                },
                                oninput: (e: Event) => {
                                    if (state.touched) {
                                        verify((e.currentTarget as HTMLInputElement).value);
                                    }
                                },
                                placeholder: 'you@example.com',
                                type: 'email'
                            })}
                            <span
                                aria-hidden='true'
                                class='field-tag-item'
                                style='${() => !state.error && !state.valid && 'visibility: hidden;'}'
                            >
                                ${() => state.error
                                    ? icon({ style: '--color: var(--color-red-400);' }, alert)
                                    : icon({ style: '--color: var(--color-green-400);' }, check)}
                            </span>
                        `)}
                        <small aria-live='polite' class='field-description' id='${`${id}-description`}'>
                            ${() => state.error || 'We only use this for sign-in links.'}
                        </small>
                    </div>
                `;
            },
            title: 'inline validation'
        },
        {
            render: () => password('click'),
            title: 'password · click to reveal'
        },
        {
            render: () => password('hover'),
            title: 'password · hover to reveal'
        },
        {
            render: () => password('click', true),
            title: 'password strength'
        },
        {
            render: () => html`
                <div style='${stack}'>
                    ${input.search({ kbd: ['Mod', 'K'], placeholder: 'Search documentation…' })}
                    ${input.search({ class: 'input--compact', kbd: ['/'] })}
                </div>
            `,
            title: 'search · shortcut'
        },
        {
            render: () => {
                let result = reactive({ query: '' });

                return html`
                    <div class='field' style='width: min(100%, 320px);'>
                        ${input.search({
                            oninput: (e: Event) => {
                                result.query = (e.currentTarget as HTMLInputElement).value;
                            }
                        })}
                        <small class='field-description'>${() => `Query: ${result.query || '—'}`}</small>
                    </div>
                `;
            },
            title: 'search · observed query'
        },
        {
            render: () => {
                let result = reactive({ ran: '' }),
                    state = reactive({ active: false, index: -1, query: '', tab: 'all' as Tab });

                function open() {
                    state.active = true;
                }

                return html`
                    <div class='field' style='width: min(100%, 320px);'>
                        ${input.search({
                            'aria-haspopup': 'dialog',
                            class: 'input--tactile',
                            onclick: open,
                            onkeydown: (e: KeyboardEvent) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    open();
                                }
                            },
                            placeholder: 'Search commands…',
                            readonly: true,
                            style: 'cursor: pointer;'
                        })}
                        <small class='field-description'>${() => `Ran: ${result.ran || '—'}`}</small>
                        ${command({
                            commands: [
                                { group: 'File', id: 'new', label: 'New file' },
                                { group: 'File', id: 'open', label: 'Open file' },
                                { group: 'View', id: 'theme', label: 'Toggle theme' }
                            ],
                            onrun: (entry) => {
                                result.ran = entry.label;
                            },
                            state,
                            trigger: false
                        })}
                    </div>
                `;
            },
            title: 'search · opens a dialog on click'
        },
        ...moreFieldVariations('input'),
        {
            render: () => {
                let result = reactive({ submitted: '' });

                return form.action({
                    action: ({ input }: { input: { topics?: string[] } }) => {
                        result.submitted = (input.topics ?? []).join(', ') || '—';

                        return { errors: [] };
                    }
                }, html`
                    <div class='field' style='align-items: flex-start; width: min(100%, 440px);'>
                        ${input.tag({ hint: TAG_HINT, label: 'Topics', name: 'topics', tags: ['motion', 'design', 'react'] })}
                        <button class='button button--primary' type='submit'>Submit</button>
                        <small class='field-description'>${() => result.submitted && `Submitted: ${result.submitted}`}</small>
                    </div>
                `);
            },
            title: 'tag · topics'
        },
        {
            render: () => {
                let state = reactive({ active: false, error: '', tags: [] as string[] });

                return html`
                    <div class='field' style='width: min(100%, 440px);'>
                        ${input.tag({ hint: 'Paste a comma or newline separated list to add many at once.', label: 'Recipients', placeholder: 'name@example.com', state })}
                        <small class='field-description'>${() => `${state.tags.length} added: ${state.tags.join(', ') || '—'}`}</small>
                    </div>
                `;
            },
            title: 'tag · paste + observed state'
        },
        {
            render: () => html`
                <div class='field' style='width: min(100%, 440px);'>
                    ${input.tag({ hint: 'Drag a tag to reorder it.', label: 'Priorities', sortable: true, tags: ['speed', 'safety', 'cost', 'comfort'] })}
                </div>
            `,
            title: 'tag · sortable'
        },
        {
            render: () => html`
                <div class='field' style='width: min(100%, 440px);'>
                    ${input.tag({ label: 'Topics', tags: ['motion', 'design'], variant: 'surface' })}
                </div>
            `,
            title: 'tag · surface'
        },
        {
            render: () => html`
                <div class='field' style='width: min(100%, 440px);'>
                    ${input.tag({ label: 'Topics', tags: ['motion', 'design'], variant: 'surface-primary' })}
                </div>
            `,
            title: 'tag · surface primary'
        },
        {
            render: () => html`
                <div class='field' style='width: min(100%, 380px);'>
                    <span class='field-label'>Transform</span>
                    <div class='grid' style='--min-width: 140px;'>
                        ${input.scrub({ label: 'X position', value: 120 }, 'X')}
                        ${input.scrub({ label: 'Y position', value: 48 }, 'Y')}
                        ${input.scrub({ label: 'Rotation', max: 180, min: -180, suffix: '°' }, angle)}
                    </div>
                    <small class='field-description'>Drag the letter or the track under each field.</small>
                </div>
            `,
            title: 'scrub · transform'
        },
        {
            render: () => {
                let opacity = reactive({ active: false, error: '', value: 80 }),
                    scale = reactive({ active: false, error: '', value: 1 });

                return html`
                    <div class='field' style='width: min(100%, 380px);'>
                        <span class='field-label'>Layer</span>
                        <div class='grid' style='--min-width: 140px;'>
                            ${input.scrub({ label: 'Opacity', max: 100, min: 0, pixelsPerStep: 2, precision: 0, state: opacity, suffix: '%' }, 'O')}
                            ${input.scrub({ label: 'Scale', max: 4, min: 0.1, pixelsPerStep: 4, state: scale, step: 0.01 }, 'S')}
                        </div>
                        <div class='card' style='align-items: center; display: flex; height: 120px; justify-content: center;'>
                            <div style=${() => `background: var(--color-blue-400); border-radius: var(--border-radius-600); height: 48px; opacity: ${opacity.value / 100}; scale: ${scale.value}; width: 48px;`}></div>
                        </div>
                    </div>
                `;
            },
            title: 'scrub · bounded + observed state'
        },
        {
            render: () => html`
                <div class='field' style='width: min(100%, 380px);'>
                    <div class='grid' style='--min-width: 140px;'>
                        ${input.scrub({ label: 'Width', lockPointer: true, min: 0, suffix: 'px', value: 1280 }, 'W')}
                        ${input.scrub({ label: 'Height', lockPointer: true, min: 0, suffix: 'px', value: 720 }, 'H')}
                    </div>
                    <small class='field-description'>Pointer lock: scrub past the screen edge. Shift for ×10, Alt for ×0.1.</small>
                </div>
            `,
            title: 'scrub · pointer lock'
        }
    ]
};
