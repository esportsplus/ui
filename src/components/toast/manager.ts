import { effect, reactive, ReactiveArray } from '@esportsplus/reactivity';
import { type Renderable } from '@esportsplus/template';


type Action = {
    label: string;
    onclick: () => void;
};

type Options = {
    action?: Action;
    description?: Renderable<unknown> | string;
    dismissible?: boolean;
    duration?: number;
    id?: string;
    priority?: 'low' | 'high';
};

type Status = 'ending' | 'starting' | 'visible';

type Timer = {
    handle: ReturnType<typeof setTimeout> | undefined;
    remaining: number;
    started: number;
};

type Toast = {
    action?: Action;
    createdAt: number;
    description?: Renderable<unknown> | string;
    dismissible: boolean;
    duration: number;
    height: number;
    id: string;
    priority: 'low' | 'high';
    status: Status;
    title: Renderable<unknown> | string;
    type: Type;
};

type Type = 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message';


const DURATIONS: Record<Type, number> = {
    error: 6000,
    info: 4000,
    loading: 0,
    message: 4000,
    success: 4000,
    warning: 6000
};

const EXIT_DURATION = 300;


let counter = 0,
    paused = false,
    timers = new Map<string, Timer>();


function buildVisibleToastLayout(toasts: Toast[]): {
    frontmostHeight: number;
    items: { offsetY: number, toast: Toast, visibleIndex: number }[];
} {
    // Two parallel cursors:
    //   - `full*` advances on every toast, so an ending toast keeps the slot it
    //     occupied before dismissal and its exit transform originates from the
    //     correct position (otherwise it would snap to Y=0 and slide diagonally).
    //   - `live*` advances only on non-ending toasts, so live toasts reflow past
    //     the vacated slot in parallel with the exit animation instead of
    //     waiting for it to finish (which caused a visible "stop and bump").
    let fullIndex = 0,
        fullOffsetY = 0,
        liveIndex = 0,
        liveOffsetY = 0,
        items = toasts.map((toast) => {
            let height = normalizeToastHeight(toast.height),
                item;

            if (toast.status === 'ending') {
                item = {
                    offsetY: fullOffsetY,
                    toast,
                    visibleIndex: fullIndex
                };

                fullOffsetY += height;
                fullIndex += 1;

                return item;
            }

            item = {
                offsetY: liveOffsetY,
                toast,
                visibleIndex: liveIndex
            };

            fullOffsetY += height;
            fullIndex += 1;
            liveOffsetY += height;
            liveIndex += 1;

            return item;
        }),
        frontmostLiveToast = toasts.find((toast) => toast.status !== 'ending');

    return {
        frontmostHeight: normalizeToastHeight(frontmostLiveToast?.height),
        items
    };
}

function clearTimer(id: string) {
    let timer = timers.get(id);

    if (!timer) {
        return;
    }

    if (timer.handle !== undefined) {
        clearTimeout(timer.handle);
    }

    timers.delete(id);
}

function create(type: Type, title: Renderable<unknown> | string, options: Options = {}): string {
    let id = options.id ?? `toast-${++counter}`,
        toast = reactive({
            action: options.action,
            createdAt: Date.now(),
            description: options.description,
            dismissible: options.dismissible ?? true,
            duration: options.duration ?? DURATIONS[type],
            height: 0,
            id,
            priority: options.priority ?? 'low',
            status: 'starting' as Status,
            title,
            type
        }) as Toast;

    toasts.push(toast);

    queueMicrotask(() => {
        if (toast.status === 'starting' && toasts.includes(toast)) {
            toast.status = 'visible';
        }
    });

    if (type !== 'loading' && toast.duration > 0) {
        schedule(toast);
    }

    return id;
}

function dismiss(id: string) {
    let toast = toasts.find((value) => value.id === id);

    if (!toast || toast.status === 'ending') {
        return;
    }

    clearTimer(id);

    toast.status = 'ending';

    setTimeout(() => remove(id), EXIT_DURATION);
}

function normalizeToastHeight(height: number | null | undefined): number {
    return typeof height === 'number' && Number.isFinite(height) && height > 0 ? height : 0;
}

function pause() {
    for (let timer of timers.values()) {
        if (timer.handle === undefined) {
            continue;
        }

        clearTimeout(timer.handle);

        timer.remaining = Math.max(0, timer.remaining - (performance.now() - timer.started));
        timer.handle = undefined;
    }
}

function remove(id: string) {
    let index = toasts.findIndex((toast) => toast.id === id);

    clearTimer(id);

    if (index !== -1) {
        toasts.splice(index, 1);
    }
}

function resume() {
    for (let [id, timer] of timers) {
        if (timer.handle !== undefined) {
            continue;
        }

        timer.started = performance.now();
        timer.handle = setTimeout(() => dismiss(id), timer.remaining);
    }
}

function schedule(toast: Toast) {
    if (toast.duration <= 0) {
        return;
    }

    if (state.active) {
        timers.set(toast.id, {
            handle: undefined,
            remaining: toast.duration,
            started: 0
        });

        return;
    }

    timers.set(toast.id, {
        handle: setTimeout(() => dismiss(toast.id), toast.duration),
        remaining: toast.duration,
        started: performance.now()
    });
}

function update(id: string, options: Options) {
    let toast = toasts.find((value) => value.id === id);

    if (!toast) {
        return;
    }

    if (options.action !== undefined) {
        toast.action = options.action;
    }

    if (options.description !== undefined) {
        toast.description = options.description;
    }

    if (options.dismissible !== undefined) {
        toast.dismissible = options.dismissible;
    }

    if (options.priority !== undefined) {
        toast.priority = options.priority;
    }

    if (options.duration !== undefined) {
        toast.duration = options.duration;

        clearTimer(id);

        if (toast.type !== 'loading' && toast.duration > 0 && toast.status !== 'ending') {
            schedule(toast);
        }
    }
}


const state = reactive({ active: false });

const toasts = new ReactiveArray<Toast>();

effect(() => {
    let active = state.active;

    if (active === paused) {
        return;
    }

    paused = active;

    if (active) {
        pause();
    }
    else {
        resume();
    }
});

const toast = {
    dismiss: (id?: string) => {
        if (id === undefined) {
            for (let value of [...toasts]) {
                dismiss(value.id);
            }

            return;
        }

        dismiss(id);
    },
    error: (title: Renderable<unknown> | string, options?: Options) => create('error', title, options),
    info: (title: Renderable<unknown> | string, options?: Options) => create('info', title, options),
    loading: (title: Renderable<unknown> | string, options?: Options) => create('loading', title, options),
    message: (title: Renderable<unknown> | string, options?: Options) => create('message', title, options),
    success: (title: Renderable<unknown> | string, options?: Options) => create('success', title, options),
    update,
    warning: (title: Renderable<unknown> | string, options?: Options) => create('warning', title, options)
};


export { buildVisibleToastLayout, remove, state, toast, toasts };
export type { Options, Toast, Type };
