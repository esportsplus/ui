import { html } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


export default ({ attributes, content }: { attributes?: Record<PropertyKey, unknown>, content: any }) => {
    let state = reactive({
            load: false,
            scale: false
        });

    setTimeout(() => {
        state.scale = true;
    }, 300);

    return html`
        <div class='loader ${() => state.load && 'loader--load'}'>
            <div class='loader ${() => state.load && 'loader--load'}'>
                <div class='loader-content'>
                    <div
                        class='
                            ${() => state.scale && 'loader-logo--scale'}
                            loader-logo
                            text
                            --flex-center
                            --text-uppercase
                            --text-600
                        '
                        style='color: var(--color-grey-500);'
                        onanimationend='${({ animationName: name }: AnimationEvent) => {
                            if (name === 'scale') {
                                state.load = true;
                            }
                        }}'
                        ${attributes}
                    >
                        ${content}
                    </div>
                </div>
            </div>
        </div>
    `;
}