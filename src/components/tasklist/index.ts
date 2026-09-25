import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import checkbox from '~/components/checkbox';
import { TASKLIST_CHECKBOX } from './constants';
import './scss/index.scss';


type CheckboxAttributes = NonNullable<Parameters<typeof checkbox>[0]>;

type Task = {
    checked?: boolean;
    description?: Renderable<unknown>;
    label: Renderable<unknown>;
};


function checked(item: Element) {
    return (item.querySelector('.checkbox-tag') as HTMLInputElement).checked;
}

// Cancelling an animation rejects its finished promise and replaces it with one that never settles,
// so every promise is taken before awaiting; rejections only mean the animation stopped running
async function finished(animations: Animation[]) {
    let promises: Promise<unknown>[] = [];

    for (let i = 0, n = animations.length; i < n; i++) {
        promises.push(animations[i].finished.catch(() => {}));
    }

    for (let i = 0, n = promises.length; i < n; i++) {
        await promises[i];
    }
}

function move(item: HTMLElement) {
    let list = item.parentElement!,
        reference: Element | null = null;

    if (!checked(item)) {
        let last: Element | null = null;

        // Rows still animating have not moved yet, so the open tasks end at the first checked row that has settled
        for (let child of list.children) {
            if (child === item) {
                return;
            }

            if (!checked(child)) {
                last = child;
            }
            else if (!pending(child)) {
                break;
            }
        }

        reference = last ? last.nextElementSibling : list.firstElementChild;
    }

    if (reference === item || (reference === null && list.lastElementChild === item)) {
        return;
    }

    let items = [...list.children] as HTMLElement[],
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

    item.classList.add('--moving');

    void finished(item.getAnimations()).then(() => {
        if (!item.getAnimations().length) {
            item.classList.remove('--moving');
        }
    });
}

function pending(item: Element) {
    return item.classList.contains('--checking') || item.classList.contains('--unchecking');
}

function row(task: Task, reorder: boolean, attributes?: CheckboxAttributes) {
    let sequence = 0;

    return html`
        <li
            class='tasklist-item'
            ${{
                onchange: async function(this: HTMLElement, event: Event) {
                    let id = ++sequence,
                        value = (event.target as HTMLInputElement).checked;

                    task.checked = value;

                    // Must land in the same style flush as the checked change so the stage delays apply
                    this.classList.remove('--checking', '--unchecking');
                    this.classList.add(value ? '--checking' : '--unchecking');

                    await finished(this.getAnimations({ subtree: true }));

                    if (id !== sequence) {
                        return;
                    }

                    this.classList.remove('--checking', '--unchecking');

                    if (reorder) {
                        move(this);
                    }
                }
            }}
        >
            <label class='tasklist-row'>
                ${checkbox.call({ attributes }, { class: 'tasklist-checkbox', [checkbox.input]: { checked: !!task.checked } })}

                <span class='tasklist-content'>
                    <span class='tasklist-label'>${task.label}</span>
                    ${task.description && html`<span class='tasklist-description'>${task.description}</span>`}
                </span>
            </label>
        </li>
    `;
}


export default Object.assign(
    component<Attributes & { [TASKLIST_CHECKBOX]?: CheckboxAttributes; reorder?: boolean; tasks: Task[] }>(
        function({ reorder = true, tasks, ...attributes }) {
            return html`
                <ul class='tasklist' ${attributes}>
                    ${(reorder ? [
                        ...tasks.filter((task) => !task.checked),
                        ...tasks.filter((task) => task.checked)
                    ] : tasks).map((task) => row(task, reorder, attributes[TASKLIST_CHECKBOX]))}
                </ul>
            `;
        }
    ),
    { checkbox: TASKLIST_CHECKBOX } as const
);


export type { Task };
