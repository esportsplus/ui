const throttle = function(fn, wait = 0) {
    let time = Date.now();

    return function(...args) {
        if (Date.now() - time < wait) {
            return;
        }

        time = Date.now();

        return fn.call(this, ...args);
    };
};


export default throttle;
