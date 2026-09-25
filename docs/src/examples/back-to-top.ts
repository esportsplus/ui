import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { backToTop } from '@esportsplus/ui';
import './back-to-top.scss';


const ESSAY = [
    'Most tools try to do everything. The ones I keep coming back to do one thing, and they do it the same way every time.',
    'A good pencil doesn\'t ask what you want to draw. It gets out of the way, and the line comes out where your hand meant it to.',
    'Software rarely works like that. Every release adds a setting, every setting adds a question, and after a while the tool is mostly questions.',
    'The alternative isn\'t fewer features for their own sake. It\'s deciding what the thing is for, and letting that answer most of the questions before anyone has to ask them.',
    'When a tool knows what it\'s for, the details start to line up. The button is where your thumb already is. The default is the choice you would have made.',
    'None of this shows up in a feature list. It shows up as the absence of friction, which is hard to sell and easy to feel.',
    'It also shows up in what doesn\'t happen. No dialog asking if you\'re sure, because the action can be undone. No empty state, because the first screen already has something in it.',
    'Restraint like this is slow work. Adding is quick and feels like progress; taking away means knowing the thing well enough to see what it doesn\'t need.',
    'That\'s why the simplest tools are so often the oldest. They\'ve had time to lose everything that wasn\'t carrying weight.',
    'So the next time something feels simple, look closer. Somebody probably spent a long time deciding what to leave out.'
];


function essay(modifier: string, autoplay: boolean) {
    let frame = 0,
        scroller: HTMLElement | undefined,
        state = reactive({ jump: 0, visible: false }),
        timer: ReturnType<typeof setTimeout> | undefined;

    // Reads about two thirds of the way down, pauses, then heads back up.
    function loop() {
        if (!scroller) {
            return;
        }

        let el = scroller,
            from = el.scrollTop,
            start = performance.now(),
            to = (el.scrollHeight - el.clientHeight) * 0.7;

        function step(now: number) {
            let t = Math.min((now - start) / 2200, 1);

            el.scrollTop = from + (to - from) * (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

            if (t < 1) {
                frame = requestAnimationFrame(step);
            }
        }

        frame = requestAnimationFrame(step);
        timer = setTimeout(() => {
            state.jump++;
            timer = setTimeout(loop, 1900);
        }, 3000);
    }

    return html`
        <div class='back-to-top-demo'>
            <div
                class='back-to-top-demo-scroller'
                ${{
                    onconnect: () => {
                        if (autoplay && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
                            timer = setTimeout(loop, 300);
                        }
                    },
                    ondisconnect: () => {
                        cancelAnimationFrame(frame);
                        clearTimeout(timer);
                    },
                    onrender: (el: HTMLElement) => {
                        scroller = el;
                    }
                }}
            >
                <p class='back-to-top-demo-meta'>Essay · 4 min read</p>
                <h3 class='back-to-top-demo-title'>Notes on doing one thing well</h3>
                <div class='back-to-top-demo-body'>
                    ${ESSAY.map((paragraph) => html`<p>${paragraph}</p>`)}
                </div>
            </div>
            <div aria-hidden='true' class='back-to-top-demo-fade'></div>
            <div class='back-to-top-demo-corner'>
                ${backToTop({ class: modifier, state, target: () => scroller })}
            </div>
        </div>
    `;
}

function page() {
    let host: HTMLElement | undefined;

    // The docs shell scrolls an inner container rather than the window, so follow whichever ancestor actually scrolls.
    function scroller() {
        for (let node = host?.parentElement; node; node = node.parentElement) {
            let overflow = getComputedStyle(node).overflowY;

            if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) {
                return node;
            }
        }

        return undefined;
    }

    return html`
        <div
            class='back-to-top-demo-page'
            ${{
                onrender: (el: HTMLElement) => {
                    host = el;
                }
            }}
        >
            <p>Scroll this page: once you are past 12% of it, a fixed button appears in the bottom right corner. Leave <code>target</code> out and it follows the window.</p>
            ${backToTop({ class: 'back-to-top--fixed', target: scroller })}
        </div>
    `;
}


export default {
    name: 'back-to-top',
    variants: [
        {
            render: () => essay('', false),
            title: 'scroll container'
        },
        {
            render: () => essay('', true),
            title: 'programmatic jump'
        },
        {
            render: () => essay('back-to-top--dark', false),
            title: 'dark button'
        },
        {
            render: page,
            title: 'page (fixed)'
        }
    ]
};
