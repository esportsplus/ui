import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import template from '~/components/template';
import './scss/index.scss';


type A = Attributes & { scrollbar?: Attributes, 'scrollbar-container-content'?: Attributes };


const OMIT = ['scrollbar', 'scrollbar-container-content'];


let root = document.body,
    width: number | undefined;


export default template.factory<A>(
    function(attributes, content) {
        let state = reactive({
                height: 100,
                translate: 0
            });

        return html`
            <div
                class='scrollbar-container'
                ${omit(attributes, OMIT)}
                ${this.attributes && omit(this.attributes, OMIT)}
            >
                <div
                    class='scrollbar-container-content'
                    ${attributes['scrollbar-container-content']}
                    ${this.attributes?.['scrollbar-container-content']}
                    ${{
                        onscroll: function() {
                            if (width === undefined) {
                                width = this.offsetWidth - this.clientWidth;

                                if (width && width !== 17) {
                                    root.style.setProperty('--scrollbar-width', `${width}px`);
                                }
                            }

                            state.height = (this.clientHeight / this.scrollHeight) * 100;
                            state.translate = (this.scrollTop / this.clientHeight) * 100;
                        }
                    }}
                >
                    ${content}
                </div>

                <div
                    class='scrollbar'
                    ${this.attributes?.scrollbar}
                    ${{
                        class: () => state.height >= 100 && 'scrollbar--hidden',
                        style: () => `
                            --translate: translate3d(0, ${state.translate}%, 0);
                            --height: ${state.height}%;
                        `
                    }}
                >
                </div>
            </div>
        `;
    }
);
export type { A as Attributes }