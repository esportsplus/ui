import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { typewriter } from '@esportsplus/ui';
import './scss/index.scss';


let lines = ['Build once.', 'Ship everywhere.', '@esportsplus/ui'],
    prefix = 'Build interfaces that feel',
    rotations = ['calm', 'fast', 'honest', 'alive'],
    words = ['right', 'fast', 'alive', 'effortless'];


export default {
    name: 'typewriter',
    variants: [
        {
            render: () => typewriter({}, lines),
            title: 'cycling text'
        },
        {
            render: () => typewriter({ class: 'typewriter--block typewriter--hard' }, lines),
            title: 'block caret, hard blink'
        },
        {
            render: () => typewriter({ class: 'typewriter--underscore' }, lines),
            title: 'underscore caret'
        },
        {
            render: () => html`<p class='typewriter-retype-demo'>${typewriter.retype({ prefix, words })}</p>`,
            title: 'select and retype'
        },
        {
            render: () => html`
                <p class='typewriter-retype-demo'>
                    ${typewriter.retype({ class: 'typewriter-retype--block typewriter-retype--hard', prefix, words })}
                </p>
            `,
            title: 'retype, block caret, hard blink'
        },
        {
            render: () => html`
                <p class='typewriter-retype-demo'>
                    ${typewriter.retype({ class: 'typewriter-retype--underscore', prefix, words })}
                </p>
            `,
            title: 'retype, underscore caret'
        },
        {
            render: () => html`
                <p class='typewriter-retype-demo'>
                    ${typewriter.retype({
                        prefix: 'Deploy to',
                        style: '--caret-color: var(--color-blue-400); --selection-color: oklch(from var(--color-blue-400) l c h / 0.2);',
                        words: ['production', 'staging', 'the edge']
                    })}
                </p>
            `,
            title: 'retype, tinted caret and selection'
        },
        {
            render: () => html`
                <h2 class='typewriter-rotate-demo'>
                    Design that feels ${typewriter.rotate({ class: 'typewriter-rotate-demo-word', words: rotations })}
                </h2>
            `,
            title: 'rotate'
        },
        {
            render: () => {
                let state = reactive({ index: 0, paused: false });

                return html`
                    <div class='typewriter-rotate-demo-stack'>
                        <h2 class='typewriter-rotate-demo'>
                            Design that feels ${typewriter.rotate({ class: 'typewriter-rotate-demo-word', interval: 1400, state, words: rotations })}
                        </h2>
                        <button class='button button--tertiary' style='--width: auto;' type='button' onclick='${() => state.paused = !state.paused}'>
                            ${() => state.paused ? 'resume' : 'pause (settles home)'}
                        </button>
                    </div>
                `;
            },
            title: 'rotate, quick interval, pausable'
        },
        {
            render: () => html`
                <p class='typewriter-rotate-demo typewriter-rotate-demo--small'>
                    Ship ${typewriter.rotate({ class: 'typewriter-rotate--accent', words: ['components', 'comments', 'contents', 'moments'] })} people remember.
                </p>
            `,
            title: 'rotate, inline, accent'
        }
    ]
};
