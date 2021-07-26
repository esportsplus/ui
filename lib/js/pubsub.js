const pubsub = () => {

    let events = new Map();


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
                let fn = queue[i];

                fn.call(context, ...data);

                if (fn.__once) {
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
            let key = keys[i];

            if (fn) {
                delete events.get(key)[fn];
            }
            else {
                events.delete(key);
            }
        }
    };

    const on = (key, fn) => {
        if (typeof fn !== 'function') {
            return;
        }

        let keys = split(key);

        for (let i = 0, n = keys.length; i < n; i++) {
            let key = keys[i];

            if (!events.has(key)) {
                events.set(key, []);
            }

            events.get(key).push(fn);
        }
    };

    const once = (key, fn) => {
        fn.__once = true;

        on(key, fn);
    };

    return { dispatch, off, on, once };
};


export default pubsub;
