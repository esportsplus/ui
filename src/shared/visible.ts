// Calls 'show' once, the first time the element these attributes are spread on comes into view: entrances that should
// play where someone can see them rather than off screen.
const onceVisible = (show: VoidFunction, options?: IntersectionObserverInit) => {
    let observer: IntersectionObserver | undefined;

    return {
        onconnect: (element: HTMLElement) => {
            observer = new IntersectionObserver((entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) {
                    return;
                }

                observer?.disconnect();
                show();
            }, options);
            observer.observe(element);
        },
        ondisconnect: () => {
            observer?.disconnect();
        }
    };
};


export { onceVisible };
