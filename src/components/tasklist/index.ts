import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { flush, reactive, ReactiveArray } from '@esportsplus/reactivity';
import { finished } from '~/shared/animation';
import checkbox from '~/components/checkbox';
import sortable from '~/components/sortable';
import './scss/index.scss';


type A = Attributes & {
    [TASKLIST_CHECKBOX]?: CheckboxAttributes;
    [TASKLIST_CONTENT]?: Attributes;
    [TASKLIST_DESCRIPTION]?: Attributes;
    [TASKLIST_ITEM]?: Attributes;
    [TASKLIST_LABEL]?: Attributes;
    [TASKLIST_ROW]?: Attributes;
    ordered?: boolean;
    reorder?: boolean;
    sortable?: boolean;
    tasks: Task[];
};

type CheckboxAttributes = NonNullable<Parameters<typeof checkbox>[0]>;

// 'offset' holds a row where it was drawn while the list reorders under it, transitions off; null lets it slide home.
type Row = {
    index: number;
    state: { moving: boolean, offset: number | null, stage: '' | 'checking' | 'unchecking' };
    task: Task;
};

type Task = {
    checked?: boolean;
    description?: Renderable<unknown>;
    label: Renderable<unknown>;
};


const TASKLIST_CHECKBOX = Symbol.for('@esportsplus/ui/tasklist.checkbox');

const TASKLIST_CONTENT = Symbol.for('@esportsplus/ui/tasklist.content');

const TASKLIST_DESCRIPTION = Symbol.for('@esportsplus/ui/tasklist.description');

const TASKLIST_ITEM = Symbol.for('@esportsplus/ui/tasklist.item');

const TASKLIST_LABEL = Symbol.for('@esportsplus/ui/tasklist.label');

const TASKLIST_ROW = Symbol.for('@esportsplus/ui/tasklist.row');


// Where a row settles: the open rows come first, then the checked ones; 'ordered' keeps each group in task order.
// The row it goes before; null for the end of the list.
function destination(rows: Row[], entry: Row, ordered: boolean) {
    let value = !!entry.task.checked;

    for (let i = 0, n = rows.length; i < n; i++) {
        let row = rows[i];

        if (row === entry) {
            continue;
        }

        let section = done(row);

        if (section === value) {
            if (ordered && row.index > entry.index) {
                return row;
            }
        }
        else if (section) {
            return row;
        }
    }

    return null;
}

// Rows still animating have not moved yet, so they sit in the group they are leaving
function done(row: Row) {
    let value = !!row.task.checked;

    return row.state.stage ? !value : value;
}


export default component(
    function(
        this: { attributes?: Partial<A> } | void,
        { ordered = false, reorder = true, sortable: sorts = false, tasks, ...attributes }: A
    ) {
        let context = this?.attributes,
            entries: Row[] = tasks.map((task, index) => ({ index, state: reactive({ moving: false, offset: null as number | null, stage: '' as Row['state']['stage'] }), task })),
            list: HTMLElement | undefined,
            rows = new ReactiveArray<Row>(reorder ? [
                ...entries.filter((entry) => !entry.task.checked),
                ...entries.filter((entry) => entry.task.checked)
            ] : entries),
            view = sorts
                ? sortable(rows, row, {
                    // A row dropped among the other group returns to the edge of its own
                    onsort: (entry) => {
                        if (!reorder) {
                            return;
                        }

                        let at = rows.indexOf(entry),
                            next = rows[at + 1],
                            previous = rows[at - 1];

                        if (entry.task.checked ? next && !done(next) : previous && done(previous)) {
                            move(entry, rows.find((r) => r !== entry && done(r)) ?? null);
                        }
                    }
                })
                : null,
            slot = view ? null : html.reactive(rows, (entry) => row(entry));

        // Reorders the rows, then slides each from where it was drawn to its new place.
        function move(entry: Row, before: Row | null) {
            let at = rows.indexOf(entry);

            if (!list || before === (rows[at + 1] ?? null)) {
                return;
            }

            let first = new Map<Row, number>(),
                items = list.children;

            for (let i = 0, n = rows.length; i < n; i++) {
                first.set(rows[i], items[i].getBoundingClientRect().top);
            }

            let rest = rows.filter((r) => r !== entry);

            rest.splice(before ? rest.indexOf(before) : rest.length, 0, entry);

            let rank = new Map(rest.map((r, i) => [r, i]));

            // A sort moves the rows' own nodes, so focus stays on the checkbox.
            rows.sort((a, b) => rank.get(a)! - rank.get(b)!);

            if (view) {
                view.flush();
            }
            else {
                slot!.flush();
            }

            // Measure untransformed positions so a move that interrupts another starts from where rows are drawn
            for (let i = 0, n = rows.length; i < n; i++) {
                rows[i].state.offset = 0;
            }

            flush();

            for (let i = 0, n = rows.length; i < n; i++) {
                rows[i].state.offset = first.get(rows[i])! - items[i].getBoundingClientRect().top;
            }

            flush();
            list.getBoundingClientRect();

            for (let i = 0, n = rows.length; i < n; i++) {
                rows[i].state.offset = null;
            }

            entry.state.moving = true;
            flush();

            let element = items[rows.indexOf(entry)] as HTMLElement;

            void finished(element).then(() => {
                if (!element.getAnimations().length) {
                    entry.state.moving = false;
                }
            });
        }

        function row(entry: Row, sorting?: Attributes) {
            let box = attributes[TASKLIST_CHECKBOX],
                sequence = 0,
                state = entry.state,
                task = entry.task;

            return html`
                <li
                    class='tasklist-item'
                    style='--index: ${entry.index + 1};'
                    ${context?.[TASKLIST_ITEM]}
                    ${attributes[TASKLIST_ITEM]}
                    ${sorting}
                    ${{
                        class: [
                            () => state.moving && 'tasklist-item--moving',
                            () => state.stage && `tasklist-item--${state.stage}`
                        ],
                        onchange: async function(this: HTMLElement, event: Event) {
                            let id = ++sequence,
                                value = (event.target as HTMLInputElement).checked;

                            task.checked = value;
                            state.stage = value ? 'checking' : 'unchecking';

                            // Must land in the same style flush as the checked change so the stage delays apply
                            flush();

                            await finished(this, { subtree: true });

                            if (id !== sequence) {
                                return;
                            }

                            state.stage = '';

                            if (reorder) {
                                move(entry, destination(rows, entry, ordered));
                            }
                        },
                        style: () => state.offset !== null && `transform: translateY(${state.offset}px); transition: none;`
                    }}
                >
                    <label class='tasklist-row' ${context?.[TASKLIST_ROW]} ${attributes[TASKLIST_ROW]}>
                        ${checkbox.call(
                            { attributes: context?.[TASKLIST_CHECKBOX] },
                            {
                                ...box,
                                class: ['tasklist-checkbox', box?.class ?? []].flat(),
                                [checkbox.input]: { ...box?.[checkbox.input], checked: !!task.checked }
                            }
                        )}

                        <span class='tasklist-content' ${context?.[TASKLIST_CONTENT]} ${attributes[TASKLIST_CONTENT]}>
                            <span class='tasklist-label' ${context?.[TASKLIST_LABEL]} ${attributes[TASKLIST_LABEL]}>${task.label}</span>
                            ${task.description && html`
                                <span class='tasklist-description' ${context?.[TASKLIST_DESCRIPTION]} ${attributes[TASKLIST_DESCRIPTION]}>
                                    ${task.description}
                                </span>
                            `}
                        </span>
                    </label>
                </li>
            `;
        }

        return html`
            <ul
                class='tasklist'
                ${context}
                ${attributes}
                ${view?.attributes}
                ${{
                    onconnect: (element: HTMLElement) => {
                        list = element;
                    }
                }}
            >
                ${view ? view.render() : slot}
            </ul>
        `;
    },
    {
        checkbox: TASKLIST_CHECKBOX,
        content: TASKLIST_CONTENT,
        description: TASKLIST_DESCRIPTION,
        item: TASKLIST_ITEM,
        label: TASKLIST_LABEL,
        row: TASKLIST_ROW
    }
);


export type { Task };
