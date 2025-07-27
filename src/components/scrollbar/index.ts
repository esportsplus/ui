import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import template from '~/components/template';
import './scss/index.scss';


let root = document.body,
    width: number | undefined;


export default template.factory<Attributes & { scrollbar?: Attributes, 'scrollbar-container-content'?: Attributes }>(
    (attributes, content) => {
        let state = reactive({
                height: 100,
                translate: 0
            });

        return html`
            <div
                class='scrollbar-container'
                ${omit(attributes, ['scrollbar-container-content', 'scrollbar'])}
            >
                <div
                    class='scrollbar-container-content'
                    onscroll='${function(this: HTMLElement) {
                        if (width === undefined) {
                            width = this.offsetWidth - this.clientWidth;

                            if (width && width !== 17) {
                                root.style.setProperty('--scrollbar-width', `${width}px`);
                            }
                        }

                        state.height = (this.clientHeight / this.scrollHeight) * 100;
                        state.translate = (this.scrollTop / this.clientHeight) * 100;
                    }}'
                    ${attributes['scrollbar-container-content']}
                >
                    ${content}
                </div>

                <div
                    class='
                        ${() => state.height >= 100 && 'scrollbar--hidden'}
                        scrollbar
                    '
                    style='${() => `
                        --translate: translate3d(0, ${state.translate}%, 0);
                        --height: ${state.height}%;
                    `}'
                    ${attributes.scrollbar}
                >
                </div>
            </div>
        `;
    }
);