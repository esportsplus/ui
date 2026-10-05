// Places a box of 'size' at 'start' along an axis 'extent' long, kept 'margin' from either end; one too big for both
// keeps the near margin.
const fit = (start: number, size: number, extent: number, margin: number) => {
    return Math.max(margin, Math.min(start, extent - margin - size));
};

// Opens a box from 'start' toward the far end, or back from it when it would cross the far margin; never past the near
// margin.
const flip = (start: number, size: number, extent: number, margin: number) => {
    return Math.max(margin, start + size > extent - margin ? start - size : start);
};

// The layout viewport less any classic scrollbar: the box client rects are measured in and fixed and top-layer boxes
// are placed in. 'innerWidth' and 'innerHeight' count the scrollbar, so a box kept inside them can sit under it; the
// visual viewport shrinks and pans with pinch zoom, which client rects and fixed boxes don't follow.
const viewport = () => {
    let root = document.documentElement;

    return { height: root.clientHeight, width: root.clientWidth };
};


export { fit, flip, viewport };
