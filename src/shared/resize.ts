type Size = { height: number; width: number };


// Observe natural content, separately from the box whose height CSS animates. Reading the delivered border box
// avoids another layout measurement; unchanged sizes and callbacks from a disconnected observer are ignored.
const observeSize = (change: (size: Size, element: HTMLElement) => void) => {
    let observer: ResizeObserver | undefined,
        version = 0;

    return {
        onconnect: (element: HTMLElement) => {
            observer?.disconnect();

            let previous: Size | undefined,
                connection = ++version,
                vertical = getComputedStyle(element).writingMode !== 'horizontal-tb';

            observer = new ResizeObserver(([entry]) => {
                if (connection !== version || !entry) {
                    return;
                }

                let box = entry.borderBoxSize?.[0],
                    size = box ? {
                        height: vertical ? box.inlineSize : box.blockSize,
                        width: vertical ? box.blockSize : box.inlineSize
                    } : { height: element.offsetHeight, width: element.offsetWidth };

                if (size.height !== previous?.height || size.width !== previous?.width) {
                    previous = size;
                    change(size, element);
                }
            });

            observer.observe(element, { box: 'border-box' });
        },
        ondisconnect: () => {
            observer?.disconnect();
            observer = undefined;
            version++;
        }
    };
};


export { observeSize };
export type { Size };
