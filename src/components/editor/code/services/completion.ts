import { flush, reactive, ReactiveArray } from '@esportsplus/reactivity';
import { pin, type Pin } from './pin';
import type { CompletionItem } from './protocol';


type Completion = {
    aria: { 'aria-activedescendant': () => false | string; 'aria-controls': () => false | string };
    attach: (element: HTMLElement) => void;
    hide: VoidFunction;
    id: string;
    item: (index?: number) => CompletionItem | undefined;
    move: (step: number) => void;
    // Lays the open list at its anchor again, after a relayout moved it.
    place: VoidFunction;
    rows: ReactiveArray<Row>;
    show: (items: CompletionItem[]) => void;
    state: { open: boolean; selected: number };
};

type Row = { detail: string; index: number; label: string };


// Options rendered from one response; servers can return thousands.
const LIMIT = 200;


// The completion list's state: a listbox in the top layer, pinned under the word being completed at 'anchor'. Focus
// stays in the editor, which drives it through 'move' and reports the active option with 'aria-activedescendant'.
const completion = (id: string, anchor: () => HTMLElement | undefined): Completion => {
    let items: CompletionItem[] = [],
        list: HTMLElement | undefined,
        pinned: Pin | undefined,
        rows = new ReactiveArray<Row>(),
        state = reactive({ open: false, selected: 0 });

    function reveal() {
        flush();

        let option = list?.children[state.selected] as HTMLElement | undefined;

        if (!list || !option) {
            return;
        }

        // Scrolls the list only; 'scrollIntoView' would also scroll the page to a list near the viewport's edge.
        if (option.offsetTop < list.scrollTop) {
            list.scrollTop = option.offsetTop;
        }
        else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
            list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
        }
    }

    let api: Completion = {
        aria: {
            'aria-activedescendant': () => state.open && `${id}-${state.selected}`,
            'aria-controls': () => state.open && id
        },
        attach: (element: HTMLElement) => {
            list = element;
        },
        hide: () => {
            if (!state.open && !rows.length) {
                return;
            }

            state.open = false;
            rows.splice(0, rows.length);
            items = [];
            pinned?.stop();
            pinned = undefined;

            if (list?.matches(':popover-open')) {
                list.hidePopover();
            }
        },
        id,
        item: (index = state.selected) => items[index],
        move: (step: number) => {
            let n = rows.length;

            state.selected = (state.selected + step + n) % n;
            reveal();
        },
        place: () => pinned?.update(),
        rows,
        show: (next: CompletionItem[]) => {
            items = next
                .filter((item) => typeof item?.label === 'string')
                .sort((a, b) => (a.sortText ?? a.label).localeCompare(b.sortText ?? b.label))
                .slice(0, LIMIT);

            if (!items.length) {
                api.hide();
                return;
            }

            rows.splice(0, rows.length, ...items.map((item, index) => ({ detail: item.detail ?? '', index, label: item.label })));
            state.selected = 0;
            state.open = true;
            // A manual popover enters the top layer only through its API; flushed first so it opens at its final size.
            flush();

            if (!list?.isConnected) {
                return;
            }

            if (!list.matches(':popover-open')) {
                list.showPopover();
            }

            let target = anchor();

            if (pinned) {
                pinned.update();
            }
            else if (target) {
                pinned = pin(list, target, 's');
            }

            list.scrollTop = 0;
        },
        state
    };

    return api;
};


export { completion };
export type { Completion, Row };
