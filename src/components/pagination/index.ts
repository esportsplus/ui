import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import icon from '~/components/icon';
import next from '@esportsplus/ui/svg/arrow-right.svg';
import previous from '@esportsplus/ui/svg/arrow-left.svg';
import dots from './dots';
import '~/components/button/scss/index.scss';
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

// First, last, current, two ellipses and the siblings on each side of current; always the same count for a total, so
// the cells are rendered once and only relabelled.
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


const plain = ({ onchange, siblings = 1, state: api = reactive({ page: 1 }), total, ...attributes }: Attributes & {
    onchange?: (page: number) => void;
    siblings?: number;
    state?: { page: number };
    total: number;
}) => {
    let cells = pages(api.page, siblings, total).map((value) => reactive({ value })),
        stop = effect(() => pages(api.page, siblings, total), (values) => {
            for (let i = 0, n = values.length; i < n; i++) {
                cells[i].value = values[i];
            }
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
                class='button pagination-control ${() => api.page <= 1 && '--disabled'}'
                onclick='${() => go(api.page - 1)}'
                type='button'
            >
                ${icon({ 'aria-hidden': 'true' }, previous)}
                Previous
            </button>

            <div class='pagination-pages'>
                ${cells.map((cell) => html`
                    <button
                        aria-current='${() => cell.value === api.page ? 'page' : 'false'}'
                        aria-hidden='${() => String(cell.value === DOTS)}'
                        class='button pagination-page ${() => cell.value === DOTS ? 'pagination-page--dots' : cell.value === api.page && '--active'}'
                        onclick='${() => cell.value !== DOTS && go(cell.value)}'
                        tabindex='${() => cell.value === DOTS ? -1 : 0}'
                        type='button'
                    >
                        ${() => cell.value === DOTS ? '...' : cell.value}
                    </button>
                `)}
            </div>

            <button
                aria-disabled='${() => String(api.page >= total)}'
                class='button pagination-control ${() => api.page >= total && '--disabled'}'
                onclick='${() => go(api.page + 1)}'
                type='button'
            >
                Next
                ${icon({ 'aria-hidden': 'true' }, next)}
            </button>
        </nav>
    `;
};

const pagination: typeof plain & { dots: typeof dots } = Object.assign(plain, { dots });


export default pagination;
