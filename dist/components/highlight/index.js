import { reactive } from '@esportsplus/reactivity';
import './scss/index.scss';
let key = Symbol(), observer = null;
export default (background) => {
    if (observer === null) {
        observer = new IntersectionObserver((entries) => {
            let disconnected = 0, n = entries.length;
            for (let i = 0; i < n; i++) {
                let { isIntersecting, target } = entries[i];
                if (target.isConnected) {
                    target[key].highlight = +isIntersecting;
                }
                else {
                    disconnected++;
                    observer.unobserve(target);
                }
            }
            if (n - disconnected === 0) {
                observer.disconnect();
                observer = null;
            }
        }, { threshold: 1 });
    }
    let state = reactive({
        highlight: 0
    });
    return {
        attributes: {
            class: 'highlight',
            onrender: function (element) {
                element[key] = state;
                observer.observe(element);
            },
            style: [
                () => `--highlight: ${state.highlight}`,
                `--background: ${background}`,
            ]
        }
    };
};
