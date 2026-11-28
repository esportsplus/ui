import { flush, reactive } from '@esportsplus/reactivity';
import { pin, type Pin } from './pin';
import type { Hover } from './protocol';


type Card = {
    attach: (element: HTMLElement) => void;
    hide: VoidFunction;
    // Lays the open card at its anchor again, after a relayout moved it.
    place: VoidFunction;
    show: (value: string) => void;
    state: { open: boolean; text: string };
};


function text(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }

    if (value && typeof value === 'object' && 'value' in value) {
        return String(value.value);
    }

    return '';
}


// The hover card's state: a tooltip in the top layer, pinned over the hovered text at 'anchor'. It never takes the
// pointer, so moving on over the text it covers keeps hovering the editor.
const hover = (anchor: () => HTMLElement | undefined): Card => {
    let card: HTMLElement | undefined,
        pinned: Pin | undefined,
        state = reactive({ open: false, text: '' });

    let api: Card = {
        attach: (element: HTMLElement) => {
            card = element;
        },
        hide: () => {
            if (!state.open) {
                return;
            }

            state.open = false;
            state.text = '';
            pinned?.stop();
            pinned = undefined;

            if (card?.matches(':popover-open')) {
                card.hidePopover();
            }
        },
        place: () => pinned?.update(),
        show: (value: string) => {
            if (!value) {
                api.hide();
                return;
            }

            state.text = value;
            state.open = true;
            flush();

            // A manual popover enters the top layer only through its API; flushed first so it opens at its final size.
            if (card?.isConnected && !card.matches(':popover-open')) {
                card.showPopover();
            }

            let target = anchor();

            if (pinned) {
                pinned.update();
            }
            else if (card?.isConnected && target) {
                pinned = pin(card, target, 'n');
            }
        },
        state
    };

    return api;
};

const hoverText = (value: Hover) => Array.isArray(value.contents)
    ? value.contents.map(text).filter(Boolean).join('\n\n')
    : text(value.contents);


export { hover, hoverText };
export type { Card };
