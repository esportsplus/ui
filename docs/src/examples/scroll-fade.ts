import { html } from '@esportsplus/template';
import { scrollFade } from '@esportsplus/ui';
import './scroll-fade.scss';


function article() {
    return html`
        <article class='scroll-fade-demo-article'>
            <h2>ASCII Effect</h2>
            <p>Render images as responsive ASCII artwork with image, flow, and glitch variations. Content scrolling under the edges dissolves into a soft blur instead of being cut off by a hard line.</p>
            <h3>Installation</h3>
            <p>Install the package and import the component where you need it. There is nothing to configure: sensible defaults cover most layouts, and every value is exposed as a CSS variable.</p>
            <h3>Usage</h3>
            <p>Wrap any scrolling content. The edge sits over the viewport, washing it with the page colour and blurring what is behind it; a mask fades the whole treatment in toward the edge.</p>
            <p>Because the blur is a backdrop filter, it follows whatever is underneath: text, images, code blocks. Nothing is duplicated or re-rendered.</p>
            <h3>Props</h3>
            <p>Size controls how tall the fade is. Blur controls how soft the content becomes at the very edge. Progressive stacks several layers so the blur ramps up smoothly rather than switching on at one strength.</p>
            <p>Auto hides an edge while you are scrolled all the way to it, so nothing is faded when nothing is hidden.</p>
            <h3>Accessibility</h3>
            <p>The edges are decorative and hidden from assistive technology. They never intercept the pointer, so links and selection underneath keep working.</p>
            <p>Keep scrolling to watch this paragraph drift out through the top edge while the next one rises through the bottom.</p>
        </article>
    `;
}


export default {
    name: 'scroll-fade',
    variants: [
        {
            render: () => html`${scrollFade({ class: 'scroll-fade-demo' }, article())}`,
            title: 'componentry docs panel (both edges)'
        },
        {
            render: () => html`${scrollFade({ auto: true, class: 'scroll-fade-demo', edges: 'bottom' }, article())}`,
            title: 'bottom only, hides at the end'
        },
        {
            render: () => html`${scrollFade({ auto: true, blur: 8, class: 'scroll-fade-demo', progressive: true, size: 140 }, article())}`,
            title: 'progressive blur, auto edges'
        },
        {
            render: () => html`
                <div class='scroll-fade-demo scroll-fade-demo--custom'>
                    <div class='scroll-fade-demo-scroll'>${article()}</div>
                    ${scrollFade.edge({ side: 'bottom' })}
                </div>
            `,
            title: 'standalone edge (position: fixed with fixed: true for full pages)'
        }
    ]
};
