import { html, type Attributes } from '@esportsplus/template';
import { effect, reactive, untrack } from '@esportsplus/reactivity';
import clipboard from '~/components/clipboard';
import counter from '~/components/counter';
import form from '~/components/form';
import input from '~/components/input';
import './scss/index.scss';


type A = Attributes & {
    [WAITLIST_JOIN_INPUT]?: Parameters<typeof input>[0];
    linkBase?: string;
    onjoin?: (email: string) => void;
    product?: string;
    queue: QueuePerson[];
    skip?: number;
    state?: State;
    waiting: number;
};

type QueuePerson = { avatar?: string, id: string, name: string };

type State = {
    bumped: boolean;
    copied: boolean;
    email: string;
    status: 'idle' | 'joined' | 'joining';
    touched: boolean;
};


// Your face drops into its slot and lands with a small bounce (spring: visualDuration 0.4, bounce 0.3).
const DROP: KeyframeAnimationOptions = {
    duration: 595,
    easing: 'linear(0, 0.051, 0.165, 0.302, 0.452, 0.593, 0.717, 0.819, 0.896, 0.956, 0.997, 1.024, 1.038, 1.044, 1.044, 1.04, 1.035, 1.028, 1.022, 1.016, 1.011, 1.006, 1.003, 1.001, 1)'
};

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

// Long enough to show a real request is in flight, short enough not to wait on.
const JOIN_MS = 650;

const ME = 'me';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

// People shuffling along a line: slower than a UI transition so the eye can follow who moved where (spring: visualDuration 0.45, bounce 0.15).
const SHUFFLE: KeyframeAnimationOptions = {
    duration: 749,
    easing: 'linear(0, 0.058, 0.181, 0.331, 0.474, 0.602, 0.71, 0.796, 0.863, 0.912, 0.947, 0.97, 0.987, 0.996, 1.002, 1.005, 1.006, 1.006, 1.005, 1.004, 1.003, 1.003, 1.002, 1.001, 1)'
};

// Nine faces fill the strip on a desktop; on a phone the front few slide under the left fade, which reads as the line carrying on.
const SLOTS = 9;

const WAITLIST_JOIN_INPUT = Symbol.for('@esportsplus/ui/waitlist-join.input');


function face(person: QueuePerson) {
    if (person.avatar) {
        return html`<img alt='' class='waitlist-join-face-image' draggable='false' height='36' src='${person.avatar}' width='36' />`;
    }

    return html`
        <svg aria-hidden='true' class='waitlist-join-face-image' viewBox='0 0 36 36'>
            <circle cx='18' cy='14.5' r='6.5' />
            <path d='M5 36c1.5-8 6.5-12 13-12s11.5 4 13 12Z' />
        </svg>
    `;
}

function format(value: number) {
    return value.toLocaleString('en-US');
}

function problem(raw: string) {
    let email = raw.trim();

    if (!email) {
        return 'Enter your email to join.';
    }

    if (/\s/.test(email)) {
        return 'Emails cannot contain spaces.';
    }

    let at = email.lastIndexOf('@');

    if (at === -1) {
        return 'Add an @ and a domain, like sam@studio.com.';
    }

    if (at === 0) {
        return 'Add your name before the @.';
    }

    let domain = email.slice(at + 1);

    if (!domain) {
        return 'Add the domain after the @, like gmail.com.';
    }

    if (!/\.[^.]{2,}$/.test(domain)) {
        return `Finish the domain, like @${domain.replace(/\.+$/, '')}.com.`;
    }

    return '';
}

// A short, stable referral link from the address, no server needed.
function referral(email: string, base: string) {
    let hash = 0,
        local = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    for (let char of email) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }

    return `${base}/${local.slice(0, 12) || 'friend'}-${hash.toString(36).slice(0, 3)}`;
}

// Crossfades keyed text: the old line leaves quicker and travels less than the new one arrives.
function swap(container: HTMLElement, text: string) {
    let current = container.querySelector<HTMLElement>(':scope > :not([data-exiting])');

    if (current?.textContent === text) {
        return;
    }

    let next = document.createElement('span'),
        reduce = matchMedia(REDUCED_MOTION).matches;

    next.className = 'waitlist-join-swap';
    next.textContent = text;
    container.append(next);

    if (!current) {
        return;
    }

    let previous = current;

    previous.dataset.exiting = '';
    previous.animate(
        reduce ? { opacity: [1, 0] } : { filter: ['blur(0px)', 'blur(2px)'], opacity: [1, 0], translate: ['0 0', '0 -2px'] },
        { duration: 120, easing: EASE_OUT, fill: 'forwards' }
    ).onfinish = () => previous.remove();
    next.animate(
        reduce ? { opacity: [0, 1] } : { filter: ['blur(4px)', 'blur(0px)'], opacity: [0, 1], translate: ['0 4px', '0 0'] },
        { duration: 240, easing: EASE_OUT }
    );
}

function template(
    this: { attributes?: Partial<A> } | void,
    { linkBase = 'parcel.so/i', onjoin, product = 'Parcel', queue, skip = 5, state, waiting, ...attributes }: A
) {
    let copyButton: HTMLElement | undefined,
        defaults = this?.attributes,
        disposers: VoidFunction[] = [],
        emailInput: HTMLInputElement | undefined,
        // Your face only stays in view if the skip leaves someone in front of you.
        hop = Math.min(skip, SLOTS - 2),
        id = `waitlist-join-${Math.random().toString(36).slice(2, 8)}`,
        people = new Map<string, HTMLElement>(),
        position = reactive({ value: waiting + 1 }),
        s = state || reactive({ bumped: false, copied: false, email: '', status: 'idle' as State['status'], touched: false }),
        strip: HTMLElement | undefined,
        tail = queue.slice(-SLOTS),
        timers: ReturnType<typeof setTimeout>[] = [],
        ui = reactive({ round: 0 });

    function arrange(animate: boolean) {
        if (!strip) {
            return;
        }

        let before = new Map<HTMLElement, number>(),
            ids = line(),
            reduce = !animate || matchMedia(REDUCED_MOTION).matches;

        for (let [, element] of people) {
            if (!element.hidden && !element.hasAttribute('data-exiting')) {
                before.set(element, element.getBoundingClientRect().left);
            }
        }

        for (let [key, element] of people) {
            if (element.hidden || ids.includes(key) || element.hasAttribute('data-exiting')) {
                continue;
            }

            if (reduce && !animate) {
                element.hidden = true;
                continue;
            }

            // Leaves from where it stands while everyone else moves up.
            element.dataset.exiting = '';
            element.style.left = `${element.offsetLeft}px`;
            element.style.top = `${element.offsetTop}px`;
            element.animate(
                reduce ? { opacity: [1, 0] } : { filter: ['blur(0px)', 'blur(2px)'], opacity: [1, 0], transform: ['none', 'translateX(-12px)'] },
                { duration: 200, easing: EASE_OUT, fill: 'forwards' }
            ).onfinish = function(this: Animation) {
                delete element.dataset.exiting;
                element.hidden = true;
                element.style.left = '';
                element.style.top = '';
                this.cancel();
            };
        }

        for (let i = 0, n = ids.length; i < n; i++) {
            let element = people.get(ids[i])!;

            for (let animation of element.getAnimations()) {
                animation.cancel();
            }

            delete element.dataset.exiting;
            element.hidden = false;
            element.style.left = '';
            element.style.top = '';
            strip.append(element);
        }

        if (!animate) {
            return;
        }

        for (let i = 0, n = ids.length; i < n; i++) {
            let element = people.get(ids[i])!,
                from = before.get(element);

            if (from === undefined) {
                element.animate(
                    reduce ? { opacity: [0, 1] } : { filter: ['blur(4px)', 'blur(0px)'], opacity: [0, 1], transform: ['translateY(-20px)', 'none'] },
                    reduce ? { duration: 200, easing: EASE_OUT } : DROP
                );
                continue;
            }

            let dx = from - element.getBoundingClientRect().left;

            if (dx && !reduce) {
                element.animate({ translate: [`${dx}px 0`, '0 0'] }, SHUFFLE);
            }
        }
    }

    function bump() {
        if (s.bumped) {
            return;
        }

        s.bumped = true;
        position.value = waiting + 1 - skip;
        arrange(true);

        // Cutting the line: a small hop over the people you pass.
        if (!matchMedia(REDUCED_MOTION).matches) {
            people.get(ME)?.animate(
                { transform: ['translateY(0)', 'translateY(-10px)', 'translateY(0)'] },
                { duration: 450, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' }
            );
        }
    }

    function copy() {
        void clipboard.write(`https://${link()}`);
        s.copied = true;
        bump();
        timers.push(setTimeout(() => {
            s.copied = false;
        }, 1800));
    }

    function error() {
        return s.touched ? problem(s.email) : '';
    }

    function join() {
        s.touched = true;

        if (problem(s.email) || s.status !== 'idle') {
            emailInput?.focus();
            return;
        }

        s.status = 'joining';
        timers.push(setTimeout(() => {
            position.value = waiting + 1;
            s.status = 'joined';
            ui.round++;
            arrange(true);
            onjoin?.(s.email.trim());
            timers.push(setTimeout(() => copyButton?.focus(), 50));
        }, JOIN_MS));
    }

    function line() {
        if (s.status !== 'joined') {
            return tail.map((person) => person.id);
        }

        let rest = queue.slice(-(SLOTS - 1)).map((person) => person.id);

        rest.splice(rest.length - (s.bumped ? hop : 0), 0, ME);

        return rest;
    }

    function link() {
        return referral(s.email.trim(), linkBase);
    }

    function note() {
        let message = error();

        if (message) {
            return message;
        }

        if (s.status !== 'joined') {
            return 'One email when your invite is ready. Nothing else.';
        }

        return s.bumped
            ? `You jumped ${skip} spots. Every friend who joins moves you up again.`
            : `Skip ahead by sharing: your link moves you up ${skip} spots.`;
    }

    function register(key: string) {
        return (element: HTMLElement) => {
            people.set(key, element);
        };
    }

    function reset() {
        s.bumped = false;
        s.copied = false;
        s.email = '';
        s.status = 'idle';
        s.touched = false;
        arrange(true);
        timers.push(setTimeout(() => emailInput?.focus(), 50));
    }

    return html`
        <section
            aria-labelledby='${id}-title'
            class='waitlist-join'
            ${defaults}
            ${attributes}
            ${{
                class: () => s.status === 'joined' && '--joined',
                onconnect: (element: HTMLElement) => {
                    let count = element.querySelector<HTMLElement>('.waitlist-join-count'),
                        hint = element.querySelector<HTMLElement>('.waitlist-join-note');

                    emailInput = element.querySelector<HTMLInputElement>('.waitlist-join-input') ?? undefined;

                    if (count) {
                        disposers.push(effect(() => swap(count, s.status === 'joined' ? `${format(position.value - 1)} ahead of you` : `${format(waiting)} waiting`)));
                    }

                    if (hint) {
                        disposers.push(effect(() => swap(hint, note())));
                    }
                },
                ondisconnect: () => {
                    for (let i = 0, n = disposers.length; i < n; i++) {
                        disposers[i]();
                    }

                    for (let i = 0, n = timers.length; i < n; i++) {
                        clearTimeout(timers[i]);
                    }

                    disposers.length = 0;
                    timers.length = 0;
                }
            }}
        >
            <div class='waitlist-join-top'>
                <p class='waitlist-join-product'>${product} · Private beta</p>
                <button
                    class='button waitlist-join-reset'
                    type='button'
                    ${{
                        class: () => s.status === 'joined' && '--active',
                        inert: () => s.status !== 'joined',
                        onclick: reset
                    }}
                >
                    Not you?
                </button>
            </div>

            <h2 class='waitlist-join-title' id='${id}-title'>
                <span class='waitlist-join-heading' ${{ class: () => s.status !== 'joined' && '--active' }}>Join the waitlist</span>
                <span class='waitlist-join-heading' ${{ class: () => s.status === 'joined' && '--active' }}>
                    <span aria-hidden='true' class='waitlist-join-spot'>
                        You’re #${() => ui.round > 0 && untrack(() => counter({
                            class: 'counter--ticker waitlist-join-roll',
                            currency: 'IGNORE',
                            decimals: 0,
                            delay: 16,
                            state: position,
                            value: position.value
                        }))}
                    </span>
                    <span class='waitlist-join-live'>${() => `You’re #${format(position.value)} in line`}</span>
                </span>
            </h2>

            <p class='waitlist-join-description'>
                ${() => s.status === 'joined'
                    ? 'The next 200 people get in on Friday. You will hear from us the moment you do.'
                    : `${product} lets in 200 new people every Friday. Save your spot in line.`}
            </p>

            <div class='waitlist-join-queue'>
                <ol
                    class='waitlist-join-line'
                    ${{
                        'aria-label': () => s.status === 'joined' ? `Queue, you are number ${format(position.value)}` : `Queue, ${format(waiting)} people waiting`,
                        onconnect: (element: HTMLElement) => {
                            strip = element;
                            arrange(false);
                        }
                    }}
                >
                    ${tail.map((person) => html`
                        <li aria-label='${person.name}' class='waitlist-join-person' ${{ onrender: register(person.id) }}>
                            <span class='waitlist-join-face' title='${person.name}'>${face(person)}</span>
                        </li>
                    `)}
                    <li aria-label='You' class='waitlist-join-person waitlist-join-person--me' hidden ${{ onrender: register(ME) }}>
                        <span class='waitlist-join-me'>${() => s.email.trim()[0]?.toUpperCase() ?? 'Y'}</span>
                        <span aria-hidden='true' class='waitlist-join-badge'>You</span>
                    </li>
                </ol>
            </div>

            <div class='waitlist-join-meta'>
                <span class='waitlist-join-front'>
                    <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='M12.5 8h-9M7 4.5 3.5 8 7 11.5' /></svg>
                    Front of the line
                </span>
                <span class='waitlist-join-count'></span>
            </div>

            <div class='waitlist-join-slot'>
                ${form.action({
                    action: () => {
                        join();

                        return { errors: [] };
                    },
                    class: ['waitlist-join-form', () => s.status !== 'joined' && '--active'],
                    inert: () => s.status === 'joined',
                    novalidate: true
                }, html`
                    ${input({
                        'aria-describedby': `${id}-note`,
                        'aria-invalid': () => String(!!error()),
                        'aria-label': 'Email',
                        autocapitalize: 'none',
                        autocomplete: 'email',
                        class: ['waitlist-join-input', () => !!error() && '--error'],
                        disabled: () => s.status === 'joining',
                        inputmode: 'email',
                        name: 'email',
                        onblur: () => {
                            if (s.email.trim()) {
                                s.touched = true;
                            }
                        },
                        oninput: (e: Event) => {
                            s.email = (e.target as HTMLInputElement).value;
                        },
                        placeholder: 'you@studio.com',
                        spellcheck: false,
                        type: 'email',
                        value: () => s.email,
                        ...defaults?.[WAITLIST_JOIN_INPUT],
                        ...attributes[WAITLIST_JOIN_INPUT]
                    })}
                    <button
                        class='button waitlist-join-submit'
                        type='submit'
                        ${{
                            'aria-busy': () => s.status === 'joining' ? 'true' : 'false',
                            class: () => s.status === 'joining' && 'button--processing'
                        }}
                    >
                        <span>Join</span>
                        <span class='waitlist-join-live'>${() => s.status === 'joining' ? 'Joining' : ''}</span>
                    </button>
                `)}

                <div
                    class='waitlist-join-share'
                    ${{
                        class: () => s.status === 'joined' && '--active',
                        inert: () => s.status !== 'joined'
                    }}
                >
                    <span class='waitlist-join-link'>${link}</span>
                    <button
                        aria-describedby='${id}-note'
                        class='button waitlist-join-copy'
                        type='button'
                        ${{
                            class: () => s.copied && '--copied',
                            onclick: copy,
                            onrender: (element: HTMLElement) => {
                                copyButton = element;
                            }
                        }}
                    >
                        <span class='waitlist-join-icons' aria-hidden='true'>
                            <svg class='waitlist-join-icon waitlist-join-icon--copy' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.75' viewBox='0 0 16 16'><rect height='8' rx='1.5' width='8' x='5.5' y='5.5' /><path d='M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5' /></svg>
                            <svg class='waitlist-join-icon waitlist-join-icon--check' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.75' viewBox='0 0 16 16'><path d='m3.5 8.5 3 3 6-7' /></svg>
                        </span>
                        ${() => s.copied ? 'Copied' : 'Copy link'}
                    </button>
                </div>
            </div>

            <p
                aria-live='polite'
                class='waitlist-join-note'
                id='${id}-note'
                ${{ class: () => !!error() && '--error' }}
            ></p>
        </section>
    `;
}


export default Object.assign(template, { input: WAITLIST_JOIN_INPUT } as const);
export type { QueuePerson, State };
