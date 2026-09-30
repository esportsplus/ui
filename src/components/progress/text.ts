import { html, type Attributes } from '@esportsplus/template';
import { effect, reactive } from '@esportsplus/reactivity';
import check from '@esportsplus/ui/svg/check.svg';


type A = Attributes & {
    doneLabel?: string;
    label: string;
    state?: State;
};

type State = {
    // 0 to 100.
    value: number;
};


const DAMPING = 20;

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const REST = 0.01;

const STIFFNESS = 90;

// The tens column starts blank, so 7% never reads as 07%.
const TENS = [' ', '1', '2', '3', '4', '5', '6', '7', '8', '9'];


function clamp(value: number) {
    return Math.min(100, Math.max(0, value));
}

function clip(value: number) {
    return `inset(0 ${Math.max(0, 100 - value).toFixed(2)}% 0 0)`;
}

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function roll(strip: string[], index: () => number) {
    return html`
        <span class='progress-text-roll'>
            <span class='progress-text-strip' style='${() => `translate: 0 ${-index() * 10}%`}'>
                ${strip.map((digit) => html`<span>${digit}</span>`)}
            </span>
        </span>
    `;
}


export default ({ doneLabel = 'Done', label, state = reactive({ value: 0 }), ...attributes }: A) => {
    let frame = 0,
        ink = reactive({ position: clamp(state.value) }),
        position = ink.position,
        stop: VoidFunction | undefined,
        target = position,
        time = 0,
        velocity = 0;

    function done() {
        return percent() >= 100;
    }

    function percent() {
        return Math.round(clamp(state.value));
    }

    // Progress arrives in uneven jumps; a spring turns them into one steady pour of ink and keeps its speed when
    // the next jump lands mid-glide.
    function step(now: number) {
        let elapsed = Math.min(64, now - time);

        time = now;

        for (let i = 0; i < elapsed; i++) {
            velocity += (STIFFNESS * (target - position) - DAMPING * velocity) / 1000;
            position += velocity / 1000;
        }

        if (Math.abs(velocity) < REST && Math.abs(target - position) < REST) {
            frame = 0;
            position = target;
            velocity = 0;
        }
        else {
            frame = requestAnimationFrame(step);
        }

        ink.position = position;
    }

    return html`
        <div
            aria-label='${label}'
            aria-valuemax='100'
            aria-valuemin='0'
            aria-valuenow='${percent}'
            aria-valuetext='${() => done() ? doneLabel : `${percent()}%`}'
            class='progress-text ${() => done() && '--done'}'
            role='progressbar'
            ${attributes}
            ${{
                onconnect: () => {
                    stop = effect(() => {
                        target = clamp(state.value);

                        if (reduced()) {
                            cancelAnimationFrame(frame);
                            frame = 0;
                            position = target;
                            velocity = 0;
                            ink.position = position;

                            return;
                        }

                        if (!frame) {
                            time = performance.now();
                            frame = requestAnimationFrame(step);
                        }
                    });
                },
                ondisconnect: () => {
                    cancelAnimationFrame(frame);
                    frame = 0;
                    stop?.();
                }
            }}
        >
            <span aria-hidden='true' class='progress-text-labels'>
                <span class='progress-text-label'>
                    <span class='progress-text-track'>${label}</span>
                    <span class='progress-text-ink' style='${() => `clip-path: ${clip(ink.position)}`}'>
                        ${label}
                    </span>
                </span>
                <span class='progress-text-done'>
                    <svg class='progress-text-check'><use href='#${check}' /></svg>
                    ${doneLabel}
                </span>
            </span>

            <span aria-hidden='true' class='progress-text-percent'>
                ${roll(TENS, () => Math.floor((percent() % 100) / 10))}
                ${roll(DIGITS, () => percent() % 10)}
                <span>%</span>
            </span>

            <span aria-live='polite' class='progress-text-sr'>${() => done() ? doneLabel : ''}</span>
        </div>
    `;
};

export type { State as ProgressTextState };
