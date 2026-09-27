import { reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


const fade = () => {
    if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()')) {
        return { class: '--scrollbar --scrollbar-fade' };
    }

    let state = reactive({ clientHeight: 0, scrollHeight: 0, scrollTop: 0 }),
        observer: ResizeObserver | undefined;

    function measure(element: HTMLElement) {
        state.clientHeight = element.clientHeight;
        state.scrollHeight = element.scrollHeight;
        state.scrollTop = Math.max(0, element.scrollTop);
    };

    return {
        class: '--scrollbar --scrollbar-fade',
        onconnect: (element: HTMLElement) => {
            observer = new ResizeObserver(() => measure(element));
            observer.observe(element);

            measure(element);
        },
        ondisconnect: () => observer?.disconnect(),
        onscroll: function(this: HTMLElement) {
            measure(this);
        },
        style: () => `--scroll-height: ${state.scrollHeight}px; --scroll-client-height: ${state.clientHeight}px; --scroll-top: ${state.scrollTop}px;`
    };
};


export default { fade };
