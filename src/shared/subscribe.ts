import type { ReactiveArray } from '@esportsplus/reactivity';


const EVENTS = ['clear', 'concat', 'pop', 'push', 'reverse', 'set', 'shift', 'sort', 'splice', 'unshift'] as const;


// Calls 'listener' after any change to 'data'; the returned function removes it from every event.
export default <T>(data: ReactiveArray<T>, listener: VoidFunction) => {
    let unsubscribe: VoidFunction[] = [];

    for (let i = 0, n = EVENTS.length; i < n; i++) {
        unsubscribe.push(data.on(EVENTS[i], listener));
    }

    return () => {
        for (let i = 0, n = unsubscribe.length; i < n; i++) {
            unsubscribe[i]();
        }
    };
};
