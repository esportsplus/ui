import { flush, reactive } from '@esportsplus/reactivity';
import type { Hover } from './protocol';


type Card = {
    attach: (element: HTMLElement) => void;
    hide: VoidFunction;
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


// The hover card's state: a tooltip in the top layer, anchored over the hovered text. It never takes the pointer, so
// moving on over the text it covers keeps hovering the editor.
const hover = (): Card => {
    let card: HTMLElement | undefined,
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

            if (card?.matches(':popover-open')) {
                card.hidePopover();
            }
        },
        show: (value: string) => {
            if (!value) {
                api.hide();
                return;
            }

            state.text = value;
            state.open = true;
            flush();

            if (card?.isConnected && !card.matches(':popover-open')) {
                card.showPopover();
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
