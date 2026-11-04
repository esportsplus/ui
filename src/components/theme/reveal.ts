import { flush } from '@esportsplus/reactivity';


// Whoever reveals: the transition running on its behalf, so a newer one can take the page over from it.
type Owner = {
    reveal: ViewTransition | null;
};

// A border box by its centre and half sizes, with each corner's radii from the top left clockwise.
type Shape = {
    height: number;
    rx: number[];
    ry: number[];
    width: number;
    x: number;
    y: number;
};


const ATTRIBUTE = 'data-theme-reveal';

const CORNERS = ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'];

const FROM = '--theme-reveal-from';

const MOTION = '(prefers-reduced-motion: reduce)';

const TO = '--theme-reveal-to';


// Whether the shape scaled by 'factor' about its centre covers every corner of the viewport, each tested against the
// corner of the shape facing it.
function covers(shape: Shape, factor: number) {
    let height = shape.height * factor,
        width = shape.width * factor;

    for (let i = 0; i < 4; i++) {
        let bottom = i > 1,
            right = i === 1 || i === 2,
            dx = (right ? innerWidth : 0) - shape.x,
            dy = (bottom ? innerHeight : 0) - shape.y,
            corner = dy < 0 ? (dx < 0 ? 0 : 1) : (dx < 0 ? 3 : 2),
            rx = shape.rx[corner] * factor,
            ry = shape.ry[corner] * factor;

        dx = Math.abs(dx);
        dy = Math.abs(dy);

        if (dx > width || dy > height) {
            return false;
        }

        let ex = dx - width + rx,
            ey = dy - height + ry;

        if (ex > 0 && ey > 0 && (ex / rx) ** 2 + (ey / ry) ** 2 > 1) {
            return false;
        }
    }

    return true;
}

// The shape scaled by 'factor' about its centre, as an inset of the viewport; past the viewport the insets go negative.
function inset(shape: Shape, factor: number) {
    let height = shape.height * factor,
        width = shape.width * factor,
        x: string[] = [],
        y: string[] = [];

    for (let i = 0; i < 4; i++) {
        x.push(`${shape.rx[i] * factor}px`);
        y.push(`${shape.ry[i] * factor}px`);
    }

    return `inset(${shape.y - height}px ${innerWidth - shape.x - width}px ${innerHeight - shape.y - height}px ${shape.x - width}px round ${x.join(' ')} / ${y.join(' ')})`;
}

function length(value: string, size: number) {
    return value.endsWith('%') ? parseFloat(value) / 100 * size : parseFloat(value) || 0;
}

// The element's border box with its corners resolved to lengths, scaled down where they overlap as CSS draws them;
// an inset's own percentages would read the viewport. Null for a box with no area, which no scale can grow.
function measure(element: Element): Shape | null {
    let rect = element.getBoundingClientRect();

    if (!rect.width || !rect.height) {
        return null;
    }

    let rx: number[] = [],
        ry: number[] = [],
        style = getComputedStyle(element);

    for (let i = 0; i < 4; i++) {
        let [horizontal, vertical = horizontal] = style.getPropertyValue(CORNERS[i]).split(' ');

        rx.push(length(horizontal, rect.width));
        ry.push(length(vertical, rect.height));
    }

    let fit = Math.min(
        1,
        rect.width / (rx[0] + rx[1]),
        rect.width / (rx[3] + rx[2]),
        rect.height / (ry[0] + ry[3]),
        rect.height / (ry[1] + ry[2])
    );

    for (let i = 0; i < 4; i++) {
        rx[i] *= fit;
        ry[i] *= fit;
    }

    return {
        height: rect.height / 2,
        rx,
        ry,
        width: rect.width / 2,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };
}

// The least scale, to within a pixel's worth, at which the shape covers the viewport: doubled until it does, then
// halved back between the last miss and the first cover.
function scale(shape: Shape) {
    let high = 1,
        low = 1;

    while (!covers(shape, high)) {
        low = high;
        high *= 2;
    }

    while ((high - low) * Math.max(shape.height, shape.width) > 0.5) {
        let middle = (high + low) / 2;

        if (covers(shape, middle)) {
            high = middle;
        }
        else {
            low = middle;
        }
    }

    return high;
}


// Paints what 'write' changes outward from 'origin' where the browser can: its shape, scaled about its centre until it
// covers the viewport, so the corners keep their proportion all the way out. Elsewhere, or for an origin with no area,
// 'write' just runs.
const reveal = (owner: Owner, origin: Element, write: VoidFunction) => {
    let element = document.documentElement,
        shape = measure(origin);

    if (!shape || !('startViewTransition' in document) || matchMedia(MOTION).matches) {
        write();
        return;
    }

    element.setAttribute(ATTRIBUTE, '');
    element.style.setProperty(FROM, inset(shape, 1));
    element.style.setProperty(TO, inset(shape, scale(shape)));

    let transition = owner.reveal = document.startViewTransition(() => {
        write();
        flush();
    });

    // A reveal started mid-way owns the attribute from then on.
    let done = () => {
        if (owner.reveal !== transition) {
            return;
        }

        owner.reveal = null;
        element.removeAttribute(ATTRIBUTE);
        element.style.removeProperty(FROM);
        element.style.removeProperty(TO);
    };

    transition.finished.then(done, done);
};


export default reveal;
export type { Owner };
