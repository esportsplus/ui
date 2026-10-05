import { effect, flush, reactive, ReactiveArray, untrack } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import overlay from '~/components/overlay';
import { finished } from '~/shared/animation';
import { observe } from '~/shared/resize';
import { fit, viewport } from '~/shared/viewport';
import { cool, wait, warm, type Delay } from './utilities';
import '~/components/frame/scss/index.scss';


type Anchor = () => DOMRect;

// A trigger spread with 'bind()', registered while it is rendered.
type Bound = {
    content: Content,
    index: number,
    // Mounted on the first open and kept between opens while 'keep' is set.
    layer: Layer | null
};

// Rendered afresh on every open, so templates come as a function; a node would only render once.
type Content = (() => Renderable<unknown>) | number | string;

type Delegate = {
    // A trigger's content, rendered on every open; defaults to its 'data-tooltip'.
    content?: (trigger: HTMLElement) => Renderable<unknown>,
    // Sits past the container's own edge, in line with the trigger, so every tooltip along a row or column lines up;
    // otherwise it anchors on the trigger itself.
    edge?: boolean,
    selector?: string
};

type Direction = 'e' | 'n' | 's' | 'w';

// 'travel' is the way it slides in or out; left unset, the frame's own default applies.
type Layer = {
    content: Content,
    element?: HTMLElement,
    // A bound trigger's content under 'keep': hidden between opens rather than disposed.
    kept: boolean,
    state: { active: boolean, leaving: boolean, travel: { x: number, y: number } | null }
};

type Options = {
    delay?: Delay,
    // The preferred side; it flips to the opposite one when that has more room.
    direction?: Direction,
    // Clicking anything inside that matches this selector closes it; 'a[href]', so following a link leaves nothing
    // open behind it.
    dismiss?: string,
    // Content the pointer can move into and use: taps and keys toggle it, and Tab walks into it.
    interactive?: boolean,
    // Mounts each bound trigger's content on its first open and keeps it until the trigger goes, so reopening renders
    // nothing and the content keeps its state. Held per rendered trigger, so it never outgrows the page; delegated
    // and requested content, which can come from any number of triggers, still renders on every open.
    keep?: boolean,
    state?: State
};

type State = {
    active: boolean,
    // The open trigger, numbered in 'bind()' order; -1 while closed or open on a trigger that isn't bound. Setting it
    // opens that trigger.
    index: number
};

type Target = {
    anchor: Anchor,
    content: Content,
    trigger: HTMLElement
};


// Keeps the tooltip this far from the viewport edges.
const EDGE = 12;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const OPPOSITE: Record<Direction, Direction> = { e: 'w', n: 's', s: 'n', w: 'e' };

const SIDES: Direction[] = ['e', 'n', 's', 'w'];


let uid = 0;


// 'gap' is the surface's padding on the anchor side; x and y place the surface, padding included.
function place(anchor: DOMRect, direction: Direction, gap: number, height: number, width: number) {
    let view = viewport(),
        room = {
            e: view.width - anchor.right,
            n: anchor.top,
            s: view.height - anchor.bottom,
            w: anchor.left
        },
        side = direction;

    if (room[side] < (side === 'n' || side === 's' ? height : width) + gap + EDGE && room[OPPOSITE[side]] > room[side]) {
        side = OPPOSITE[side];
    }

    if (side === 'n' || side === 's') {
        return {
            side,
            x: fit(anchor.left + anchor.width / 2 - width / 2, width, view.width, EDGE),
            y: side === 'n' ? anchor.top - gap - height : anchor.bottom
        };
    }

    return {
        side,
        x: side === 'w' ? anchor.left - gap - width : anchor.right,
        y: fit(anchor.top + anchor.height / 2 - height / 2, height, view.height, EDGE)
    };
}

// The unit vector a layer moves along; 'frame--swap' scales it by '--swap-shift'.

// One tooltip shared by every trigger bound to it: it opens on the first after the open delay, then glides between
// them while its content slides over. 'bind()' makes one element a trigger, 'delegate()' every matching descendant of
// a container. 'render()' places the surface; it lives in the top layer, so no ancestor clips it, but still inherits
// custom properties from wherever it is rendered.
const shared = ({ delay: { close: closing = 0, open: opening = 0 } = {}, direction = 'n', dismiss, interactive = false, keep = false, state = reactive({ active: false, index: -1 }) }: Options = {}) => {
    let active: Layer | null = null,
        bound = new Map<HTMLElement, Bound>(),
        box: HTMLElement | undefined,
        count = 0,
        current: Target | null = null,
        element: HTMLElement | undefined,
        id = `tooltip-shared-${++uid}`,
        last: Target | null = null,
        leaving: Layer | null = null,
        layers = new ReactiveArray<Layer>(),
        next: Target | null = null,
        pointer = 'mouse',
        presentation = reactive({ active: false }),
        // The surface is in the top layer: open, or still playing its close.
        shown = false,
        timer: ReturnType<typeof setTimeout> | undefined,
        unobserve: VoidFunction | undefined,
        waiting: VoidFunction | undefined,
        // The layer whose content the box is sized to while it shows.
        watched: Layer | null = null;

    let stack = html.reactive(layers, (layer) => html`
        <span
            class='tooltip-shared-layer frame frame--swap'
            ${{
                class: [
                    () => layer.state.active && '--active',
                    () => layer.state.leaving && 'frame--leaving'
                ],
                style: () => layer.state.travel && `--travel-x: ${layer.state.travel.x}; --travel-y: ${layer.state.travel.y};`
            }}
        >
            ${layer.content}
        </span>
    `);

    // One trigger per call: its number, for 'state.index', is the order 'bind()' was called in.
    function bind(content: Content): Attributes {
        let index = count++;

        let attributes: Attributes = {
            onconnect: (trigger: HTMLElement) => {
                bound.set(trigger, { content, index, layer: null });
            },
            ondisconnect: (trigger: HTMLElement) => {
                let layer = bound.get(trigger)?.layer;

                if (current?.trigger === trigger || next?.trigger === trigger) {
                    close();
                }

                bound.delete(trigger);

                if (!layer) {
                    return;
                }

                if (active === layer) {
                    active = null;
                }

                if (leaving === layer) {
                    leaving = null;
                }

                free(layer);
            },
            // Keyboard focus only; a click focuses too, and hover already covers the pointer.
            onfocusin: (e: FocusEvent) => {
                if ((e.target as Element).matches(':focus-visible')) {
                    open(e.currentTarget as HTMLElement, content);
                }
            },
            onfocusout: (e: FocusEvent) => {
                if (!inside(e.relatedTarget as Node | null)) {
                    release(e.currentTarget as HTMLElement);
                }
            },
            onpointerout: (e: PointerEvent) => {
                let related = e.relatedTarget as Node | null,
                    trigger = e.currentTarget as HTMLElement;

                if (e.pointerType === 'touch' || trigger.contains(related) || inside(related)) {
                    return;
                }

                release(trigger);
            },
            onpointerover: (e: PointerEvent) => {
                let trigger = e.currentTarget as HTMLElement;

                // Taps have no hover, so interactive content waits for the click.
                if ((interactive && e.pointerType === 'touch') || trigger.contains(e.relatedTarget as Node | null)) {
                    return;
                }

                request(trigger, content);
            }
        };

        if (!interactive) {
            return attributes;
        }

        return {
            ...attributes,
            'aria-expanded': 'false',
            onclick: (e: MouseEvent) => {
                let trigger = e.currentTarget as HTMLElement;

                // A mouse has already opened it by hovering; taps and keys toggle.
                if (current?.trigger === trigger && (e.detail === 0 || pointer === 'touch')) {
                    close();
                }
                else {
                    open(trigger, content);
                }
            },
            // The surface is rendered elsewhere in the document, so Tab is carried into it from its trigger.
            onkeydown: (e: KeyboardEvent) => {
                let first = current?.trigger === e.currentTarget ? active?.element?.querySelector<HTMLElement>(FOCUSABLE) : null;

                if (e.key !== 'Tab' || e.shiftKey || !first) {
                    return;
                }

                e.preventDefault();
                first.focus();
            },
            onpointerdown: (e: PointerEvent) => {
                pointer = e.pointerType;
            }
        };
    }

    function cancel() {
        clearTimeout(timer);
        timer = undefined;
        waiting?.();
        waiting = undefined;
        next = null;
    }

    function close() {
        cancel();

        if (!box || !current || !element) {
            return;
        }

        if (opening) {
            cool();
        }

        describe(current.trigger, false);
        current = null;
        state.active = false;
        state.index = -1;
        element.classList.remove('tooltip-shared--instant');
        presentation.active = false;
    }

    // Rendered at once, so the caller can measure it; a layer that slides in starts out displaced by 'travel'.
    function create(box: HTMLElement, content: Content, kept: boolean, travel: Layer['state']['travel']) {
        let layer: Layer = { content, kept, state: reactive({ active: false, leaving: false, travel }) };

        layers.push(layer);
        stack.flush();
        // The box holds only the stack, so a pushed layer is its last child.
        layer.element = box.lastElementChild as HTMLElement;

        return layer;
    }

    // Spread on a container: every descendant matching 'selector' is a trigger, found as the pointer or focus reaches
    // it. One set of listeners however many there are, and triggers rendered later just work. Crossing the gaps between
    // them keeps the tooltip; it lets go once the pointer or focus leaves the container.
    function delegate({ content = (trigger) => trigger.dataset.tooltip ?? '', edge = false, selector = '[data-tooltip]' }: Delegate = {}): Attributes {
        function find(container: HTMLElement, node: EventTarget | null): Target | undefined {
            let trigger = (node as Element | null)?.closest?.<HTMLElement>(selector);

            if (!trigger || !container.contains(trigger)) {
                return;
            }

            return {
                anchor: () => {
                    let rect = trigger.getBoundingClientRect();

                    if (!edge) {
                        return rect;
                    }

                    let box = container.getBoundingClientRect();

                    return direction === 'n' || direction === 's'
                        ? new DOMRect(rect.left, box.top, rect.width, box.height)
                        : new DOMRect(box.left, rect.top, box.width, rect.height);
                },
                content: () => content(trigger),
                trigger
            };
        }

        return {
            onfocusin: (e: FocusEvent) => {
                let target = find(e.currentTarget as HTMLElement, e.target);

                if (target && (e.target as Element).matches(':focus-visible')) {
                    open(target.trigger, target.content, target.anchor);
                }
            },
            onfocusout: (e: FocusEvent) => {
                let related = e.relatedTarget as Node | null;

                if (!(e.currentTarget as HTMLElement).contains(related) && !inside(related)) {
                    release();
                }
            },
            // Lifting a finger fires pointerleave, so a tapped tooltip stays until a tap lands elsewhere.
            onpointerleave: (e: PointerEvent) => {
                if (e.pointerType !== 'touch' && !inside(e.relatedTarget as Node | null)) {
                    release();
                }
            },
            onpointerover: (e: PointerEvent) => {
                let target = find(e.currentTarget as HTMLElement, e.target);

                if (target) {
                    request(target.trigger, target.content, target.anchor);
                }
            }
        };
    }

    function describe(trigger: HTMLElement, on: boolean) {
        if (interactive) {
            trigger.setAttribute('aria-expanded', on ? 'true' : 'false');

            if (on) {
                trigger.setAttribute('aria-controls', id);
            }
            else {
                trigger.removeAttribute('aria-controls');
            }
        }
        // A decorative surface repeats the trigger's own name, so it isn't announced twice.
        else if (element?.getAttribute('aria-hidden') !== 'true') {
            if (on) {
                trigger.setAttribute('aria-describedby', id);
            }
            else {
                trigger.removeAttribute('aria-describedby');
            }
        }
    }

    // Done with a layer for now: a kept one is only hidden until its next open.
    function drop(layer: Layer | null) {
        if (!layer) {
            return;
        }

        if (layer.kept) {
            layer.state.active = false;
            layer.state.leaving = false;
            return;
        }

        free(layer);
    }

    function free(layer: Layer) {
        let index = layers.indexOf(layer);

        if (watched === layer) {
            unwatch();
        }

        if (index !== -1) {
            layers.splice(index, 1);
        }
    }

    function indexOf(trigger: HTMLElement) {
        return bound.get(trigger)?.index ?? -1;
    }

    // Once the close has played out: drops the content and leaves the top layer.
    function hide() {
        drop(active);
        drop(leaving);
        active = null;
        leaving = null;
        unwatch();
        listen(false);
        shown = false;
    }

    function inside(node: Node | null) {
        return !!node && (!!current?.trigger.contains(node) || (interactive && !!element?.contains(node)));
    }

    function listen(on: boolean) {
        if (on) {
            // Captured, so scrolling any container the trigger sits in moves the tooltip along with it.
            window.addEventListener('scroll', reposition, { capture: true, passive: true });
        }
        else {
            window.removeEventListener('scroll', reposition, { capture: true });
        }
    }

    // Sizes the box to the content and places it against the anchor.
    function measure() {
        if (!active?.element || !box || !current || !element) {
            return;
        }

        let anchor = current.anchor(),
            padding = getComputedStyle(element),
            gap = parseFloat(padding.paddingBottom) + parseFloat(padding.paddingLeft) + parseFloat(padding.paddingRight) + parseFloat(padding.paddingTop),
            height = active.element.offsetHeight,
            width = active.element.offsetWidth,
            { side, x, y } = place(anchor, direction, gap, height, width),
            style = element.style;

        for (let i = 0, n = SIDES.length; i < n; i++) {
            element.classList.toggle(`tooltip-shared--${SIDES[i]}`, SIDES[i] === side);
        }

        style.setProperty('--shared-height', `${height}px`);
        style.setProperty('--shared-width', `${width}px`);
        style.setProperty('--shared-x', `${x}px`);
        style.setProperty('--shared-y', `${y}px`);

        // Scales out of the anchor itself, even when the box is pushed sideways.
        box.style.transformOrigin = side === 'n' || side === 's'
            ? `${anchor.left + anchor.width / 2 - x}px ${side === 'n' ? '100%' : '0%'}`
            : `${side === 'e' ? '0%' : '100%'} ${anchor.top + anchor.height / 2 - y}px`;
    }

    // Opens on 'trigger' at once, as keyboard focus and clicks do.
    function open(trigger: HTMLElement, content: Content, anchor: Anchor = () => trigger.getBoundingClientRect()) {
        if (current?.trigger === trigger) {
            cancel();
            return;
        }

        show({ anchor, content, trigger });
    }

    // Given a trigger, only lets go of that trigger's tooltip: clicking one trigger blurs the last, and that blur
    // mustn't cancel or close the one just requested.
    function release(trigger?: HTMLElement) {
        if (trigger && trigger !== current?.trigger && trigger !== next?.trigger) {
            return;
        }

        waiting?.();
        waiting = undefined;
        next = null;

        if (!current || timer) {
            return;
        }

        if (!closing) {
            close();
            return;
        }

        timer = setTimeout(close, closing);
    }

    function reposition() {
        if (!current || !element) {
            return;
        }

        if (!current.trigger.isConnected) {
            close();
            return;
        }

        // Follows the trigger exactly; a glide would trail behind the scroll. Dropped after measuring, which reads
        // layout: a class change first would force a style and layout pass on every scroll event.
        measure();
        element.classList.remove('tooltip-shared--gliding');
    }

    // Spans, so it can be rendered inside running text.
    function render(attributes?: Attributes) {
        let popup = overlay.popup({
            contains: (_, node) => inside(node),
            dismissOn: interactive ? dismiss : undefined,
            ondismiss: (reason) => {
                let trigger = current?.trigger,
                    within = !!element?.contains(document.activeElement);

                if (reason === 'escape' && within) {
                    trigger?.focus();
                }

                // Return focus while this trigger is still current, so its focus handler cannot reopen the popup.
                close();
            },
            onclosed: hide,
            onopen: measure,
            popover: true,
            state: presentation
        });
        // Interactive content names itself (its trigger points at it through 'aria-controls') and takes the pointer
        // and focus. Kept out of the literal below, which compiles each handler to a listener even when unset.
        let mode: Attributes = interactive
            ? {
                onfocusout: (e: FocusEvent) => {
                    if (!inside(e.relatedTarget as Node | null)) {
                        release();
                    }
                },
                // Tab past either end hands focus back to the trigger; going forward, the browser then carries on to
                // whatever follows it.
                onkeydown: (e: KeyboardEvent) => {
                    if (e.key !== 'Tab' || !active?.element || !current) {
                        return;
                    }

                    let focusable = active.element.querySelectorAll<HTMLElement>(FOCUSABLE);

                    if (document.activeElement !== focusable[e.shiftKey ? 0 : focusable.length - 1]) {
                        return;
                    }

                    if (e.shiftKey) {
                        e.preventDefault();
                    }

                    current.trigger.focus();
                },
                onpointerout: (e: PointerEvent) => {
                    if (e.pointerType !== 'touch' && !inside(e.relatedTarget as Node | null)) {
                        release();
                    }
                },
                onpointerover: () => {
                    clearTimeout(timer);
                    timer = undefined;
                }
            }
            : { role: 'tooltip' };

        return html`
            <span
                class='tooltip-shared ${`tooltip-shared--${direction}`} ${interactive && 'tooltip-shared--interactive'}'
                id='${id}'
                popover='manual'
                ${attributes}
                ${mode}
                ${{
                    ...popup,
                    onconnect: (el: HTMLElement) => {
                        element = el;
                        popup.onconnect?.(el);
                    },
                    ondisconnect: (el: HTMLElement) => {
                        close();
                        unwatch();
                        popup.ondisconnect?.(el);

                        for (let entry of bound.values()) {
                            if (entry.layer) {
                                free(entry.layer);
                                entry.layer = null;
                            }
                        }
                    },
                    // A hover delay has no showing overlay yet, but Escape still cancels the request.
                    ondocumentkeydown: function(this: HTMLElement, e: KeyboardEvent) {
                        if (e.key === 'Escape' && waiting && !current) {
                            close();
                            return;
                        }

                        popup.ondocumentkeydown?.call(this, e);
                    },
                    onwindowresize: () => {
                        if (shown) {
                            reposition();
                        }
                    }
                }}
            >
                <span class='tooltip-shared-box' ${{ onconnect: (el: HTMLElement) => { box = el; } }}>${stack}</span>
            </span>
        `;
    }

    // Opens on 'trigger' after the open delay. While showing, or still closing, it moves over at once; while a wait
    // is running, the wait keeps its time and opens on the latest trigger.
    function request(trigger: HTMLElement, content: Content, anchor: Anchor = () => trigger.getBoundingClientRect()) {
        clearTimeout(timer);
        timer = undefined;

        if (current?.trigger === trigger) {
            return;
        }

        let target = { anchor, content, trigger };

        if (shown) {
            show(target);
            return;
        }

        next = target;
        waiting ??= wait(opening, () => {
            waiting = undefined;

            if (next) {
                show(next);
            }
        });
    }

    function show(target: Target) {
        if (!box || !element) {
            return;
        }

        let from = (current ?? last)?.anchor(),
            glide = shown,
            previous = current,
            same = last?.trigger === target.trigger;

        cancel();

        if (previous) {
            describe(previous.trigger, false);
        }

        if (!shown) {
            listen(true);
            shown = true;
        }

        current = last = target;
        element.classList.toggle('tooltip-shared--gliding', glide);
        element.classList.toggle('tooltip-shared--instant', !glide && opening > 0 && warm());

        // Reopened on the same trigger before its close finished: the content is still there.
        if (!same || !active) {
            swap(target, from, glide);
        }

        if (!presentation.active) {
            presentation.active = true;
            // Overlay shows and places the popover before committing its closed styles and starting the entrance.
            flush();
        }
        else {
            measure();
        }
        state.index = indexOf(target.trigger);
        state.active = true;
        describe(target.trigger, true);
    }

    // Content moves with the trip between triggers, in any direction: the incoming layer starts displaced along it
    // and settles into place while the outgoing one carries on out the far side. No trip, as on a reopen, just fades.
    function swap(target: Target, from: DOMRect | undefined, animate: boolean) {
        if (!box) {
            return;
        }

        let entry = keep ? bound.get(target.trigger) : undefined,
            to = target.anchor(),
            x = 0,
            y = 0;

        if (from) {
            let dx = to.left + to.width / 2 - (from.left + from.width / 2),
                dy = to.top + to.height / 2 - (from.top + from.height / 2),
                distance = Math.hypot(dx, dy);

            if (distance) {
                x = dx / distance;
                y = dy / distance;
            }
        }

        // Only the latest outgoing layer stays; a sweep across many triggers would otherwise stack them up.
        drop(leaving);
        leaving = null;

        if (active && animate) {
            let outgoing = active;

            outgoing.state.active = false;
            outgoing.state.leaving = true;
            outgoing.state.travel = { x, y };
            leaving = outgoing;

            // Once its classes have landed and started the exit.
            queueMicrotask(() => {
                if (outgoing.element) {
                    void finished(outgoing.element).then(() => {
                        if (leaving === outgoing) {
                            drop(outgoing);
                            leaving = null;
                        }
                    });
                }
            });
        }
        else {
            drop(active);
        }

        let travel = animate ? { x, y } : null,
            layer = entry
                ? (entry.layer ??= create(box, entry.content, true, travel))
                : create(box, target.content, false, travel),
            node = layer.element;

        active = layer;

        if (!node) {
            return;
        }

        if (animate) {
            layer.state.travel = travel;
            flush();

            // Commits the start position, so the layer slides in from it.
            node.getBoundingClientRect();
        }

        layer.state.active = true;
        flush();

        // Content that changes size while showing (a live count, an image loading) resizes the box with it.
        unwatch();
        unobserve = observe(node, measure);
        watched = layer;
    }

    function unwatch() {
        unobserve?.();
        unobserve = undefined;
        watched = null;
    }

    // Driven through 'state' from outside. Both return nothing on purpose: an effect's value is a dependency of
    // whatever renders this, which would re-render on every open and close.
    effect(() => {
        if (!state.active && current) {
            untrack(close);
        }
    });

    effect(() => {
        let index = state.index;

        untrack(() => {
            let showing = current ? indexOf(current.trigger) : -1;

            if (index === showing) {
                return;
            }

            if (index === -1) {
                close();
                return;
            }

            for (let [trigger, entry] of bound) {
                if (entry.index === index) {
                    // After this pass, so the content's start position commits before it slides in.
                    queueMicrotask(() => open(trigger, entry.content));
                    return;
                }
            }

            // No such trigger rendered: back to what is showing.
            state.index = showing;
        });
    });

    return { bind, close, delegate, open, release, render, request };
};


export default shared;
export type { Content, Delegate, Direction, Options, State };
