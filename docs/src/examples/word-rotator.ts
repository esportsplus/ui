import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { wordRotator } from '@esportsplus/ui';
import './word-rotator.scss';


let words = ['calm', 'fast', 'honest', 'alive'];


export default {
    name: 'word-rotator',
    variants: [
        {
            render: () => html`
                <h2 class='word-rotator-demo'>
                    Design that feels ${wordRotator({ class: 'word-rotator-demo-word', words })}
                </h2>
            `,
            title: 'headline'
        },
        {
            render: () => {
                let state = reactive({ index: 0, paused: false });

                return html`
                    <div class='word-rotator-demo-stack'>
                        <h2 class='word-rotator-demo'>
                            Design that feels ${wordRotator({ class: 'word-rotator-demo-word', interval: 1400, state, words })}
                        </h2>
                        <button class='button button--tertiary' style='--width: auto;' type='button' onclick='${() => state.paused = !state.paused}'>
                            ${() => state.paused ? 'resume' : 'pause (settles home)'}
                        </button>
                    </div>
                `;
            },
            title: 'quick interval, pausable'
        },
        {
            render: () => html`
                <p class='word-rotator-demo word-rotator-demo--small'>
                    Ship ${wordRotator({ class: 'word-rotator--accent', words: ['components', 'comments', 'contents', 'moments'] })} people remember.
                </p>
            `,
            title: 'inline, accent'
        }
    ]
};
