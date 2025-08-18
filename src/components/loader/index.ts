import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import template from '~/components/template';
import './scss/index.scss';


export default template.factory(
    (attributes, content) => {
        let c = () => state.load && 'loader--load',
            state = reactive({
                load: false,
                scale: false
            });

        setTimeout(() => {
            state.scale = true;
        }, 300);

        return html`
            <div class='loader' ${{ class: c }}>
                <div class='loader' ${{ class: c }}>
                    <div class='loader-content'>
                        <div
                            class='loader-logo text --flex-center --text-uppercase --text-600'
                            style='color: var(--color-grey-500);'
                            ${attributes}
                            ${{
                                class: () => state.scale && 'loader-logo--scale',
                                onanimationend: ({ animationName: name }) => {
                                    if (name === 'scale') {
                                        state.load = true;
                                    }
                                }
                            }}
                        >
                            ${content}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
);