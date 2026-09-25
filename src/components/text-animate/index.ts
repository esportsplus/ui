import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes & {
    // Label the whole text once for assistive tech and hide the pieces; off when the text is decorative.
    accessible?: boolean;
    animation?: Animation;
    by?: By;
    // Seconds before the first segment starts.
    delay?: number;
    // Seconds the stagger is spread across, however many segments there are.
    duration?: number;
    // Stays shown after the first reveal instead of hiding again whenever it scrolls out.
    once?: boolean;
    // Waits until the text scrolls into view; otherwise it plays as soon as it is mounted.
    startOnView?: boolean;
    state?: State;
};

type Animation =
    | 'blurIn'
    | 'blurInDown'
    | 'blurInUp'
    | 'fadeIn'
    | 'scaleDown'
    | 'scaleUp'
    | 'slideDown'
    | 'slideLeft'
    | 'slideRight'
    | 'slideUp';

type By = 'character' | 'line' | 'text' | 'word';

type State = {
    show: boolean;
};


// Letters of a word share a no-wrap group, otherwise a line could break mid-word between two letters. Spaces still
// count toward the stagger but render as plain text so lines can break there.
function characters(text: string) {
    let i = 0;

    return segments(text, 'word').map((part) => {
        // Spread keeps surrogate pairs (emoji) together.
        let chars = [...part];

        if (!part.trim()) {
            i += chars.length;
            return part;
        }

        return html`<span class='text-animate-word'>${chars.map((char) => segment(char, i++))}</span>`;
    });
}

function segment(text: string, i: number) {
    return html`<span class='text-animate-segment' style='${`--i: ${i}`}'>${text}</span>`;
}

function segments(text: string, by: By) {
    if (by === 'line') {
        return text.split('\n');
    }

    if (by === 'text') {
        return [text];
    }

    // Whitespace stays its own segment so spacing survives inline-block layout.
    return text.split(/(\s+)/).filter(Boolean);
}


export default component<A, string>(
    function(this, {
        accessible = true,
        animation = 'fadeIn',
        by = 'word',
        delay = 0,
        duration = 0.3,
        once = false,
        startOnView = true,
        state = reactive({ show: false }),
        ...attributes
    }, content) {
        let frame = 0,
            observer: IntersectionObserver | undefined,
            parts = by === 'character' ? [] : segments(content, by),
            total = by === 'character' ? [...content].length : parts.length;

        return html`
            <span
                class='text-animate text-animate--${animation} text-animate--${by}'
                style='${`--delay: ${delay}s; --segments: ${total}; --stagger: ${duration / Math.max(1, total)}s;`}'
                ${this?.attributes}
                ${attributes}
                ${{
                    class: () => state.show && '--show',
                    onconnect: (element: HTMLElement) => {
                        // Stay hidden for one frame first, so the first reveal transitions instead of snapping.
                        if (!startOnView) {
                            frame = requestAnimationFrame(() => {
                                frame = requestAnimationFrame(() => state.show = true);
                            });
                            return;
                        }

                        observer = new IntersectionObserver((entries) => {
                            let entry = entries[entries.length - 1];

                            if (entry.isIntersecting) {
                                state.show = true;

                                if (once) {
                                    observer?.disconnect();
                                }
                            }
                            else if (!once) {
                                state.show = false;
                            }
                        });
                        observer.observe(element);
                    },
                    ondisconnect: () => {
                        cancelAnimationFrame(frame);
                        observer?.disconnect();
                    }
                }}
            >
                ${accessible && html`<span class='text-animate-sr'>${content}</span>`}
                <span aria-hidden='${accessible && 'true'}' class='text-animate-segments'>
                    ${by === 'character' ? characters(content) : parts.map(segment)}
                </span>
            </span>
        `;
    }
);

export type { Animation as TextAnimateAnimation, By as TextAnimateBy, State as TextAnimateState };
