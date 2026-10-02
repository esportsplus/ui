import { timing } from '~/shared/animation';


// Drag-to-dismiss: capture past a small threshold, follow the pointer out by any of the ways the element may leave,
// together or apart (a corner leaves up, sideways, or anywhere between), rubber-band back the other way, dismiss past
// a share of its size or on a flick, and fling a dismissed element on the way it was going until it has left the
// screen.


type Direction = {
    axis: 'x' | 'y';
    sign: -1 | 1;
};

type Drag = {
    captured: boolean;
    directions: Direction[];
    // How far out it is, along the ways it may leave by.
    distance: number;
    originX: number;
    originY: number;
    pointer: number;
    // Pointer offset and time of the last velocity sample.
    sampleX: number;
    sampleY: number;
    time: number;
    // The pointer's recent velocity, px per ms, resistance aside: pulling hard the wrong way must still read as such.
    vx: number;
    vy: number;
    // Where it stands, resistance included.
    x: number;
    y: number;
};

type Fling = {
    duration: number;
    easing: string;
    // Further to travel, px.
    x: number;
    y: number;
};

type Options = {
    // On press: the ways it may be dismissed, or null when this press must not drag.
    begin: (e: PointerEvent, element: HTMLElement) => Direction[] | null;
    capture?: (element: HTMLElement) => void;
    move: (element: HTMLElement, drag: Drag, progress: number) => void;
    release: (element: HTMLElement, drag: Drag, dismiss: boolean) => void;
};


// Otherwise it must be dragged past this share of its size.
const DISMISS_DISTANCE = 0.25;

// A flick must be this far out (px), so a drag swung back from the wrong way isn't one just for crossing its start.
const FLICK_DISTANCE = 12;

// A release faster than this (px per ms), mostly outward, dismisses however short the drag, so a flick is enough.
const FLICK_VELOCITY = 0.11;

// Ease-out cubic: it leaves at three times its average speed, so a fling lasting 3 * distance / velocity leaves at
// exactly the speed it was let go at.
const FLING_EASING = 'cubic-bezier(0.33, 1, 0.68, 1)';

const FLING_MIN = 150;

// Presses on these keep their own clicks rather than starting a drag.
const INTERACTIVE = 'a, button, input, label, select, summary, textarea, [contenteditable], [role="button"], [role="option"]';

// A pointer resting this long (ms) before release has stopped, whatever its last sample said.
const REST = 100;

// Velocity is sampled no more often than this (ms), so one jittery move can't spike it.
const SAMPLE = 16;

const THRESHOLD = 4;


// Let go moving fast and mostly the way out, it was flicked. Let go far enough out, it was dragged away, unless it
// was already on its way back in.
function dismissed(element: HTMLElement, { directions, distance, time, vx, vy, x, y }: Drag) {
    let ox = outward(directions, 'x', x),
        oy = outward(directions, 'y', y);

    if (distance === 0) {
        return false;
    }

    if (performance.now() - time > REST) {
        return distance > extent(element, ox, oy) * DISMISS_DISTANCE;
    }

    let fx = outward(directions, 'x', vx),
        fy = outward(directions, 'y', vy),
        speed = Math.hypot(fx, fy);

    if (distance > FLICK_DISTANCE && speed > FLICK_VELOCITY && speed > Math.hypot(vx - fx, vy - fy)) {
        return true;
    }

    return distance > extent(element, ox, oy) * DISMISS_DISTANCE && (vx * ox + vy * oy) / distance > -FLICK_VELOCITY;
}

// Its size along the way it's heading, so a share of it means the same whichever way it goes.
function extent(element: HTMLElement, x: number, y: number) {
    let length = Math.hypot(x, y);

    if (length === 0) {
        return Math.max(element.offsetWidth, element.offsetHeight);
    }

    return (Math.abs(x) * element.offsetWidth + Math.abs(y) * element.offsetHeight) / length;
}

// Toward a way out it follows 1:1. The other way along an axis it may leave by, it still gives, but less the further
// you pull, like stretching something that wants to snap back; along an axis it may not leave by, it holds still.
function follow(directions: Direction[], axis: Direction['axis'], delta: number) {
    let free = false;

    for (let i = 0, n = directions.length; i < n; i++) {
        if (directions[i].axis !== axis) {
            continue;
        }

        if (delta === 0 || Math.sign(delta) === directions[i].sign) {
            return delta;
        }

        free = true;
    }

    return free ? Math.sign(delta) * Math.pow(Math.abs(delta), 0.7) : 0;
}

function free(directions: Direction[], axis: Direction['axis']) {
    for (let i = 0, n = directions.length; i < n; i++) {
        if (directions[i].axis === axis) {
            return true;
        }
    }

    return false;
}

// The part of a value along an axis that heads out by a way it may leave; none otherwise.
function outward(directions: Direction[], axis: Direction['axis'], value: number) {
    for (let i = 0, n = directions.length; i < n; i++) {
        if (directions[i].axis === axis && Math.sign(value) === directions[i].sign) {
            return value;
        }
    }

    return 0;
}


const drag = ({ begin, capture, move, release }: Options) => {
    let current: Drag | null = null,
        dragged = false;

    return {
        // The pointerup that ends a drag is followed by a click, which lands on the dragged element since it holds the
        // pointer; it would otherwise read as a press on it (or, beyond an overlay, on its backdrop). Paired handlers
        // on the same element call this first and stand down when it has taken the click.
        onclick: (e: MouseEvent) => {
            if (!dragged) {
                return;
            }

            dragged = false;
            e.preventDefault();
            e.stopPropagation();
        },
        onpointercancel: (e: PointerEvent) => {
            if (!current || e.pointerId !== current.pointer) {
                return;
            }

            let state = current;

            current = null;

            if (state.captured) {
                release(e.currentTarget as HTMLElement, state, false);
            }
        },
        onpointerdown: (e: PointerEvent) => {
            let directions = begin(e, e.currentTarget as HTMLElement),
                now = performance.now();

            if (!directions || directions.length === 0) {
                return;
            }

            current = {
                captured: false,
                directions,
                distance: 0,
                originX: e.clientX,
                originY: e.clientY,
                pointer: e.pointerId,
                sampleX: 0,
                sampleY: 0,
                time: now,
                vx: 0,
                vy: 0,
                x: 0,
                y: 0
            };
        },
        onpointermove: (e: PointerEvent) => {
            if (!current || e.pointerId !== current.pointer) {
                return;
            }

            let { directions } = current,
                element = e.currentTarget as HTMLElement,
                dx = e.clientX - current.originX,
                dy = e.clientY - current.originY;

            // Capture only once it is clearly a drag, counting only movement it can follow; capturing on press would
            // retarget the click of a plain tap away from the control under the pointer.
            if (!current.captured) {
                if (Math.hypot(free(directions, 'x') ? dx : 0, free(directions, 'y') ? dy : 0) <= THRESHOLD) {
                    return;
                }

                current.captured = true;
                element.setPointerCapture(e.pointerId);
                getSelection()?.removeAllRanges();
                capture?.(element);
            }

            let now = performance.now(),
                x = follow(directions, 'x', dx),
                y = follow(directions, 'y', dy),
                ox = outward(directions, 'x', x),
                oy = outward(directions, 'y', y);

            if (now - current.time >= SAMPLE) {
                current.vx = (dx - current.sampleX) / (now - current.time);
                current.vy = (dy - current.sampleY) / (now - current.time);
                current.sampleX = dx;
                current.sampleY = dy;
                current.time = now;
            }

            current.distance = Math.hypot(ox, oy);
            current.x = x;
            current.y = y;
            move(element, current, Math.min(current.distance / extent(element, ox, oy), 1));
        },
        onpointerup: (e: PointerEvent) => {
            if (!current || e.pointerId !== current.pointer) {
                return;
            }

            let element = e.currentTarget as HTMLElement,
                state = current;

            current = null;

            if (!state.captured) {
                return;
            }

            // Touch sends no click after a drag, so the flag can't wait for one.
            dragged = true;
            setTimeout(() => {
                dragged = false;
            });
            release(element, state, dismissed(element, state));
        }
    };
};

// Carries a dismissed drag on until the element has cleared the viewport: the way the pointer was last moving (only
// its parts heading out), or where it had been dragged when the pointer stopped, leaving at the speed it was let go
// at, for no longer than the element's '--fling-duration'. Null without one (reduced motion zeroes it), where it should
// fade where it stands instead.
const fling = (element: HTMLElement, { directions, time, vx, vy, x, y }: Drag): Fling | null => {
    let longest = timing(getComputedStyle(element), 'fling')?.duration as number | undefined;

    if (!longest) {
        return null;
    }

    let moving = performance.now() - time <= REST,
        ux = moving ? outward(directions, 'x', vx) : 0,
        uy = moving ? outward(directions, 'y', vy) : 0;

    if (ux === 0 && uy === 0) {
        ux = outward(directions, 'x', x);
        uy = outward(directions, 'y', y);
    }

    let length = Math.hypot(ux, uy);

    if (length === 0) {
        return null;
    }

    ux /= length;
    uy /= length;

    // Heading out at an angle, it has cleared the screen once past whichever edge it reaches first.
    let rect = element.getBoundingClientRect(),
        speed = moving ? Math.max(vx * ux + vy * uy, 0) : 0,
        travel = Infinity;

    if (ux > 0) {
        travel = Math.min(travel, (innerWidth - rect.left) / ux);
    }
    else if (ux < 0) {
        travel = Math.min(travel, rect.right / -ux);
    }

    if (uy > 0) {
        travel = Math.min(travel, (innerHeight - rect.top) / uy);
    }
    else if (uy < 0) {
        travel = Math.min(travel, rect.bottom / -uy);
    }

    travel = Math.max(travel, 0);

    return {
        duration: speed > 0 ? Math.min(Math.max((3 * travel) / speed, FLING_MIN), longest) : longest,
        easing: FLING_EASING,
        x: ux * travel,
        y: uy * travel
    };
};

// Back toward the edges a placement touches (signs per axis, 0 for neither): an edge, straight back; a corner, toward
// either of its edges or anywhere between, never away from one.
const toward = ({ x, y }: { x: -1 | 0 | 1; y: -1 | 0 | 1 }) => {
    let ways: Direction[] = [];

    if (x !== 0) {
        ways.push({ axis: 'x', sign: x });
    }

    if (y !== 0) {
        ways.push({ axis: 'y', sign: y });
    }

    return ways;
};


export { drag, fling, INTERACTIVE, toward };
export type { Direction, Drag, Fling };
