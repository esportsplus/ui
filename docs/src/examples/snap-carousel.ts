import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { snapCarousel } from '@esportsplus/ui';
import './snap-carousel.scss';


let bars = [26, 42, 34, 52, 38, 46],
    slides = [
        { text: 'Starts fast, settles gently.', title: 'Ease out', visual: ease },
        { text: 'Keeps its velocity when interrupted.', title: 'Spring', visual: spring },
        { text: 'Forty milliseconds between each item.', title: 'Stagger', visual: stagger },
        { text: 'Bridges two states into one motion.', title: 'Blur', visual: blur },
        { text: 'Grows from where you pointed.', title: 'Origin', visual: origin },
        { text: 'Often the best animation is none.', title: 'Restraint', visual: restraint }
    ];


function blur() {
    return html`
        <div class='snap-carousel-demo-pairs'>
            ${[['fade', ''], ['fade + blur', ' snap-carousel-demo-soft']].map(([name, soft]) => html`
                <div class='snap-carousel-demo-pair'>
                    <div class='snap-carousel-demo-morph'>
                        <span class='snap-carousel-demo-from${soft}'></span>
                        <span class='snap-carousel-demo-to${soft}'></span>
                    </div>
                    <span class='snap-carousel-demo-legend'>${name}</span>
                </div>
            `)}
        </div>
    `;
}

function ease() {
    return html`
        <div class='snap-carousel-demo-rows'>
            ${[['linear', 'snap-carousel-demo-linear'], ['ease-out', 'snap-carousel-demo-eased']].map(([name, dot]) => html`
                <div class='snap-carousel-demo-row'>
                    <span class='snap-carousel-demo-legend'>${name}</span>
                    <div class='snap-carousel-demo-lane'>
                        <span class='snap-carousel-demo-track'></span>
                        <span class='snap-carousel-demo-dot ${dot}'></span>
                    </div>
                </div>
            `)}
        </div>
    `;
}

function origin() {
    return html`
        <div class='snap-carousel-demo-stage'>
            <span class='snap-carousel-demo-trigger'></span>
            <div class='snap-carousel-demo-panel'>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
}

function restraint() {
    return html`
        <div class='snap-carousel-demo-stage'>
            <span class='snap-carousel-demo-track'></span>
            <span class='snap-carousel-demo-dot snap-carousel-demo-still'></span>
            <span class='snap-carousel-demo-legend snap-carousel-demo-zero'>0ms</span>
        </div>
    `;
}

function spring() {
    return html`
        <div class='snap-carousel-demo-stage'>
            <span class='snap-carousel-demo-track'></span>
            <span class='snap-carousel-demo-tick snap-carousel-demo-target-b'></span>
            <span class='snap-carousel-demo-tick snap-carousel-demo-target-a'></span>
            <span class='snap-carousel-demo-dot snap-carousel-demo-spring'></span>
        </div>
    `;
}

function stagger() {
    return html`
        <div class='snap-carousel-demo-bars'>
            ${bars.map((height, i) => html`
                <span class='snap-carousel-demo-bar' style='${`animation-delay: ${i * 40}ms; height: ${height}px;`}'></span>
            `)}
        </div>
    `;
}


export default {
    name: 'snap-carousel',
    variants: [
        {
            render: () => snapCarousel({
                label: 'Motion principles',
                slides: slides.map(({ text, title, visual }) => ({ text, title, visual: visual() }))
            }),
            title: 'motion principles'
        },
        {
            render: () => {
                let state = reactive({ active: 0, end: false, start: true });

                return html`
                    <div class='snap-carousel-demo'>
                        ${snapCarousel({
                            label: 'Text only',
                            slides: slides.map(({ text, title }) => ({ text, title })),
                            state
                        })}
                        <span class='snap-carousel-demo-status'>
                            ${() => state.active === -1 ? 'between cards' : `card ${state.active + 1} centered`}
                        </span>
                    </div>
                `;
            },
            title: 'text only (observed state)'
        },
        {
            render: () => snapCarousel({
                label: 'Compact cards',
                slides: slides.map(({ text, title }) => ({ text, title })),
                style: '--card-height: 140px; --card-width: 200px; --focus-scale: 0.82; --max-width: 400px;'
            }),
            title: 'compact'
        }
    ]
};
