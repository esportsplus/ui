import type { Attributes } from '@esportsplus/template';


// A press that turns into a drag: a mouse's once it moves past a few pixels, a touch's once it has held still for the
// delay, since a touch that moves sooner is a scroll and is let go. While a press lasts nothing on the page can be
// selected, dragged natively or long-pressed for a menu, and once it is a drag a touch can't scroll the page; the
// click that follows its release is swallowed.


type Handlers = {
    // The press is over: released or cancelled by the browser ('e'), or dropped by 'cancel()' (null).
    end: (e: PointerEvent | null, started: boolean) => void;
    // Every move of its pointer, before the drag starts too.
    move: (e: PointerEvent) => void;
    start: VoidFunction;
};

type Session = Handlers & {
    // Ends the touch's listener with the press.
    listening: AbortController | null;
    originX: number;
    originY: number;
    pointer: number;
    started: boolean;
    // The node a touch landed on: its touch events keep going there, even once a drag has moved it out of the DOM.
    target: Element | null;
    timer?: ReturnType<typeof setTimeout>;
};


const THRESHOLD = 4;


function swallow(e: Event) {
    e.preventDefault();
    e.stopPropagation();
}


// One press at a time. Spread 'attributes' on the element presses start in, call 'begin()' from its pointerdown and
// 'cancel()' when it goes.
export default (delay: number) => {
    let session: Session | null = null;

    function finish(e: PointerEvent | null) {
        let current = session!;

        session = null;
        clearTimeout(current.timer);
        current.listening?.abort();

        // The pointerup that ended a drag is followed by a click on whatever sits under the pointer.
        if (current.started && e) {
            addEventListener('click', swallow, true);
            setTimeout(() => removeEventListener('click', swallow, true));
        }

        current.end(e, current.started);
    }

    function prevent(e: Event) {
        if (session) {
            e.preventDefault();
        }
    }

    function release(e: PointerEvent) {
        if (session && e.pointerId === session.pointer) {
            finish(e);
        }
    }

    // Cancels the page's scroll under a touch drag. Not a template listener: those go with their node, and a touch's
    // events stay with the node it landed on.
    function scroll(e: Event) {
        if (session?.started) {
            e.preventDefault();
        }
    }

    function start() {
        let current = session!;

        clearTimeout(current.timer);
        current.started = true;
        getSelection()?.removeAllRanges();
        current.start();
    }

    return {
        attributes: {
            ondocumentcontextmenu: prevent,
            ondocumentdragstart: prevent,
            ondocumentpointercancel: release,
            ondocumentpointermove: (e: PointerEvent) => {
                if (!session || e.pointerId !== session.pointer) {
                    return;
                }

                session.move(e);

                if (session.started || Math.hypot(e.clientX - session.originX, e.clientY - session.originY) < THRESHOLD) {
                    return;
                }

                if (session.target) {
                    finish(null);
                }
                else {
                    start();
                }
            },
            ondocumentpointerup: release,
            ondocumentselectstart: prevent
        } as Attributes,
        begin: (e: PointerEvent, handlers: Handlers) => {
            let target = e.pointerType === 'touch' ? e.target as Element : null,
                listening = target && new AbortController();

            session = { ...handlers, listening, originX: e.clientX, originY: e.clientY, pointer: e.pointerId, started: false, target };

            // On the document, which a scroll container needs to hold its scroll for the press, and on the node the
            // touch landed on, which keeps getting its events once a drag moves it out of the DOM.
            if (target && listening) {
                document.addEventListener('touchmove', scroll, { passive: false, signal: listening.signal });
                target.addEventListener('touchmove', scroll, { passive: false, signal: listening.signal });
                session.timer = setTimeout(start, delay);
            }
        },
        busy: () => session !== null,
        cancel: () => {
            if (session) {
                finish(null);
            }
        }
    };
};
