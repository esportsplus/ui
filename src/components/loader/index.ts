import { reactive } from '@esportsplus/reactivity';
import { html, Attributes } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities'
import template from '~/components/template';
import './scss/index.scss';


type A = Attributes & {
    'loader-content'?: Attributes,
    'loader-logo'?: Attributes
};


const OMIT = ['loader-content', 'loader-logo'];


export default template.factory(
    (attributes: A, content) => {
        let a = {
                class: () => state.load && 'loader--load'
            },
            state = reactive({
                load: false,
                remove: false,
                scale: false
            });

        return () => {
            if (state.remove) {
                return;
            }

            let i = 0;

            return html`
                <div
                    class='loader'
                    onanimationend=${(e: AnimationEvent) => {
                        i++;

                        if (e.animationName === 'move' && i > 1) {
                            state.remove = true;
                        }
                    }}
                    ${a}
                    ${omit(attributes, OMIT)}
                >
                    <div class='loader' ${a}>
                        ${content && html`
                            <div class='loader-content' ${attributes['loader-content']}>
                                <div
                                    class='loader-logo text --flex-center --text-uppercase --text-600'
                                    style='color: var(--color-grey-500);'
                                    ${attributes['loader-logo']}
                                    ${{
                                        class: () => state.scale && 'loader-logo--scale',
                                        onanimationend: ({ animationName: name }) => {
                                            if (name === 'scale') {
                                                state.load = true;
                                            }
                                        },
                                        onconnect: () => {
                                            state.scale = true;
                                        }
                                    }}
                                >
                                    ${content}
                                </div>
                            </div>
                        `}
                    </div>
                </div>
            `;
        }
    }
);