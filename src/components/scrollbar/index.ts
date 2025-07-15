import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import './scss/index.scss';


let root = document.body,
    width: number | undefined;


export default ({ attributes, fixed }: { attributes?: Record<string, unknown>, fixed?: boolean } = {}) => {
    let state = reactive({
            height: 100,
            translate: 0
        });

    return {
        html: html`
            <div
                class='
                    ${fixed && 'scrollbar--fixed'}
                    ${() => state.height >= 100 && 'scrollbar--hidden'}
                    scrollbar
                '
                style='${() => `
                    --translate: translate3d(0, ${state.translate}%, 0);
                    --height: ${state.height}%;
                `}'
                ${attributes}
            >
            </div>
        `,
        parent: {
            attributes: {
                class: 'scrollbar-content',
                onscroll: function(this: HTMLElement) {
                    if (width === undefined) {
                        width = this.offsetWidth - this.clientWidth;

                        if (width && width !== 17) {
                            root.style.setProperty('--scrollbar-width', `${width}px`);
                        }
                    }

                    state.height = (this.clientHeight / this.scrollHeight) * 100;
                    state.translate = (this.scrollTop / this.clientHeight) * 100;
                }
            }
        }
    };
};