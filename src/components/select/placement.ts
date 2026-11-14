import { clamp } from '~/shared/clamp';
import { viewport } from '~/shared/viewport';


type Parts = {
    label: HTMLElement;
    option: HTMLElement;
    panel: HTMLElement;
    scroller: HTMLElement;
    trigger: HTMLElement;
    value: HTMLElement;
};


const MARGIN = 8;

const ROWS = 8;


// The panel's width with every option at its natural size, up to its max width. The last placement's inline width is
// set aside for the read, since CSS can't size a box to both its content and the trigger's width: raw DOM, measuring
// only.
function natural(panel: HTMLElement) {
    let previous = panel.style.width;

    panel.style.width = 'max-content';

    let width = panel.offsetWidth;

    panel.style.width = previous;

    return width;
}

// Puts the selected option exactly over the trigger, the way macOS does, then trades list position for scroll
// position if that runs off screen.
function place({ label, option, panel, scroller, trigger, value }: Parts, count: number, selected: number) {
    let box = trigger.getBoundingClientRect();

    // Demo previews may scale the component down; work in the element's own pixels.
    let scale = box.height / trigger.offsetHeight || 1,
        item = option.offsetHeight,
        pad = parseFloat(getComputedStyle(scroller).paddingTop) || 0,
        rows = Math.min(count, parseInt(getComputedStyle(panel).getPropertyValue('--rows'), 10) || ROWS),
        height = rows * item + pad * 2,
        maxScroll = (count - rows) * item,
        scroll = clamp((selected - Math.floor(rows / 2)) * item, 0, maxScroll),
        // Shifting the panel left by this lands every option's text exactly on the trigger's text.
        shift = label.offsetLeft - (value.offsetLeft - trigger.offsetLeft),
        top = trigger.offsetTop + (trigger.offsetHeight - item) / 2 - (pad + selected * item - scroll);

    let view = viewport(),
        maxBottom = trigger.offsetTop + (view.height - MARGIN - box.top) / scale,
        minTop = trigger.offsetTop + (MARGIN - box.top) / scale;

    if (top < minTop) {
        let d = minTop - top;

        top += d;
        scroll += Math.min(d, maxScroll - scroll);
    }

    if (top + height > maxBottom) {
        let d = top + height - maxBottom;

        top -= d;
        scroll -= Math.min(d, scroll);
    }

    // At least the trigger's width, and wider when an option needs it, rather than cutting the option short.
    let width = Math.max(trigger.offsetWidth + shift, natural(panel)),
        left = Math.max(
            trigger.offsetLeft + (MARGIN - box.left) / scale,
            Math.min(trigger.offsetLeft - shift, trigger.offsetLeft + (view.width - MARGIN - box.left) / scale - width)
        );

    return {
        scroll,
        // Grows out of the trigger itself, wherever it ended up in the panel.
        style: `
            left: ${left}px;
            top: ${top}px;
            transform-origin: ${trigger.offsetLeft + trigger.offsetWidth / 2 - left}px ${trigger.offsetTop + trigger.offsetHeight / 2 - top}px;
            width: ${width}px;
        `
    };
}


export default place;
export { ROWS };
