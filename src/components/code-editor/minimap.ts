export function minimapMetrics(height: number, scrollHeight: number, clientHeight: number, scrollTop: number) {
    let sliderHeight = Math.min(height, Math.max(24, (height * clientHeight) / Math.max(1, scrollHeight))),
        travel = Math.max(0, height - sliderHeight),
        scroll = Math.max(0, scrollHeight - clientHeight);
    return {
        height: sliderHeight,
        top: scroll ? Math.max(0, Math.min(travel, (scrollTop / scroll) * travel)) : 0,
        travel,
        scroll
    };
}
export function minimapScroll(y: number, grab: number, height: number, scrollHeight: number, clientHeight: number) {
    let metrics = minimapMetrics(height, scrollHeight, clientHeight, 0);
    return metrics.travel ? (Math.max(0, Math.min(metrics.travel, y - grab)) / metrics.travel) * metrics.scroll : 0;
}
