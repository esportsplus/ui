import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { textAnimate } from '@esportsplus/ui';
import './text-animate.scss';


type Options = Parameters<typeof textAnimate>[0];


// Re-mounts the text on each press so the entrance plays again from hidden.
function replay(options: Options, text: string, large = false) {
    let ui = reactive({ run: 0 });

    return html`
        <div class='text-animate-demo'>
            <div class='text-animate-demo-text ${large && 'text-animate-demo-text--large'}'>
                ${() => ui.run >= 0 && textAnimate({ once: true, ...options }, text)}
            </div>
            <button class='button button--tertiary' style='--width: auto;' type='button' onclick='${() => ui.run++}'>
                Replay
            </button>
        </div>
    `;
}


export default {
    name: 'text-animate',
    variants: [
        {
            render: () => replay({ animation: 'blurInUp', by: 'character' }, 'Blur in by character', true),
            title: 'blur in up, by character'
        },
        {
            render: () => replay({ animation: 'blurIn', by: 'text' }, 'Blur in by text', true),
            title: 'blur in, by text'
        },
        {
            render: () => replay({ animation: 'blurInUp', by: 'word' }, 'Blur in up by word', true),
            title: 'blur in up, by word'
        },
        {
            render: () => replay({ animation: 'blurInDown', by: 'character' }, 'Blur in down by character', true),
            title: 'blur in down, by character'
        },
        {
            render: () => replay({ animation: 'fadeIn', by: 'line', delay: 0.2, duration: 1 }, 'Fade in by line\nas you scroll down\nthe page', true),
            title: 'fade in, by line'
        },
        {
            render: () => replay({ animation: 'slideUp', by: 'word' }, 'Slide up by word', true),
            title: 'slide up, by word'
        },
        {
            render: () => replay({ animation: 'slideDown', by: 'word' }, 'Slide down by word', true),
            title: 'slide down, by word'
        },
        {
            render: () => replay({ animation: 'slideLeft', by: 'character' }, 'Slide left by character', true),
            title: 'slide left, by character'
        },
        {
            render: () => replay({ animation: 'slideRight', by: 'character' }, 'Slide right by character', true),
            title: 'slide right, by character'
        },
        {
            render: () => replay({ animation: 'scaleUp', by: 'text' }, 'Scale up by text', true),
            title: 'scale up, by text (spring)'
        },
        {
            render: () => replay({ animation: 'scaleDown', by: 'word' }, 'Scale down by word', true),
            title: 'scale down, by word (spring)'
        },
        {
            render: () => html`
                <div class='text-animate-demo-text'>
                    ${textAnimate({ animation: 'blurInUp', by: 'word', duration: 0.6 }, 'Scroll this out of view and back: without "once" the words leave in reverse and return each time.')}
                </div>
            `,
            title: 'replays on scroll (no once)'
        }
    ]
};
