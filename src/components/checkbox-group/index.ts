import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import checkbox, { factory } from '~/components/checkbox';
import './scss/index.scss';


type A = Attributes & {
    [CHECKBOX_GROUP_INPUT]?: Input;
    [CHECKBOX_GROUP_ROW]?: Attributes;
    hint?: boolean;
    items: Item[];
    label: string;
    name?: string;
    state?: Record<string, boolean>;
    value?: string[];
};

// The checkbox's own input part: no 'onrender' or 'type', since the checkbox owns both.
type Input = NonNullable<NonNullable<Parameters<typeof checkbox>[0]>[typeof factory.input]>;

type Item = {
    description?: string;
    id: string;
    label: string;
};


const CHECKBOX_GROUP_INPUT = Symbol.for('@esportsplus/ui/checkbox-group.input');

const CHECKBOX_GROUP_ROW = Symbol.for('@esportsplus/ui/checkbox-group.row');


let uid = 0;


function template(
    this: { attributes?: Pick<A, typeof CHECKBOX_GROUP_INPUT | typeof CHECKBOX_GROUP_ROW> } | void,
    {
        hint = true,
        items,
        label,
        name,
        value = [],
        state = reactive(Object.fromEntries(items.map((item) => [item.id, value.includes(item.id)]))),
        ...attributes
    }: A
) {
    let anchor: number | null = null,
        id = `checkbox-group-${++uid}`,
        shift = false;

    function all() {
        return count() === items.length;
    }

    function count() {
        let n = 0;

        for (let i = 0, m = items.length; i < m; i++) {
            if (state[items[i].id]) {
                n++;
            }
        }

        return n;
    }

    function mixed() {
        let n = count();

        return n > 0 && n < items.length;
    }

    // A label click forwards a second click to its input, and browsers disagree on whether that one carries
    // the modifier, so remember it from whichever event saw it.
    function remember(e: MouseEvent) {
        if (e.shiftKey) {
            shift = true;
        }
    }

    function toggle(index: number, checked: boolean) {
        let from = shift && anchor !== null ? anchor : index,
            hi = Math.max(from, index);

        for (let i = Math.min(from, index); i <= hi; i++) {
            state[items[i].id] = checked;
        }

        anchor = index;
        shift = false;
    }

    return html`
        <div class='checkbox-group' ${this?.attributes} ${attributes}>
            <label
                class='checkbox-group-row checkbox-group-row--parent'
                ${this?.attributes?.[CHECKBOX_GROUP_ROW]}
                ${attributes[CHECKBOX_GROUP_ROW]}
            >
                <span class='checkbox-group-box'>
                    ${checkbox({
                        [factory.input]: {
                            'aria-controls': items.map((item) => `${id}-${item.id}`).join(' '),
                            checked: () => all(),
                            indeterminate: () => mixed(),
                            onchange: () => {
                                let checked = !all();

                                anchor = null;
                                shift = false;

                                for (let i = 0, n = items.length; i < n; i++) {
                                    state[items[i].id] = checked;
                                }
                            }
                        }
                    })}
                    <svg aria-hidden='true' class='checkbox-group-dash' fill='none' stroke='currentColor' stroke-linecap='round' viewBox='0 0 16 16'>
                        <path d='M4 8h8' pathLength='1' />
                    </svg>
                </span>
                <span class='checkbox-group-text'>
                    <span class='checkbox-group-label' id='${id}-all'>${label}</span>
                </span>
                <span class='checkbox-group-count'>${() => count()} of ${items.length}</span>
            </label>
            <div class='checkbox-group-divider'></div>
            <div aria-labelledby='${id}-all' class='checkbox-group-items' role='group'>
                ${items.map((item, index) => html`
                    <label
                        class='checkbox-group-row ${item.description && 'checkbox-group-row--description'}'
                        ${this?.attributes?.[CHECKBOX_GROUP_ROW]}
                        ${attributes[CHECKBOX_GROUP_ROW]}
                        ${{ onclick: remember }}
                    >
                        <span class='checkbox-group-box'>
                            ${checkbox({
                                [factory.input]: {
                                    checked: () => state[item.id],
                                    id: `${id}-${item.id}`,
                                    name,
                                    onchange: function(this: HTMLInputElement) {
                                        toggle(index, this.checked);
                                    },
                                    onclick: remember,
                                    value: item.id,
                                    ...this?.attributes?.[CHECKBOX_GROUP_INPUT],
                                    ...attributes[CHECKBOX_GROUP_INPUT]
                                }
                            })}
                        </span>
                        <span class='checkbox-group-text'>
                            <span class='checkbox-group-label'>${item.label}</span>
                            ${item.description ? html`<span class='checkbox-group-description'>${item.description}</span>` : ''}
                        </span>
                    </label>
                `)}
            </div>
            ${hint ? html`
                <p class='checkbox-group-hint'>
                    <kbd>Shift</kbd> click to select a range
                </p>
            ` : ''}
        </div>
    `;
}


export default Object.assign(template, { input: CHECKBOX_GROUP_INPUT, row: CHECKBOX_GROUP_ROW } as const);
export type { Item };
