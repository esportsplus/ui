type Tick = (now: number) => void;


let frame = 0,
    snapshot: Tick[] = [],
    ticks = new Set<Tick>();


// The ticks subscribed when the frame began: one subscribed during it starts on the next frame, as its own
// requestAnimationFrame would, and one unsubscribed during it is skipped. One throwing doesn't stop the rest.
function run(now: number) {
    frame = 0;

    for (let tick of ticks) {
        snapshot.push(tick);
    }

    for (let i = 0, n = snapshot.length; i < n; i++) {
        let tick = snapshot[i];

        if (!ticks.has(tick)) {
            continue;
        }

        try {
            tick(now);
        }
        catch (error) {
            reportError(error);
        }
    }

    snapshot.length = 0;

    if (ticks.size) {
        frame ||= requestAnimationFrame(run);
    }
}


// Every subscriber runs off one requestAnimationFrame loop, handed the frame's timestamp, so per-frame work across
// many instances costs one callback; the loop stops while nothing is subscribed. Returns the unsubscribe.
const ticker = (tick: Tick) => {
    ticks.add(tick);
    frame ||= requestAnimationFrame(run);

    return () => {
        if (ticks.delete(tick) && !ticks.size && frame) {
            cancelAnimationFrame(frame);
            frame = 0;
        }
    };
};


export { ticker };
