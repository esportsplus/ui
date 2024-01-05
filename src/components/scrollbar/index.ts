import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let root = document.body,
    width: number | undefined;


export default ({ fixed, style }: { fixed?: boolean, style?: string } = {}) => {
    let state = reactive({
            height: 100,
            translate: 0
        });

    return {
        attributes: {
            class: () => {
                return '--scrollbar-content';
            },
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
        },
        html: html`
            <div
                class='scrollbar ${fixed ? 'scrollbar--fixed' : ''} ${() => state.height >= 100 ? 'scrollbar--hidden' : ''}'
                style='${() => `
                    ${style || ''}
                    --translate: translate3d(0, ${state.translate}%, 0);
                    --height: ${state.height}%;
                `}'
            ></div>
        `
    };
};