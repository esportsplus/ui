import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { carousel3d } from '@esportsplus/ui';
import './carousel-3d.scss';


let items = [
    { note: 'Feedback lands on press.', title: 'Response' },
    { note: 'Content stays under the finger.', title: 'Tracking' },
    { note: 'Grab it mid-flight.', title: 'Interruption' },
    { note: 'Land where the flick was heading.', title: 'Momentum' },
    { note: 'Soft edges, never walls.', title: 'Resistance' },
    { note: 'Behaviour, not a timeline.', title: 'Springs' },
    { note: 'Bounce only after a throw.', title: 'Restraint' },
    { note: 'Leave the way you came.', title: 'Consistency' }
];


export default {
    name: 'carousel-3d',
    variants: [
        {
            render: () => carousel3d({ items, label: 'Motion principles' }),
            title: 'motion principles'
        },
        {
            render: () => {
                let state = reactive({ active: 0 });

                return html`
                    <div class='carousel-3d-demo'>
                        ${carousel3d({ items, label: 'Controlled ring', state })}
                        <div class='carousel-3d-demo-jumps'>
                            ${items.map((item, i) => html`
                                <button
                                    class='carousel-3d-demo-jump ${() => state.active === i && '--active'}'
                                    type='button'
                                    onclick='${() => state.active = i}'
                                >
                                    ${item.title}
                                </button>
                            `)}
                        </div>
                    </div>
                `;
            },
            title: 'controlled state'
        },
        {
            render: () => carousel3d({
                items: items.slice(0, 5),
                label: 'Five cards',
                style: '--card-height: 160px; --card-width: 132px; --gap: 16px; --stage-height: 210px;'
            }),
            title: 'compact, five cards'
        }
    ]
};
