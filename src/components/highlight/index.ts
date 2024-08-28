import { reactive } from '@esportsplus/reactivity'


let key = Symbol(),
    observer: IntersectionObserver | null = null;


export default (background: string) => {
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

    return {
        attributes: {
            class: 'highlight',
            onrender: function(element: HTMLElement & Record<PropertyKey, unknown>) {
                element[key] = state;
                observer!.observe(element);
            },
            style: [ `--background: ${background}`, () => `--highlight: ${state.highlight}` ]
        }
    };
}