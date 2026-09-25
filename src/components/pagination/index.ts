import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import icon from '~/components/icon';
import next from './svg/arrow-right.svg';
import previous from './svg/arrow-left.svg';
import './scss/index.scss';


// Sentinel page number rendered as an overflow ellipsis.
const DOTS = 0;


function range(start: number, end: number) {
    let values: number[] = [];

    for (let i = start; i <= end; i++) {
        values.push(i);
    }

    return values;
}

// First, last, current, two ellipses and the siblings on each side of current.
function pages(page: number, siblings: number, total: number) {
    let slots = siblings * 2 + 5;

    if (total <= slots) {
        return range(1, total);
    }

    let edge = slots - 2,
        left = Math.max(page - siblings, 1),
        right = Math.min(page + siblings, total);

    if (left <= 3) {
        return [...range(1, edge), DOTS, total];
    }

    if (right >= total - 2) {
        return [1, DOTS, ...range(total - edge + 1, total)];
    }

    return [1, DOTS, ...range(left, right), DOTS, total];
}


export default ({ onchange, siblings = 1, state: api = reactive({ page: 1 }), total, ...attributes }: Attributes & {
    onchange?: (page: number) => void;
    siblings?: number;
    state?: { page: number };
    total: number;
}) => {
    let render = reactive([] as { value: number }[]),
        stop = effect(() => {
            let values = pages(api.page, siblings, total);

            untrack(() => {
                // Reuse cells in place so only the changed labels re-render.
                for (let i = 0, n = values.length; i < n; i++) {
                    if (render[i]) {
                        render[i].value = values[i];
                    }
                    else {
                        let cell = reactive({ value: values[i] });

                        render[i] = cell;
                    }
                }

                if (render.length > values.length) {
                    render.splice(values.length);
                }
            });
        });

    function go(page: number) {
        page = Math.min(Math.max(page, 1), total);

        if (page === api.page) {
            return;
        }

        api.page = page;
        onchange?.(page);
    }

    onCleanup(stop);

    return html`
        <nav aria-label='Pagination' class='pagination' ${attributes}>
            <button
                aria-disabled='${() => String(api.page <= 1)}'
                class='button pagination-control ${() => api.page <= 1 ? '--disabled' : ''}'
                onclick='${() => go(api.page - 1)}'
                type='button'
            >
                ${icon({ 'aria-hidden': 'true' }, previous)}
                Previous
            </button>

            <div class='pagination-pages'>
                ${html.reactive(render, function (cell) {
                    return html`
                        <button
                            aria-current='${() => cell.value === api.page ? 'page' : 'false'}'
                            aria-hidden='${() => String(cell.value === DOTS)}'
                            class='button pagination-page ${() => cell.value === DOTS ? 'pagination-page--dots' : cell.value === api.page ? '--active' : ''}'
                            onclick='${() => cell.value !== DOTS && go(cell.value)}'
                            tabindex='${() => cell.value === DOTS ? -1 : 0}'
                            type='button'
                        >
                            ${() => cell.value === DOTS ? '...' : cell.value}
                        </button>
                    `;
                })}
            </div>

            <button
                aria-disabled='${() => String(api.page >= total)}'
                class='button pagination-control ${() => api.page >= total ? '--disabled' : ''}'
                onclick='${() => go(api.page + 1)}'
                type='button'
            >
                Next
                ${icon({ 'aria-hidden': 'true' }, next)}
            </button>
        </nav>
    `;
};
