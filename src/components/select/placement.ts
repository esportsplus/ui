import { clamp } from '~/shared/clamp';


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

    let maxBottom = trigger.offsetTop + (innerHeight - MARGIN - box.top) / scale,
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

    let width = trigger.offsetWidth + shift,
        left = Math.max(
            trigger.offsetLeft + (MARGIN - box.left) / scale,
            Math.min(trigger.offsetLeft - shift, trigger.offsetLeft + (innerWidth - MARGIN - box.left) / scale - width)
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
