import dom from './dom.js';
import pubsub from './pubsub.js';


let cache = new WeakMap(),
    root = document,
    self = pubsub();


function event(e) {
    let element = e.target,
        history = cache.get(e.target) || {},
        stop = false;

    // Stop Capture -> Target -> Bubbling Phases
    e.stopPropagation();

    // Directives Keys To Match
    if (this.haystack.length) {
        // Skip Manual Bubbling
        element = history[e.type] || element;

        // Manual Bubbling From Target
        while (element) {
            let context,
                directives = element.dataset || {};

            if (directives) {
                for (let i = 0, n = this.haystack.length; i < n; i++) {
                    let key = this.haystack[i];

                    if (directives[key]) {
                        let { bubble, fn } = this.directives[key];

                        if (bubble === false) {
                            stop = true;
                        }

                        if (fn) {
                            execute((context = context ? context : dom.ref(element)), directives[key], e, fn);
                        }
                    }
                }
            }

            if (context || stop) {
                if (element !== e.target && !history[e.type]) {
                    cache.set(e.target, Object.assign(history, { [e.type]: element }));
                }
                return;
            }

            element = element.parentNode;
        }
    }

    // Delegated Event Was Not Found, Trigger Root Event
    self.dispatch(this.rootkey, e);
}

function execute(context, directives, e, fn) {
    directives = directives.includes(',') ? directives.split(',').map((d) => d.trim()).filter(d => d) : [directives];

    for (let i = 0, n = directives.length; i < n; i++) {
        fn(directives[i], [e], context);
    }
}


const addEventListener = (type, listener, options) => {
    root.addEventListener(type, listener, options);
};

const dispatch = (key, data, context) => {
    if (context instanceof HTMLElement) {
        context = dom.ref(context);
    }

    self.dispatch(key, data, context);
};

const listener = (context = {}) => {
    context.haystack = Object.keys(context.directives || {}) || [];

    if (context.haystack.length) {
        return event.bind(context);
    }

    return () => {};
};


export default Object.assign({}, self, { addEventListener, dispatch, listener });
