type Motion = {
    done?: VoidFunction;
    precision: number;
    spring: Spring;
    target: number;
    value: number;
    velocity: number;
};

type Spring = {
    damping: number;
    mass: number;
    stiffness: number;
};

type Value = {
    get: () => number;
    set: (value: number) => void;
    to: (target: number, spring: Spring) => Promise<void>;
};


// Fixed substep keeps stiff springs stable regardless of the display's frame rate.
const STEP = 1 / 240;


// Integrates every running value in one frame, then calls 'paint' once so writes are batched.
function animator(paint: VoidFunction) {
    let frame = 0,
        last = 0,
        running = new Set<Motion>();

    function request() {
        if (frame) {
            return;
        }

        last = performance.now();
        frame = requestAnimationFrame(tick);
    }

    function settle(motion: Motion) {
        let done = motion.done;

        motion.done = undefined;
        motion.velocity = 0;
        running.delete(motion);
        done?.();
    }

    function tick(now: number) {
        // Clamped so a backgrounded tab resumes where it left off instead of jumping.
        let dt = Math.min(Math.max(0, (now - last) / 1000), 1 / 15);

        last = now;

        for (let motion of running) {
            let { damping, mass, stiffness } = motion.spring;

            for (let t = 0; t < dt; t += STEP) {
                let h = Math.min(STEP, dt - t);

                motion.velocity += ((-stiffness * (motion.value - motion.target) - damping * motion.velocity) / mass) * h;
                motion.value += motion.velocity * h;
            }

            if (Math.abs(motion.value - motion.target) < motion.precision && Math.abs(motion.velocity) < motion.precision * 10) {
                motion.value = motion.target;
                settle(motion);
            }
        }

        paint();
        frame = running.size ? requestAnimationFrame(tick) : 0;
    }

    return {
        stop: () => {
            cancelAnimationFrame(frame);
            frame = 0;

            for (let motion of running) {
                settle(motion);
            }
        },
        value: (initial: number, precision: number): Value => {
            let motion: Motion = {
                    precision,
                    spring: { damping: 1, mass: 1, stiffness: 1 },
                    target: initial,
                    value: initial,
                    velocity: 0
                };

            return {
                get: () => motion.value,
                set: (value) => {
                    motion.target = motion.value = value;
                    settle(motion);
                    request();
                },
                // Retargeting keeps the current velocity, so interrupted motion carries its momentum.
                to: (target, spring) => new Promise((resolve) => {
                    motion.done?.();
                    motion.done = resolve;
                    motion.spring = spring;
                    motion.target = target;
                    running.add(motion);
                    request();
                })
            };
        }
    };
}


export { animator };
export type { Spring, Value };
