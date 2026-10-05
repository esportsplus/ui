import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { computed, reactive, read } from '@esportsplus/reactivity';
import icon from '~/components/icon';
import dash from '@esportsplus/ui/svg/dash.svg';
import options, { type Attr } from './options';


type A = Attributes & {
    label: string;
    name?: string;
};

type Builder<T extends Type> = { [K in T]: (attributes: Option) => Renderable<unknown> } & {
    header: (attributes?: Header) => Renderable<unknown>;
    hint: (attributes?: Attributes) => Renderable<unknown>;
    selected: () => string[];
};

type Context = {
    anchor: number | null;
    control: (attributes: Attr, content?: Renderable<unknown>) => Renderable<unknown>;
    group: { total: number };
    id: string;
    label: string;
    name?: string;
    options: { checked: boolean, id: string }[];
    shift: boolean;
    type: Type;
};

type Header = Attributes & { counter?: boolean };

type Option = Attr & {
    checked?: boolean;
    value: string;
};

type Type = 'checkbox' | 'switch';


let uid = 0;


function all(ctx: Context) {
    return ctx.group.total > 0 && count(ctx) === ctx.group.total;
}

function count(ctx: Context) {
    let n = 0;

    for (let i = 0, o = ctx.group.total; i < o; i++) {
        if (ctx.options[i].checked) {
            n++;
        }
    }

    return n;
}

function fill(ctx: Context, a: number, b: number, checked: boolean) {
    for (let i = Math.min(a, b), n = Math.max(a, b); i <= n; i++) {
        ctx.options[i].checked = checked;
    }
}

function header(ctx: Context, { counter = false, ...attributes }: Header = {}): Renderable<unknown> {
    let tally = computed(() => count(ctx));

    return html`
        <label class='checkbox-group-header' ${attributes}>
            ${ctx.control(
                {
                    style: () => `--progress: ${ctx.group.total && read(tally) / ctx.group.total}`,
                    [options.checkbox.input]: {
                        'aria-controls': () => ctx.options.slice(0, ctx.group.total).map((option) => `${ctx.id}-${option.id}`).join(' '),
                        checked: () => {
                            let n = read(tally);

                            return n > 0 && n === ctx.group.total;
                        },
                        disabled: () => ctx.group.total === 0,
                        indeterminate: () => {
                            let n = read(tally);

                            return n > 0 && n < ctx.group.total;
                        },
                        onchange: () => {
                            ctx.anchor = null;
                            ctx.shift = false;
                            fill(ctx, 0, ctx.group.total - 1, !all(ctx));
                        }
                    }
                },
                ctx.type === 'checkbox' && icon({ 'aria-hidden': true, class: 'checkbox-group-dash' }, dash)
            )}
            <span class='checkbox-group-label'>
                ${ctx.label}
            </span>
            ${counter && html`
                <span class='checkbox-group-counter'>
                    ${() => read(tally)} of ${() => ctx.group.total}
                </span>
            `}
        </label>
    `;
}

function hint(attributes?: Attributes) {
    return html`
        <p class='checkbox-group-hint' ${attributes}>
            <kbd class='checkbox-group-hint-key'>Shift</kbd> click to select a range
        </p>
    `;
}

// A label click forwards a second click to its input, and browsers disagree on whether that one carries the
// modifier, so remember it from whichever event saw it.
function onclick(ctx: Context, e: MouseEvent) {
    if (e.shiftKey) {
        ctx.shift = true;
    }
}

function onkeydown(ctx: Context, e: KeyboardEvent) {
    if (e.key === ' ') {
        ctx.shift = e.shiftKey;
    }
}

function option(ctx: Context, { checked = false, value, [options.checkbox.input]: input, ...attributes }: Option): Renderable<unknown> {
    let index = ctx.options.length,
        state = reactive({ checked, id: value });

    ctx.options.push(state);

    // Write-only, so registering inside a parent effect never subscribes it to the total.
    ctx.group.total = ctx.options.length;

    return ctx.control({
        ...attributes,
        [options.checkbox.input]: {
            ...input,
            checked: () => state.checked,
            id: `${ctx.id}-${value}`,
            name: ctx.name,
            onchange: function(this: HTMLInputElement) {
                toggle(ctx, index, this.checked);
            },
            value
        }
    });
}

function selected(ctx: Context) {
    let ids: string[] = [];

    for (let i = 0, n = ctx.group.total; i < n; i++) {
        if (ctx.options[i].checked) {
            ids.push(ctx.options[i].id);
        }
    }

    return ids;
}

function toggle(ctx: Context, index: number, checked: boolean) {
    fill(ctx, ctx.shift && ctx.anchor !== null ? ctx.anchor : index, index, checked);
    ctx.anchor = index;
    ctx.shift = false;
}


const group = <T extends Type>(type: T) => {
    return component(function (
        this: { attributes?: Partial<A> } | void,
        { label, name, ...attributes }: A,
        content: (builder: Builder<T>) => Renderable<unknown>
    ) {
        let ctx: Context = {
                anchor: null,
                control: type === 'switch' ? options.switch : options.checkbox,
                group: reactive({ total: 0 }),
                id: `checkbox-group-${++uid}`,
                label,
                name,
                options: [],
                shift: false,
                type
            };

        return html`
            <div
                aria-label='${label}'
                class='checkbox-group'
                role='group'
                ${this?.attributes}
                ${attributes}
                ${{
                    onclick: (e) => onclick(ctx, e),
                    onkeydown: (e) => onkeydown(ctx, e)
                }}
            >
                ${content({
                    [type]: (attributes: Option) => option(ctx, attributes),
                    header: (attributes?: Header) => header(ctx, attributes),
                    hint,
                    selected: () => selected(ctx)
                } as Builder<T>)}
            </div>
        `;
    });
}


export { group };
export type { Builder };
