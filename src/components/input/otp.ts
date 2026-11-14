import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import input from './field';
import '~/components/group/scss/index.scss';


type A = Attributes & {
    disabled?: boolean;
    // Cells per group; the groups are spaced apart, e.g. 3 for '000 000'.
    group?: number;
    invalid?: boolean;
    length?: number;
    state?: State;
    value?: string;
    variant?: 'border' | 'surface' | 'surface-primary';
};

type State = {
    value: string;
};


const DIGIT = /^\d$/;

const NON_DIGITS = /\D/g;


export default component(
    function(
        this: { attributes?: Attributes } | void,
        {
            disabled,
            group,
            invalid,
            length = 6,
            value = '',
            state = reactive({ value }),
            variant,
            ...attributes
        }: A
    ) {
        let cells: HTMLInputElement[] = [],
            size = group || length;

        function cell(index: number) {
            return input({
                'aria-invalid': invalid && 'true',
                'aria-label': `Digit ${index + 1} of ${length}`,
                autocomplete: index === 0 ? 'one-time-code' : 'off',
                // The first cell of each group after the first is pushed off the one before it.
                class: ['input--otp', index > 0 && index % size === 0 && 'input--otp-break', variant && `input--${variant}`],
                disabled,
                inputmode: 'numeric',
                maxlength: length,
                onconnect: (element: HTMLInputElement) => {
                    cells[index] = element;
                },
                oninput: (e: Event) => {
                    let target = e.currentTarget as HTMLInputElement,
                        text = target.value;

                    target.value = '';

                    if (text.replace(NON_DIGITS, '')) {
                        write(index, text);
                    }
                    else {
                        sync();
                    }
                },
                onkeydown: (e: KeyboardEvent) => {
                    let target = e.currentTarget as HTMLInputElement;

                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                        e.preventDefault();
                        focus(index + (e.key === 'ArrowLeft' ? -1 : 1));
                    }
                    else if (e.key === 'Backspace') {
                        e.preventDefault();

                        if (target.value) {
                            target.value = '';
                        }
                        else if (index > 0) {
                            cells[index - 1].value = '';
                            focus(index - 1);
                        }

                        sync();
                    }
                    else if (DIGIT.test(e.key) && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        write(index, e.key);
                    }
                },
                onpaste: (e: ClipboardEvent) => {
                    e.preventDefault();
                    write(index, e.clipboardData?.getData('text') ?? '');
                },
                type: 'text',
                value: state.value[index] ?? ''
            });
        }

        // Raw DOM: the template has no way to move focus, which is the whole point of a code field.
        function focus(index: number) {
            let cell = cells[Math.max(0, Math.min(index, length - 1))];

            cell.focus();
            cell.select();
        }

        // A code fills in order, so a press anywhere in the group lands on the first empty cell; once every cell is
        // filled, it selects the pressed one so the next digit replaces it. The browser's own focus is held back, or
        // it would land on the pressed cell first.
        function press(e: MouseEvent) {
            if (disabled || e.button !== 0) {
                return;
            }

            e.preventDefault();

            for (let i = 0; i < length; i++) {
                if (!cells[i].value) {
                    focus(i);
                    return;
                }
            }

            let index = cells.indexOf(e.target as HTMLInputElement);

            focus(index === -1 ? length - 1 : index);
        }

        function sync() {
            let code = '';

            for (let i = 0; i < length; i++) {
                code += cells[i].value;
            }

            state.value = code;
        }

        // A paste or a fast typist can land several digits in one cell; they fill it and the cells after it.
        function write(index: number, text: string) {
            let digits = text.replace(NON_DIGITS, '');

            if (!digits) {
                return;
            }

            for (let i = 0, n = Math.min(digits.length, length - index); i < n; i++) {
                cells[index + i].value = digits[i];
            }

            sync();
            focus(index + digits.length);
        }

        return html`
            <div
                class='group input-otp'
                role='group'
                ${this?.attributes}
                ${attributes}
                ${{ onmousedown: press }}
            >
                ${Array.from({ length }, (_, index) => cell(index))}
            </div>
        `;
    }
);

export type { State };
