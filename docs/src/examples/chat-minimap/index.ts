import { reactive, ReactiveArray } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { chatMinimap } from '@esportsplus/ui/components';
import type { ChatMinimapSide, ChatMinimapTurn } from '@esportsplus/ui/components/chat-minimap';
import { CONVERSATION, FOLLOW_UPS, long, turns, type Exchange } from 'docs/examples/chat-minimap/data';
import type { Entry } from 'docs/types';
import 'docs/examples/chat-minimap/scss/index.scss';


// Nothing scrolls here, so three turns stand in for the part of the thread in view; picking a line moves them there.
function rail(data: ChatMinimapTurn[], start: number, side: ChatMinimapSide = 'right') {
    let state = reactive({ end: start + 3, start });

    return html`
        <div class='chat-minimap-demo ${`chat-minimap-demo--${side}`}'>
            ${chatMinimap({ side, state, turns: data })}
            <span class='chat-minimap-demo-status'>
                ${() => `turns ${state.start + 1}–${state.end} of ${data.length} in view`}
            </span>
        </div>
    `;
}

function thread() {
    let asked = 0,
        exchanges = new ReactiveArray<Exchange>(CONVERSATION),
        state = reactive({ end: 0, start: 0 }),
        spy = chatMinimap.spy({ state, turns: exchanges }),
        waiting = reactive({ done: false });

    function ask() {
        let next = FOLLOW_UPS[asked++];

        if (!next) {
            return;
        }

        exchanges.push(next);
        waiting.done = asked >= FOLLOW_UPS.length;
        // Waits for the new turn to render, then scrolls to it.
        spy.scrollTo(exchanges.length - 1);
    }

    return html`
        <div class='chat-minimap-thread'>
            <div class='chat-minimap-thread-scroll' ${spy.root}>
                ${html.reactive(exchanges, (exchange) => html`
                    <section class='chat-minimap-thread-turn' ${spy.turn(exchange)}>
                        <p class='chat-minimap-thread-question'>${exchange.question}</p>
                        <p class='chat-minimap-thread-answer'>${exchange.description}</p>
                    </section>
                `)}
            </div>

            <div class='chat-minimap-thread-rail'>
                ${chatMinimap({ onnavigate: spy.scrollTo, side: 'left', state, turns: exchanges })}
            </div>

            <button class='button chat-minimap-thread-ask' type='button' ${{ disabled: () => waiting.done, onclick: ask }}>
                ${() => waiting.done ? 'No more follow-ups' : 'Ask a follow-up'}
            </button>
        </div>
    `;
}


export default {
    name: 'chat-minimap',
    variants: [
        {
            render: () => rail(turns(), 2),
            title: 'default'
        },
        {
            render: () => rail(turns(), 2, 'left'),
            title: "side: 'left' (lines align right, the card opens left)"
        },
        {
            render: () => rail(long(), 20),
            title: 'long thread (50 turns)'
        },
        {
            render: thread,
            title: 'scroll spy: lines follow the turns in view, and the rail grows with the thread'
        }
    ]
} satisfies Entry;
