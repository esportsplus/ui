import { html, type Attributes } from '@esportsplus/template';
import { effect, reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


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
        <span class='text-progress-roll'>
            <span class='text-progress-strip' style='${() => `translate: 0 ${-index() * 10}%`}'>
                ${strip.map((digit) => html`<span>${digit}</span>`)}
            </span>
        </span>
    `;
}


export default ({ doneLabel = 'Done', label, state = reactive({ value: 0 }), ...attributes }: A) => {
    let frame = 0,
        ink: HTMLElement | undefined,
        position = clamp(state.value),
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

        if (ink) {
            ink.style.clipPath = clip(position);
        }
    }

    return html`
        <div
            aria-label='${label}'
            aria-valuemax='100'
            aria-valuemin='0'
            aria-valuenow='${percent}'
            aria-valuetext='${() => done() ? doneLabel : `${percent()}%`}'
            class='text-progress ${() => done() && '--done'}'
            role='progressbar'
            ${attributes}
            ${{
                onconnect: (element: HTMLElement) => {
                    ink = element.querySelector<HTMLElement>('.text-progress-ink') ?? undefined;
                    stop = effect(() => {
                        target = clamp(state.value);

                        if (reduced()) {
                            cancelAnimationFrame(frame);
                            frame = 0;
                            position = target;
                            velocity = 0;

                            if (ink) {
                                ink.style.clipPath = clip(position);
                            }

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
            <span aria-hidden='true' class='text-progress-labels'>
                <span class='text-progress-label'>
                    <span class='text-progress-track'>${label}</span>
                    <span class='text-progress-ink' style='${`clip-path: ${clip(position)}`}'>${label}</span>
                </span>
                <span class='text-progress-done'>
                    <svg class='text-progress-check' fill='none' viewBox='0 0 16 16'>
                        <path
                            d='m3.5 8.5 3 3 6-7'
                            pathLength='1'
                            stroke='currentColor'
                            stroke-dasharray='1'
                            stroke-linecap='round'
                            stroke-linejoin='round'
                            stroke-width='2'
                        />
                    </svg>
                    ${doneLabel}
                </span>
            </span>

            <span aria-hidden='true' class='text-progress-percent'>
                ${roll(TENS, () => Math.floor((percent() % 100) / 10))}
                ${roll(DIGITS, () => percent() % 10)}
                <span>%</span>
            </span>

            <span aria-live='polite' class='text-progress-sr'>${() => done() ? doneLabel : ''}</span>
        </div>
    `;
};

export type { State as TextProgressState };
