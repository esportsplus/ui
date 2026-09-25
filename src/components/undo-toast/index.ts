import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { toast } from '~/components/toast';
import './scss/index.scss';


type A = Attributes & {
    [UNDO_TOAST_ROW]?: Attributes;
    duration?: number;
    emptyLabel?: string;
    items: Item[];
    label?: string;
    onconnect?: never;
    ondelete?: (items: Item[]) => void;
    ondocumentkeydown?: never;
    restoreLabel?: string;
    state?: State;
};

type Item = { id: string, meta: string, name: string };

type State = { empty: boolean, pending: number };


const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const UNDO_TOAST_ROW = Symbol.for('@esportsplus/ui/undo-toast.row');


function editable(target: EventTarget | null) {
    return target instanceof HTMLElement && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
}

function enter(row: HTMLElement) {
    let reduce = reduced();

    row.hidden = false;
    row.animate(
        [
            reduce ? { opacity: 0 } : { filter: 'blur(4px)', opacity: 0, scale: 0.98 },
            reduce ? { opacity: 1 } : { filter: 'blur(0px)', opacity: 1, scale: 1 }
        ],
        // Waits 50ms for its neighbours to open the gap first.
        { delay: 50, duration: 250, easing: EASE_OUT, fill: 'backwards' }
    );
}

function leave(row: HTMLElement) {
    let { offsetLeft, offsetTop, offsetWidth } = row;

    // Popped out of flow so survivors slide into its place while it fades.
    row.classList.add('undo-toast-row--leaving');
    row.style.left = `${offsetLeft}px`;
    row.style.top = `${offsetTop}px`;
    row.style.width = `${offsetWidth}px`;

    row.animate(
        [{}, reduced() ? { opacity: 0 } : { opacity: 0, scale: 0.98 }],
        { duration: 150, easing: EASE_OUT, fill: 'forwards' }
    ).finished.then((animation) => {
        row.classList.remove('undo-toast-row--leaving');
        row.hidden = true;
        row.style.left = '';
        row.style.top = '';
        row.style.width = '';
        animation.cancel();
    }, () => {});
}

function measure(rows: HTMLElement[]) {
    let rects = new Map<HTMLElement, DOMRect>();

    for (let row of rows) {
        if (!row.hidden) {
            rects.set(row, row.getBoundingClientRect());
        }
    }

    return rects;
}

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function shortcut() {
    return /Mac|iPhone|iPad/.test(navigator.platform) ? 'Command Z' : 'Control Z';
}


export default Object.assign(
    function(this: { attributes?: Partial<A> } | void, { duration = 5000, emptyLabel = 'No files left', items, label = 'Files', ondelete, restoreLabel, state = reactive({ empty: false, pending: 0 }), ...attributes }: A) {
        let gone = new Set<string>(),
            live = reactive({ text: '' }),
            message: HTMLElement | undefined,
            pending: string[] = [],
            root: HTMLElement | undefined,
            rows = new Map<string, HTMLElement>(),
            slides = new WeakMap<HTMLElement, Animation>(),
            toastId: string | undefined;

        function commit() {
            toastId = undefined;
            message = undefined;

            if (pending.length === 0) {
                return;
            }

            let committed = items.filter((item) => pending.includes(item.id)),
                target = inside() ? visible()[0] : undefined;

            for (let id of pending) {
                gone.add(id);
            }

            pending = [];
            state.pending = 0;
            state.empty = visible().length === 0;
            ondelete?.(committed);
            focus(target ? target.id : 'list');
        }

        function focus(target: string | undefined) {
            if (!target || !root) {
                return;
            }

            if (target === 'list') {
                root.querySelector<HTMLElement>('.undo-toast-list')?.focus();
                return;
            }

            rows.get(target)?.querySelector<HTMLElement>('.undo-toast-delete')?.focus();
        }

        function inside() {
            return !!root?.contains(document.activeElement);
        }

        function notify(text: string) {
            if (!message) {
                message = document.createElement('span');
                message.className = 'undo-toast-message';
                toastId = toast.message(message, {
                    action: { label: 'Undo', onclick: undo },
                    countdown: true,
                    dismissible: false,
                    duration,
                    ondismiss: commit
                });
            }
            else if (toastId) {
                // A second delete stacks into this batch and restarts its timer instead of
                // replacing it, which would make the first delete permanent unseen.
                toast.update(toastId, { duration });
            }

            let next = document.createElement('span');

            next.className = 'undo-toast-message-text';
            next.textContent = text;

            for (let old of [...message.children] as HTMLElement[]) {
                old.classList.add('undo-toast-message-text--leaving');
                old.animate([{}, { opacity: 0 }], { duration: 120, fill: 'forwards' })
                    .finished.then(() => old.remove(), () => old.remove());
            }

            message.append(next);

            if (message.children.length > 1) {
                next.animate(
                    [
                        reduced() ? { opacity: 0 } : { filter: 'blur(4px)', opacity: 0, translate: '0 4px' },
                        { filter: 'blur(0px)', opacity: 1, translate: '0 0' }
                    ],
                    { duration: 200, easing: EASE_OUT }
                );
            }
        }

        function remove(item: Item) {
            let list = visible(),
                index = list.findIndex((i) => i.id === item.id),
                row = rows.get(item.id);

            if (!row || index === -1) {
                return;
            }

            let before = measure([...rows.values()].filter((r) => r !== row)),
                neighbour = list[index + 1] ?? list[index - 1],
                refocus = inside();

            leave(row);
            slide(before);
            pending.push(item.id);
            state.pending = pending.length;
            notify(pending.length === 1 ? `Deleted ‘${item.name}’` : `${pending.length} items deleted`);
            live.text = `Deleted ${item.name}. Press Undo or ${shortcut()} to restore.`;

            // Hands focus to a neighbour so it isn't dropped on the body.
            if (refocus) {
                focus(neighbour ? neighbour.id : 'list');
            }
        }

        function restore(ids: string[]) {
            let before = measure([...rows.values()]);

            for (let id of ids) {
                let row = rows.get(id);

                if (row) {
                    row.getAnimations().forEach((animation) => animation.cancel());
                    row.classList.remove('undo-toast-row--leaving');
                    row.style.left = '';
                    row.style.top = '';
                    row.style.width = '';
                    enter(row);
                }
            }

            slide(before);
        }

        function slide(before: Map<HTMLElement, DOMRect>) {
            for (let [row, rect] of before) {
                if (row.hidden || row.classList.contains('undo-toast-row--leaving')) {
                    continue;
                }

                let delta = rect.top - row.getBoundingClientRect().top;

                slides.get(row)?.cancel();

                if (delta === 0 || reduced()) {
                    continue;
                }

                slides.set(row, row.animate(
                    [{ translate: `0 ${delta}px` }, { translate: '0 0' }],
                    { duration: 250, easing: EASE_OUT }
                ));
            }
        }

        function undo() {
            if (pending.length === 0) {
                return;
            }

            let restored = pending,
                refocus = inside();

            pending = [];
            state.pending = 0;
            restore(restored);
            live.text = restored.length === 1 ? 'Restored' : `Restored ${restored.length} items`;

            if (refocus) {
                focus(restored[0]);
            }
        }

        function visible() {
            return items.filter((item) => !gone.has(item.id) && !pending.includes(item.id));
        }

        return html`
            <div
                class='undo-toast'
                ${this?.attributes}
                ${attributes}
                ${{
                    onconnect: (element: HTMLElement) => {
                        root = element;

                        for (let row of element.querySelectorAll<HTMLElement>('.undo-toast-row')) {
                            rows.set(row.dataset.id ?? '', row);
                        }
                    },
                    ondisconnect: () => {
                        if (toastId) {
                            toast.dismiss(toastId);
                        }
                    },
                    // Ctrl/Cmd+Z undoes while the toast shows, unless a text field wants it.
                    ondocumentkeydown: (e: KeyboardEvent) => {
                        if (pending.length === 0 || e.key.toLowerCase() !== 'z' || !(e.metaKey || e.ctrlKey)) {
                            return;
                        }

                        if (e.shiftKey || e.altKey || editable(e.target) || root?.closest('[inert]')) {
                            return;
                        }

                        e.preventDefault();
                        undo();

                        if (toastId) {
                            toast.dismiss(toastId);
                        }
                    }
                }}
            >
                <ul aria-label='${label}' class='undo-toast-list' tabindex='-1'>
                    ${items.map((item) => html`
                        <li
                            class='undo-toast-row'
                            data-id='${item.id}'
                            ${this?.attributes?.[UNDO_TOAST_ROW]}
                            ${attributes[UNDO_TOAST_ROW]}
                        >
                            <div class='undo-toast-row-text'>
                                <span class='undo-toast-row-name'>${item.name}</span>
                                <span class='undo-toast-row-meta'>${item.meta}</span>
                            </div>
                            <button
                                aria-label='Delete ${item.name}'
                                class='button undo-toast-delete'
                                type='button'
                                onclick=${() => remove(item)}
                            >
                                <svg aria-hidden='true' viewBox='0 0 16 16'>
                                    <path d='M2.75 4.25h10.5M6.25 4.25v-1.5h3.5v1.5M4 4.25l.6 8.1a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.1M6.75 7v3.75M9.25 7v3.75' />
                                </svg>
                            </button>
                        </li>
                    `)}
                </ul>

                <div class='undo-toast-empty ${() => state.empty && '--active'}' ${{ inert: () => !state.empty }}>
                    <span class='undo-toast-empty-label'>${emptyLabel}</span>
                    ${restoreLabel && html`
                        <button
                            class='button undo-toast-restore'
                            type='button'
                            onclick=${() => {
                                let ids = [...gone];

                                gone.clear();
                                state.empty = false;
                                restore(ids);
                                focus(ids[0]);
                            }}
                        >
                            ${restoreLabel}
                        </button>
                    `}
                </div>

                <span aria-live='polite' class='undo-toast-live'>${() => live.text}</span>
            </div>
        `;
    },
    { row: UNDO_TOAST_ROW } as const
);
