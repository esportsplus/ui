import { onCleanup, reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { observer } from '~/shared/resize';


const ITEM = 'field-tag-item';


// Wraps a control and the items floating over it. An item before the control takes the start, one after it the end;
// the control's padding makes room for each, and only layout knows how big an item is, so they're measured here.
export default component(
    function(this: { attributes?: Attributes } | void, attributes: Attributes, content: Renderable<unknown>) {
        let element: HTMLElement | undefined,
            state = reactive({ endInset: 0, endWidth: 0, startInset: 0, startWidth: 0 });

        // Items on one side share its inset and room: the widest sets the room, the tallest the inset, which matches
        // the gap above and below it so the item sits evenly inside the control.
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

                if (!child.classList.contains(ITEM)) {
                    before = false;
                    continue;
                }

                let rect = child.getBoundingClientRect(),
                    side = before ? start : end;

                side.height = Math.max(side.height, rect.height);
                side.width = Math.max(side.width, rect.width);
            }

            state.endInset = end.width ? Math.max(0, (height - end.height) / 2) : 0;
            state.endWidth = end.width;
            state.startInset = start.width ? Math.max(0, (height - start.height) / 2) : 0;
            state.startWidth = start.width;
        }

        return html`
            <div
                class='field-tag'
                ${this?.attributes}
                ${attributes}
                ${{
                    onconnect: (el: HTMLElement) => {
                        let resize = observer(measure);

                        element = el;
                        measure();
                        resize.observe(el);

                        for (let i = 0, n = el.children.length; i < n; i++) {
                            if (el.children[i].classList.contains(ITEM)) {
                                resize.observe(el.children[i]);
                            }
                        }

                        onCleanup(resize.disconnect);
                    },
                    style: () => ({
                        '--end-inset': `${state.endInset}px`,
                        '--end-width': `${state.endWidth}px`,
                        '--start-inset': `${state.startInset}px`,
                        '--start-width': `${state.startWidth}px`
                    })
                }}
            >
                ${content}
            </div>
        `;
    }
);
