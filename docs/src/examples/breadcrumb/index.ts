import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { breadcrumb } from '@esportsplus/ui/components';
import type { Separator } from '@esportsplus/ui/components/breadcrumb';
import type { Entry } from 'docs/types';
import 'docs/examples/breadcrumb/scss/index.scss';


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


function resizable({ plain = false, separator, status }: { plain?: boolean, separator?: Separator, status?: { last: string } } = {}) {
    let drag: { max: number | undefined; width: number; x: number } | null = null,
        frame: HTMLElement | undefined,
        // 'width' is the frame's, null until it is first resized.
        size = reactive({ max: 520, now: 520, width: null as number | null }),
        wrap: HTMLElement | undefined;

    function resize(width: number, max = wrap?.clientWidth ?? width) {
        if (!frame) {
            return;
        }

        let next = Math.round(Math.min(Math.max(width, MIN_WIDTH), max));

        size.max = Math.round(max);
        size.now = next;
        size.width = next;
    }

    return html`
        <div
            class='breadcrumb-demo'
            ${{
                onconnect: (element: HTMLElement) => {
                    wrap = element;
                    size.max = size.now = Math.round(element.clientWidth);
                }
            }}
        >
            <div
                class='breadcrumb-demo-frame ${plain && 'breadcrumb-demo-frame--plain'}'
                ${{
                    onconnect: (element: HTMLElement) => {
                        frame = element;
                    },
                    style: () => size.width !== null && `width: ${size.width}px;`
                }}
            >
                ${breadcrumb({
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
                    aria-valuemin='${MIN_WIDTH}'
                    class='breadcrumb-demo-handle'
                    role='slider'
                    tabindex='0'
                    ${{
                        'aria-valuemax': () => size.max,
                        'aria-valuenow': () => size.now,
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
                            drag = { max: wrap?.clientWidth, width: frame?.offsetWidth ?? 0, x: e.clientX };
                        },
                        onpointermove: (e: PointerEvent) => {
                            if (drag) {
                                resize(drag.width + e.clientX - drag.x, drag.max);
                            }
                        },
                        onpointerup: () => {
                            drag = null;
                        }
                    }}
                >
                    <span class='breadcrumb-demo-grip'></span>
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
        }
    ]
} satisfies Entry;
