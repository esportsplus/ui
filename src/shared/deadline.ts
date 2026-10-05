type Entry = {
    at: number;
    callback: VoidFunction;
    // Its place in the heap; -1 once taken out, to run or cancelled.
    index: number;
    // Until it runs or is cancelled, so one cancelled by an earlier callback in the same flush doesn't run.
    pending: boolean;
};


// setTimeout overflows past ~24.8 days and fires immediately.
const MAX_TIMEOUT = 2 ** 31 - 1;


// A min-heap by deadline, under one timer set for the earliest.
let armed = Infinity,
    flushing = false,
    heap: Entry[] = [],
    timer: ReturnType<typeof setTimeout> | undefined;


function arm() {
    let next = heap[0]?.at ?? Infinity;

    if (flushing || next === armed) {
        return;
    }

    clearTimeout(timer);
    armed = next;
    timer = next === Infinity ? undefined : setTimeout(flush, Math.min(Math.max(next - Date.now(), 0), MAX_TIMEOUT));
}

// Everything due runs in one flush and the timer is set once after, for whatever is earliest then: rows sharing a
// boundary update together, and a callback scheduling its next deadline doesn't reset the timer each time.
function flush() {
    let due: Entry[] = [],
        now = Date.now();

    armed = Infinity;
    flushing = true;
    timer = undefined;

    while (heap.length && heap[0].at <= now) {
        due.push(remove(heap[0]));
    }

    for (let i = 0, n = due.length; i < n; i++) {
        let entry = due[i];

        if (!entry.pending) {
            continue;
        }

        entry.pending = false;

        try {
            entry.callback();
        }
        catch (error) {
            reportError(error);
        }
    }

    flushing = false;
    arm();
}

function remove(entry: Entry) {
    let last = heap.pop()!;

    if (last !== entry) {
        heap[entry.index] = last;
        last.index = entry.index;
        sift(last);
    }

    entry.index = -1;

    return entry;
}

function sift(entry: Entry) {
    let i = entry.index;

    while (i > 0) {
        let parent = (i - 1) >> 1;

        if (heap[parent].at <= entry.at) {
            break;
        }

        swap(i, parent);
        i = parent;
    }

    for (let n = heap.length; ;) {
        let left = 2 * i + 1,
            right = left + 1,
            least = i;

        if (left < n && heap[left].at < heap[least].at) {
            least = left;
        }

        if (right < n && heap[right].at < heap[least].at) {
            least = right;
        }

        if (least === i) {
            break;
        }

        swap(i, least);
        i = least;
    }
}

function swap(a: number, b: number) {
    let entry = heap[a];

    heap[a] = heap[b];
    heap[b] = entry;
    heap[a].index = a;
    heap[b].index = b;
}


// Calls 'callback' once 'Date.now()' reaches 'at', however many deadlines are pending, off a single timer. Returns
// the cancel.
const deadline = (at: number, callback: VoidFunction) => {
    let entry: Entry = { at, callback, index: heap.length, pending: true };

    heap.push(entry);
    sift(entry);
    arm();

    return () => {
        if (!entry.pending) {
            return;
        }

        entry.pending = false;

        if (entry.index !== -1) {
            remove(entry);
            arm();
        }
    };
};


export { deadline };
