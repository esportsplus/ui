import { html } from '@esportsplus/template';
import { typewriterRetype } from '@esportsplus/ui';
import './typewriter-retype.scss';


let prefix = 'Build interfaces that feel',
    words = ['right', 'fast', 'alive', 'effortless'];


export default {
    name: 'typewriter-retype',
    variants: [
        {
            render: () => html`<p class='typewriter-retype-demo'>${typewriterRetype({ prefix, words })}</p>`,
            title: 'select and retype'
        },
        {
            render: () => html`
                <p class='typewriter-retype-demo'>
                    ${typewriterRetype({ class: 'typewriter-retype--block typewriter-retype--hard', prefix, words })}
                </p>
            `,
            title: 'block caret, hard blink'
        },
        {
            render: () => html`
                <p class='typewriter-retype-demo'>
                    ${typewriterRetype({ class: 'typewriter-retype--underscore', prefix, words })}
                </p>
            `,
            title: 'underscore caret'
        },
        {
            render: () => html`
                <p class='typewriter-retype-demo'>
                    ${typewriterRetype({
                        class: 'typewriter-retype--glow',
                        prefix: 'Deploy to',
                        style: '--caret-color: var(--color-blue-400); --selection-color: oklch(from var(--color-blue-400) l c h / 0.2);',
                        words: ['production', 'staging', 'the edge']
                    })}
                </p>
            `,
            title: 'glow, tinted selection'
        }
    ]
};
