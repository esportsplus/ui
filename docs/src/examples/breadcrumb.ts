import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { breadcrumb } from '@esportsplus/ui';
import type { Separator } from '~/components/breadcrumb';
import type { Entry } from '~/types';
import '~/examples/breadcrumb.scss';


let path = [
    { href: '/workspace', label: 'Workspace' },
    { href: '/workspace/projects', label: 'Projects' },
    { href: '/workspace/projects/ui-lab', label: 'ui-lab' },
    { href: '/workspace/projects/ui-lab/src', label: 'src' },
    { href: '/workspace/projects/ui-lab/src/lab', label: 'lab' },
    { href: '/workspace/projects/ui-lab/src/lab/components', label: 'components' },
    { href: '/workspace/projects/ui-lab/src/lab/components/button.tsx', label: 'button.tsx' }
];


// Narrow enough to fold everything, wide enough that the current page still reads in full.
const MIN_WIDTH = 220;

const STEP = 16;


function resizable({ modifier = '', plain = false, separator, status }: { modifier?: string, plain?: boolean, separator?: Separator, status?: { last: string } } = {}) {
    let drag: { width: number; x: number } | null = null,
        frame: HTMLElement | undefined,
        handle: HTMLElement | undefined,
        wrap: HTMLElement | undefined;

    // Written straight to the DOM: resizing is continuous, and only a fold change inside the trail reacts.
    function resize(width: number) {
        let max = wrap?.clientWidth ?? width;

        if (!frame || !handle) {
            return;
        }

        let next = Math.round(Math.min(Math.max(width, MIN_WIDTH), max));

        frame.style.width = `${next}px`;
        handle.setAttribute('aria-valuemax', String(Math.round(max)));
        handle.setAttribute('aria-valuenow', String(next));
    }

    return html`
        <div class='breadcrumb-demo' ${{ onconnect: (element: HTMLElement) => { wrap = element; } }}>
            <div class='breadcrumb-demo-frame ${plain && 'breadcrumb-demo-frame--plain'}' ${{ onconnect: (element: HTMLElement) => { frame = element; } }}>
                ${breadcrumb({
                    class: modifier,
                    items: path,
                    separator,
                    onnavigate: (item, index) => {
                        if (status) {
                            status.last = `navigate → ${item.label} (#${index})`;
                        }
                    }
                })}
                <div
                    aria-label='Container width'
                    aria-orientation='horizontal'
                    aria-valuemax='520'
                    aria-valuemin='${MIN_WIDTH}'
                    aria-valuenow='520'
                    class='breadcrumb-demo-handle'
                    role='slider'
                    tabindex='0'
                    ${{
                        onconnect: (element: HTMLElement) => {
                            handle = element;

                            let max = String(Math.round(wrap?.clientWidth ?? 0));

                            element.setAttribute('aria-valuemax', max);
                            element.setAttribute('aria-valuenow', max);
                        },
                        onkeydown: (e: KeyboardEvent) => {
                            let width = frame?.offsetWidth ?? 0,
                                next = ({
                                    ArrowDown: width - STEP,
                                    ArrowLeft: width - STEP,
                                    ArrowRight: width + STEP,
                                    ArrowUp: width + STEP,
                                    End: Infinity,
                                    Home: MIN_WIDTH,
                                    PageDown: width - STEP * 4,
                                    PageUp: width + STEP * 4
                                } as Record<string, number>)[e.key];

                            if (next === undefined) {
                                return;
                            }

                            e.preventDefault();
                            resize(next);
                        },
                        onpointercancel: () => {
                            drag = null;
                        },
                        onpointerdown: (e: PointerEvent) => {
                            if (e.button !== 0) {
                                return;
                            }

                            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                            drag = { width: frame?.offsetWidth ?? 0, x: e.clientX };
                        },
                        onpointermove: (e: PointerEvent) => {
                            if (drag) {
                                resize(drag.width + e.clientX - drag.x);
                            }
                        },
                        onpointerup: () => {
                            drag = null;
                        }
                    }}
                >
                    <span></span>
                </div>
            </div>
            <p class='breadcrumb-demo-hint'>
                ${() => status ? status.last : 'Drag the edge to resize. Folded folders live behind the dots.'}
            </p>
        </div>
    `;
}


export default {
    name: 'breadcrumb',
    variants: [
        {
            render: () => resizable(),
            title: 'default (drag the edge to resize)'
        },
        {
            render: () => resizable({ separator: 'chevron' }),
            title: "separator: 'chevron'"
        },
        {
            render: () => resizable({ plain: true }),
            title: 'no background'
        },
        {
            render: () => resizable({ plain: true, separator: 'chevron' }),
            title: "no background, separator: 'chevron'"
        },
        {
            render: () => resizable({ status: reactive({ last: 'click a crumb or a folded folder' }) }),
            title: 'onnavigate'
        },
        {
            render: () => resizable({ modifier: 'breadcrumb--compact' }),
            title: 'breadcrumb--compact'
        }
    ]
} satisfies Entry;
