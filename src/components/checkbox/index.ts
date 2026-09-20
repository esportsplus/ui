import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { omit } from '@esportsplus/utilities';
import form from '~/components/form';
import icon from '~/components/icon';
import check from './svg/check.svg';
import './scss/index.scss';


const OMIT = ['checked', 'name', 'state', 'value'];
const radios = new WeakMap<HTMLInputElement, { active: boolean }>();


function syncRadios(input: HTMLInputElement) {
    if (!input.name) {
        return;
    }

    for (let peer of (input.getRootNode() as Document | ShadowRoot).querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
        let state = radios.get(peer);

        if (state && peer.name === input.name && peer.form === input.form) {
            state.active = peer.checked;
        }
    }
}


const factory = (type: 'checkbox' | 'radio' | 'switch') => {
    function template(
        this: { attributes?: Attributes } | any,
        attributes?: Attributes & { state?: { active: boolean, error: string } }
    ) {
        let ref: HTMLElement,
            state = attributes?.state || reactive({
                active: false,
                error: ''
            });

        if (attributes?.checked) {
            state.active = true;
        }

        return html`
            <div
                class='${type === 'radio' ? 'checkbox checkbox--radio' : type} ${() => state.active && '--active'}'
                ${this?.attributes && omit(this.attributes, OMIT)}
                ${attributes && omit(attributes, OMIT)}
                onclick=${(event: MouseEvent) => {
                    if (event.target !== ref) {
                        ref.click();
                    }
                }}
            >
                <input
                    ${{
                        checked: () => {
                            if (type === 'radio' && state.active) {
                                queueMicrotask(() => ref && syncRadios(ref as HTMLInputElement));
                            }

                            return state.active;
                        },
                        'aria-label': attributes?.['aria-label'] ?? this?.attributes?.['aria-label'],
                        class: `${type}-tag`,
                        name: attributes?.name ?? this?.attributes?.name,
                        onchange: (e: Event) => {
                            state.active = (e.target as HTMLInputElement).checked;

                            if (type === 'radio') {
                                syncRadios(e.target as HTMLInputElement);
                            }
                        },
                        onconnect: (input) => {
                            ref = input;

                            if (type === 'radio') {
                                radios.set(input as unknown as HTMLInputElement, state);
                            }
                        },
                        onrender: form.input.onrender(state),
                        type: type === 'radio' ? 'radio' : 'checkbox',
                        value: attributes?.value || 1
                    }}
                >
                ${type === 'checkbox' && icon({ class: 'checkbox-check', 'aria-hidden': 'true' }, check)}
            </div>
        `;
    }

    return template;
};


export default factory('checkbox');
export { factory };
