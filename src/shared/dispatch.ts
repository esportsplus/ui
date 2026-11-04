type Handlers<T> = {
    get: (element: Element) => Set<(entries: T[]) => void> | undefined;
};


// One callback per delivery of a shared observer: each handler receives the entries of its own elements together, in
// delivery order, as from an observer of its own. An element unobserved by an earlier handler in the same delivery is
// not reported.
const dispatch = <T extends { target: Element }>(handlers: Handlers<T>, entries: T[]) => {
    let batches = new Map<(entries: T[]) => void, T[]>();

    for (let i = 0, n = entries.length; i < n; i++) {
        let entry = entries[i],
            listeners = handlers.get(entry.target);

        if (!listeners) {
            continue;
        }

        for (let handler of listeners) {
            let batch = batches.get(handler);

            if (batch) {
                batch.push(entry);
            }
            else {
                batches.set(handler, [entry]);
            }
        }
    }

    for (let [handler, batch] of batches) {
        let live = batch.filter((entry) => handlers.get(entry.target)?.has(handler));

        if (live.length) {
            handler(live);
        }
    }
};


export { dispatch };
