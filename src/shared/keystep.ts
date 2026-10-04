// How far a slider key moves its value: arrows one step, Shift or the Page keys ten, Home and End to either end.
// Null for any other key, which the slider leaves alone.
const keystep = (e: KeyboardEvent, step: number) => {
    let big = step * 10,
        unit = e.shiftKey ? big : step;

    switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
            return unit;
        case 'ArrowDown':
        case 'ArrowLeft':
            return -unit;
        case 'End':
            return Infinity;
        case 'Home':
            return -Infinity;
        case 'PageDown':
            return -big;
        case 'PageUp':
            return big;
    }

    return null;
};


export { keystep };
