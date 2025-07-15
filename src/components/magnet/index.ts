import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import './scss/index.scss';


export default ({ attributes, hide }: { attributes?: Record<string, unknown>, hide?: boolean }) => {
    let active = false,
        events: Record<string, Function> = {
            onmouseover: function (this: HTMLElement) {
                let { offsetHeight, offsetLeft, offsetTop, offsetWidth } = this;

                active = true;

                state.height = offsetHeight;
                state.left = offsetLeft;
                state.opacity = 1;
                state.top = offsetTop;
                state.width = offsetWidth;
            }
        },
        state = reactive({
            height: null as number | null,
            hide: true,
            left: 0,
            opacity: 0,
            top: 0,
            width: 0
        });

    if (hide === true) {
        events.onmouseout = () => {
            active = false;
            setTimeout(() => {
                if (active === true) {
                    return;
                }

                state.opacity = 0;
            }, 50);
        };
    }

    return {
        html: html`
            <div class='magnet' style='${() => `
                height: ${state.height ? `${state.height}px` : '100%'};
                opacity: ${state.opacity};
                transform: translate(${state.left}px, ${state.top}px);
                width: ${state.width}px;
            `}' ${attributes}></div>
        `,
        sibling: {
            attributes: events
        }
    };
};