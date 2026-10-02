import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
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

type Item = Element & { [ROW]?: Row };

type Row = {
    index: number;
    task: Task;
};

type Task = {
    checked?: boolean;
    description?: Renderable<unknown>;
    label: Renderable<unknown>;
};


const ROW = Symbol();

const TASKLIST_CHECKBOX = Symbol.for('@esportsplus/ui/tasklist.checkbox');

const TASKLIST_CONTENT = Symbol.for('@esportsplus/ui/tasklist.content');

const TASKLIST_DESCRIPTION = Symbol.for('@esportsplus/ui/tasklist.description');

const TASKLIST_ITEM = Symbol.for('@esportsplus/ui/tasklist.item');

const TASKLIST_LABEL = Symbol.for('@esportsplus/ui/tasklist.label');

const TASKLIST_ROW = Symbol.for('@esportsplus/ui/tasklist.row');


function checked(item: Item) {
    return !!item[ROW]?.task.checked;
}

// Where a row settles: the open rows come first, then the checked ones; 'ordered' keeps each group in task order.
// null appends to the end of the list.
function destination(item: HTMLElement & Item, ordered: boolean) {
    let index = item[ROW]!.index,
        value = checked(item);

    for (let child of item.parentElement!.children as HTMLCollectionOf<Item>) {
        if (child === item) {
            continue;
        }

        let section = done(child);

        if (section === value) {
            if (ordered && child[ROW]!.index > index) {
                return child;
            }
        }
        else if (section) {
            return child;
        }
    }

    return null;
}

// Rows still animating have not moved yet, so they sit in the group they are leaving
function done(item: Item) {
    let value = checked(item);

    return pending(item) ? !value : value;
}

function move(item: HTMLElement, reference: Element | null) {
    if (reference === item.nextElementSibling) {
        return;
    }

    let list = item.parentElement!,
        items = [...list.children] as HTMLElement[],
        first = items.map((element) => element.getBoundingClientRect().top);

    // moveBefore keeps focus on the input; insertBefore drops it
    if (typeof list.moveBefore === 'function') {
        list.moveBefore(item, reference);
    }
    else {
        let focused = document.activeElement as HTMLElement | null;

        list.insertBefore(item, reference);

        if (focused && item.contains(focused)) {
            focused.focus({ preventScroll: true });
        }
    }

    // Measure untransformed positions so a move that interrupts another starts from where rows are drawn
    for (let i = 0, n = items.length; i < n; i++) {
        items[i].style.transform = '';
        items[i].style.transition = 'none';
    }

    let last = items.map((element) => element.getBoundingClientRect().top);

    for (let i = 0, n = items.length; i < n; i++) {
        let offset = first[i] - last[i];

        if (offset) {
            items[i].style.transform = `translateY(${offset}px)`;
        }
    }

    list.getBoundingClientRect();

    for (let i = 0, n = items.length; i < n; i++) {
        items[i].style.transform = '';
        items[i].style.transition = '';
    }

    item.classList.add('tasklist-item--moving');

    void finished(item).then(() => {
        if (!item.getAnimations().length) {
            item.classList.remove('tasklist-item--moving');
        }
    });
}

function pending(item: Element) {
    return item.classList.contains('tasklist-item--checking') || item.classList.contains('tasklist-item--unchecking');
}

function row(
    entry: Row,
    options: { ordered: boolean; reorder: boolean },
    context: Partial<A> | undefined,
    attributes: Partial<A>
) {
    let box = attributes[TASKLIST_CHECKBOX],
        sequence = 0,
        task = entry.task;

    return html`
        <li
            class='tasklist-item'
            style='--index: ${entry.index + 1};'
            ${context?.[TASKLIST_ITEM]}
            ${attributes[TASKLIST_ITEM]}
            ${{
                onchange: async function(this: HTMLElement, event: Event) {
                    let id = ++sequence,
                        value = (event.target as HTMLInputElement).checked;

                    task.checked = value;

                    // Must land in the same style flush as the checked change so the stage delays apply
                    this.classList.remove('tasklist-item--checking', 'tasklist-item--unchecking');
                    this.classList.add(value ? 'tasklist-item--checking' : 'tasklist-item--unchecking');

                    await finished(this, { subtree: true });

                    if (id !== sequence) {
                        return;
                    }

                    this.classList.remove('tasklist-item--checking', 'tasklist-item--unchecking');

                    if (options.reorder) {
                        move(this, destination(this, options.ordered));
                    }
                },
                onconnect: (element: Item) => {
                    element[ROW] = entry;
                }
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


export default component(
    function(
        this: { attributes?: Partial<A> } | void,
        { ordered = false, reorder = true, sortable: sorts = false, tasks, ...attributes }: A
    ) {
        let context = this?.attributes,
            entries = tasks.map((task, index) => ({ index, task })),
            options = { ordered, reorder };

        return html`
            <ul
                class='tasklist'
                ${context}
                ${attributes}
                ${sorts && sortable({
                    // A row dropped among the other group returns to the edge of its own
                    onsort: (item) => {
                        if (!reorder) {
                            return;
                        }

                        let next = item.nextElementSibling,
                            previous = item.previousElementSibling;

                        if (checked(item) ? next && !done(next) : previous && done(previous)) {
                            let boundary: Element | null = null;

                            for (let child of item.parentElement!.children) {
                                if (child !== item && done(child)) {
                                    boundary = child;
                                    break;
                                }
                            }

                            move(item, boundary);
                        }
                    }
                })}
            >
                ${(reorder ? [
                    ...entries.filter((entry) => !entry.task.checked),
                    ...entries.filter((entry) => entry.task.checked)
                ] : entries).map((entry) => row(entry, options, context, attributes))}
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
