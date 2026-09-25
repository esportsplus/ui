import { html } from '@esportsplus/template';
import { scrollVelocity } from '@esportsplus/ui';
import './scroll-velocity.scss';


let images = [
    'https://picsum.photos/seed/velocity-1/480/320',
    'https://picsum.photos/seed/velocity-2/480/320',
    'https://picsum.photos/seed/velocity-3/480/320',
    'https://picsum.photos/seed/velocity-4/480/320'
];


function photos(offset: number) {
    return () => html`
        ${[...images.slice(offset), ...images.slice(0, offset)].map((src) => html`
            <img alt='' class='scroll-velocity-demo-image' decoding='async' height='160' loading='lazy' src='${src}' width='240' />
        `)}
    `;
}


export default {
    name: 'scroll-velocity',
    variants: [
        {
            render: () => html`
                <div class='scroll-velocity-demo'>
                    ${scrollVelocity({ class: 'scroll-velocity-demo-text' }, [
                        scrollVelocity.row({ content: 'Velocity Scroll', direction: 1, velocity: 20 }),
                        scrollVelocity.row({ content: 'Velocity Scroll', direction: -1, velocity: 20 })
                    ])}
                </div>
            `,
            title: 'text (scroll the page to speed it up)'
        },
        {
            render: () => html`
                <div class='scroll-velocity-demo scroll-velocity-demo--images'>
                    ${scrollVelocity([
                        scrollVelocity.row({ class: 'scroll-velocity-demo-row', content: photos(0), direction: 1, velocity: 6 }),
                        scrollVelocity.row({ class: 'scroll-velocity-demo-row', content: photos(2), direction: -1, velocity: 6 })
                    ])}
                </div>
            `,
            title: 'images'
        },
        {
            render: () => html`
                <div class='scroll-velocity-demo'>
                    ${scrollVelocity.row({ class: 'scroll-velocity-demo-text scroll-velocity-demo-text--small', content: 'Steady drift, ignores scrolling ·', reactivity: false, velocity: 8 })}
                </div>
            `,
            title: 'without scroll reactivity'
        }
    ]
};
