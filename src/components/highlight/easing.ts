// Bound a sampled spring's bounce in pixels, keeping its approach and the shape of its settling motion.
// Short glides and timing functions without sampled overshoot keep their original easing.
function easing(value: string, distance: number, limit = 8) {
    if (!value.startsWith('linear(') || !distance) {
        return value;
    }

    let stops = value.slice(7, -1).split(','),
        peak = Math.max(...stops.map((stop) => Math.max(0, parseFloat(stop) - 1, -parseFloat(stop)))),
        scale = Math.min(1, Math.max(0, limit) / (distance * peak));

    if (!peak || scale === 1) {
        return value;
    }

    return `linear(${stops.map((stop) => {
        let progress = parseFloat(stop),
            bounded = Math.max(0, Math.min(1, progress));

        // Only change the output value; retain any explicit percentage positions on the stop.
        return stop.replace(/[^\s]+/, String(bounded + (progress - bounded) * scale));
    }).join(',')})`;
}


export { easing };
