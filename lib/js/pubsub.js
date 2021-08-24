const pubsub = () => {

    let events = new Map();


    function push(key, fn, once = false) {
        if (typeof fn !== 'function') {
            return;
        }

        let keys = split(key);

        for (let i = 0, n = keys.length; i < n; i++) {
            let key = keys[i];

            if (!events.has(key)) {
                events.set(key, []);
            }

            events.get(key).push({ fn, once });
        }
    }

    function split(key) {
        return key.includes(',') ? key.split(',').map((k) => k.trim()).filter(k => k) : [key];
    }


    const dispatch = (keys, data, context) => {
        if (!Array.isArray(keys)) {
            keys = [keys];
        }

        if (!Array.isArray(data)) {
            data = [data];
        }

        for (let i = 0, n = keys.length; i < n; i++) {
            let key = keys[i];

            if (!events.has(key)) {
                continue;
            }

            let queue = events.get(key);

            for (let i = 0, n = queue.length; i < n; i++) {
                let { fn, once } = queue[i];

                fn.call(context, ...data);

                if (once) {
                    queue.splice(i, 1);
                }
            }
        }
    };

    const off = (key, fn) => {
        if (typeof fn !== 'function') {
            return;
        }

        let keys = split(key);

        for (let i = 0, n = keys.length; i < n; i++) {
            let key = keys[i],
                match = fn.toString();

            if (!(events[key] || []).length) {
                continue;
            }

            let index = events[key].findIndex((e) => e.fn.toString() === match);

            if (index != -1) {
                events[key].splice(index, 1);
            }
        }
    };

    const on = (key, fn) => {
        push(key, fn);
    };

    const once = (key, fn) => {
        push(key, fn, true);
    };

    return { dispatch, off, on, once };
};


export default pubsub;
