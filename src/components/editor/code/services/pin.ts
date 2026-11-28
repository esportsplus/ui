import { follow } from '~/shared/follow';
import { place, type Side } from '~/shared/placement';


type Pin = {
    stop: VoidFunction;
    // Lays the card again, for a relayout that moves the anchor without a scroll or resize.
    update: VoidFunction;
};


// The anchor's ancestors that clip what overflows them: the editor's scroller and whatever scrolls around it. Found
// once as a card opens, as they hold still while it's open.
function clipping(anchor: HTMLElement) {
    let clips: HTMLElement[] = [];

    for (let parent = anchor.parentElement; parent; parent = parent.parentElement) {
        let style = getComputedStyle(parent);

        if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
            clips.push(parent);
        }
    }

    return clips;
}

// Whether the anchor shows inside every ancestor that clips it.
function inside(box: DOMRect, clips: HTMLElement[]) {
    for (let i = 0, n = clips.length; i < n; i++) {
        let clip = clips[i].getBoundingClientRect();

        if (box.bottom < clip.top || box.top > clip.bottom || box.right < clip.left || box.left > clip.right) {
            return false;
        }
    }

    return true;
}


// Lays a service card at its anchor in the text, on 'side' while it fits there and across the anchor otherwise, lined up
// with the anchor's start, and keeps it there as the text scrolls; hidden while the anchor is scrolled out of view.
// Raw style writes, as the card's place changes on scroll frames, outside any template update.
const pin = (card: HTMLElement, anchor: HTMLElement, side: Side): Pin => {
    let clips = clipping(anchor),
        update = () => {
            let box = anchor.getBoundingClientRect(),
                { x, y } = place({ align: 'start', anchor: box, axis: 'y', height: card.offsetHeight, margin: 0, side, width: card.offsetWidth });

            card.style.left = `${x}px`;
            card.style.top = `${y}px`;
            card.style.visibility = inside(box, clips) ? '' : 'hidden';
        };

    update();

    return { stop: follow(anchor, update), update };
};


export { pin };
export type { Pin };
