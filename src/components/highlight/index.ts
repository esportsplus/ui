import { reactive } from '@esportsplus/reactivity'
import { html, Attributes } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import template from '~/components/template';
import './scss/index.scss';


type A = Attributes & { background?: string };


const OMIT = ['background'];


let key = Symbol(),
    observer: IntersectionObserver | null = null;


export default template.factory(
    (attributes: A, content) => {
        if (observer === null) {
            observer = new IntersectionObserver((entries) => {
                let disconnected = 0,
                    n = entries.length;

                for (let i = 0; i < n; i++) {
                    let { isIntersecting, target } = entries[i];

                    if (target.isConnected) {
                        // @ts-ignore
                        target[key].highlight = +isIntersecting;
                    }
                    else {
                        disconnected++;
                        observer!.unobserve(target);
                    }
                }

                if (n - disconnected === 0) {
                    observer!.disconnect();
                    observer = null;
                }
            }, { threshold: 1 });
        }

        let state = reactive({
                highlight: 0
            });

        return html`
            <div class='highlight'
                ${omit(attributes, OMIT)}
                ${{
                    onrender: (element) => {
                        element[key] = state;
                        observer!.observe(element);
                    },
                    style: [
                        () => `--highlight: ${state.highlight}`,
                        `--background: ${attributes.background}`,
                    ]
                }}
            >
                ${content}
            </div>
        `;
    }
);