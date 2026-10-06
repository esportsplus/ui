import { component, html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import checkSvg from '@esportsplus/ui/svg/check.svg';
import copySvg from '@esportsplus/ui/svg/copy.svg';
import write from '~/components/clipboard/write';
import './scss/index.scss';


type A = Attributes & {
    error?: string;
    label?: string;
    onclick?: never;
    ondisconnect?: never;
    success?: string;
    timeout?: number;
    value: string | (() => string);
};


// SVG elements take no dynamic class, so each icon is its own static template.
const check = () => html`<svg aria-hidden='true' class='copy-icon copy-icon--check'><use href='#${checkSvg}' /></svg>`;

const idle = () => html`<svg aria-hidden='true' class='copy-icon'><use href='#${copySvg}' /></svg>`;


export default component(
    ({ error = 'Copy failed', label = 'Copy', success = 'Copied', timeout = 3000, value, ...attributes }: A) => {
        let request = 0,
            state = reactive({ status: 'idle' as 'error' | 'idle' | 'success' }),
            text = () => state.status === 'success' ? success : state.status === 'error' ? error : label,
            timer: ReturnType<typeof setTimeout> | undefined;

        return html`
            <button
                class='copy'
                type='button'
                ${attributes}
                ${{
                    'aria-label': text,
                    ondisconnect: () => {
                        request++;
                        clearTimeout(timer);
                    },
                    onclick: async (e: MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();

                        let current = ++request,
                            copied = await write(typeof value === 'function' ? value() : value);

                        // A second click can land while the first is still writing; only the last one's timer runs.
                        if (current !== request) {
                            return;
                        }

                        clearTimeout(timer);
                        state.status = copied ? 'success' : 'error';
                        timer = setTimeout(() => {
                            state.status = 'idle';
                        }, timeout);
                    },
                    title: text
                }}
            >
                ${() => state.status === 'success' ? check() : idle()}
            </button>
        `;
    }
);
