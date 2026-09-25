import { reactive } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import './agent.scss';


type Run = (onComplete: VoidFunction) => Renderable<unknown>;


const icon = (path: string) => html`
    <svg viewBox='0 0 24 24' fill='currentColor'><path d='${path}' /></svg>
`;

const icons = {
    code: () => icon('M15 4H5V20H19V8H15V4ZM3 2.9918C3 2.44405 3.44749 2 3.9985 2H16L20.9997 7L21 20.9925C21 21.5489 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5447 3 21.0082V2.9918ZM17.6569 12L14.1213 15.5355L12.7071 14.1213L14.8284 12L12.7071 9.87868L14.1213 8.46447L17.6569 12ZM6.34315 12L9.87868 8.46447L11.2929 9.87868L9.17157 12L11.2929 14.1213L9.87868 15.5355L6.34315 12Z'),
    idea: () => icon('M9.97308 18H11V13H13V18H14.0269C14.1589 16.7984 14.7721 15.8065 15.7676 14.7226C15.8797 14.6006 16.5988 13.8564 16.6841 13.7501C17.5318 12.6931 18 11.385 18 10C18 6.68629 15.3137 4 12 4C8.68629 4 6 6.68629 6 10C6 11.3843 6.46774 12.6917 7.31462 13.7484C7.40004 13.855 8.12081 14.6012 8.23154 14.7218C9.22766 15.8064 9.84103 16.7984 9.97308 18ZM10 20V21H14V20H10ZM5.75395 14.9992C4.65645 13.6297 4 11.8915 4 10C4 5.58172 7.58172 2 12 2C16.4183 2 20 5.58172 20 10C20 11.8925 19.3428 13.6315 18.2443 15.0014C17.624 15.7748 16 17 16 18.5V21C16 22.1046 15.1046 23 14 23H10C8.89543 23 8 22.1046 8 21V18.5C8 17 6.37458 15.7736 5.75395 14.9992Z'),
    react: () => html`
        <svg viewBox='0 0 24 24' fill='none' stroke='#61dafb' stroke-width='1.6'>
            <ellipse cx='12' cy='12' rx='10' ry='4' />
            <ellipse cx='12' cy='12' rx='10' ry='4' transform='rotate(60 12 12)' />
            <ellipse cx='12' cy='12' rx='10' ry='4' transform='rotate(120 12 12)' />
            <circle cx='12' cy='12' r='1.8' fill='#61dafb' stroke='none' />
        </svg>
    `,
    search: () => icon('M18.031 16.6168L22.3137 20.8995L20.8995 22.3137L16.6168 18.031C15.0769 19.263 13.124 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20 13.124 19.263 15.0769 18.031 16.6168ZM16.0247 15.8748C17.2475 14.6146 18 12.8956 18 11C18 7.1325 14.8675 4 11 4C7.1325 4 4 7.1325 4 11C4 14.8675 7.1325 18 11 18C12.8956 18 14.6146 17.2475 15.8748 16.0247L16.0247 15.8748Z')
};

// Sending starts a fresh run; the answer waits for the log's onComplete.
const chat = (prompt: string, answer: string[], run: Run) => {
    let state = reactive({ answered: false, turn: 0, working: false }),
        timer: ReturnType<typeof setInterval> | undefined;

    return html`
        <div class='agent-chat'>
            <div
                class='agent-chat-thread --scrollbar'
                ${{
                    onconnect: (element: HTMLElement) => {
                        timer = setInterval(() => element.scrollTo({ behavior: 'smooth', top: element.scrollHeight }), 260);
                    },
                    ondisconnect: () => clearInterval(timer)
                }}
            >
                ${() => state.turn === 0
                    ? html`<p class='agent-chat-empty'>Send the message to start the run.</p>`
                    : html`
                        <div class='agent-chat-bubble'>${prompt}</div>
                        ${run(() => {
                            state.answered = true;
                            state.working = false;
                        })}
                    `}
                ${() => state.answered && html`
                    <div class='agent-chat-answer'>${answer.map((line) => html`<p>${line}</p>`)}</div>
                `}
            </div>

            <div class='agent-chat-composer'>
                <span class='agent-chat-prompt'>${() => state.working ? '' : prompt}</span>
                <div
                    class='button button--primary ${() => state.working && '--disabled'}'
                    style='--width: auto;'
                    onclick='${() => {
                        if (state.working) {
                            return;
                        }

                        state.answered = false;
                        state.turn++;
                        state.working = true;
                    }}'
                >
                    send
                </div>
            </div>
        </div>
    `;
};

const replay = (run: Run, modifier = '') => {
    let state = reactive({ done: false, turn: 0 });

    return html`
        <div class='agent-demo ${modifier}'>
            ${() => {
                state.turn;

                return run(() => state.done = true);
            }}
            ${() => state.done && html`
                <div
                    class='button button--tertiary agent-demo-replay'
                    style='--width: auto;'
                    onclick='${() => {
                        state.done = false;
                        state.turn++;
                    }}'
                >
                    run again
                </div>
            `}
        </div>
    `;
};


export { chat, icons, replay };
