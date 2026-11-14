import { onCleanup, reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import highlight from '~/components/highlight';
import { observer } from '~/shared/resize';
import './scss/index.scss';


type A = Attributes & {
    [GROUP_HIGHLIGHT]?: Parameters<typeof highlight>[0];
};


const GROUP_HIGHLIGHT = Symbol.for('@esportsplus/ui/group.highlight');

const OVERLAY = 'group-item--overlay';


export default component(
    function(this: { attributes?: Attributes } | void, { [GROUP_HIGHLIGHT]: layer, ...attributes }: A, content) {
        let element: HTMLElement | undefined,
            overlay = reactive({ endInset: 0, endWidth: 0, enabled: false, startInset: 0, startWidth: 0 });

        // Items floating over the control sit on the side they're written on, before it or after it. Only layout knows
        // how big an item is, so each side's widest sets the control's room for it and its tallest the inset, which
        // matches the gap above and below it so the item sits evenly inside the control.
        function measure() {
            if (!element) {
                return;
            }

            let before = true,
                children = element.children,
                end = { height: 0, width: 0 },
                height = element.getBoundingClientRect().height,
                start = { height: 0, width: 0 };

            for (let i = 0, n = children.length; i < n; i++) {
                let child = children[i];

                if (!child.classList.contains(OVERLAY)) {
                    before = false;
                    continue;
                }

                let rect = child.getBoundingClientRect(),
                    side = before ? start : end;

                side.height = Math.max(side.height, rect.height);
                side.width = Math.max(side.width, rect.width);
            }

            overlay.endInset = end.width ? Math.max(0, (height - end.height) / 2) : 0;
            overlay.endWidth = end.width;
            overlay.startInset = start.width ? Math.max(0, (height - start.height) / 2) : 0;
            overlay.startWidth = start.width;
        }

        return html`
            <div
                class='group'
                ${this?.attributes}
                ${attributes}
                ${{
                    // Measured only when an item floats, so a plain group never observes anything.
                    onconnect: (el: HTMLElement) => {
                        let items = el.querySelectorAll(`:scope > .${OVERLAY}`);

                        if (items.length === 0) {
                            return;
                        }

                        let resize = observer(measure);

                        element = el;
                        overlay.enabled = true;
                        measure();
                        resize.observe(el);

                        for (let i = 0, n = items.length; i < n; i++) {
                            resize.observe(items[i]);
                        }

                        onCleanup(resize.disconnect);
                    },
                    style: () => overlay.enabled && {
                        '--end-inset': `${overlay.endInset}px`,
                        '--end-width': `${overlay.endWidth}px`,
                        '--start-inset': `${overlay.startInset}px`,
                        '--start-width': `${overlay.startWidth}px`
                    }
                }}
            >
                ${layer !== undefined && highlight(layer)}
                ${content}
            </div>
        `;
    },
    { highlight: GROUP_HIGHLIGHT }
);
