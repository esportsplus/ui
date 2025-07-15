import response from '@esportsplus/action';
import input from './input.js';
function parse(input) {
    let data = {};
    for (let [path, value] of input) {
        let bucket = data, segments = path.indexOf('.') !== -1 ? path.split('.') : [path];
        for (let i = 0; i < segments.length - 1; i++) {
            bucket = bucket[segments[i]] = bucket[segments[i]] || {};
        }
        let key = segments.at(-1);
        if (path.endsWith('[]')) {
            if (typeof value === 'string' && value.trim() === '') {
                continue;
            }
            bucket = bucket[key.substring(0, key.length - 2)] ??= [];
            bucket.push(value);
        }
        else {
            bucket[key] = value;
        }
    }
    return data;
}
;
export default function (action, s) {
    return {
        onclick: function (event) {
            let trigger = event.target;
            if (trigger?.type !== 'submit') {
                return;
            }
            event.preventDefault();
            this.dispatchEvent(new SubmitEvent('submit', { cancelable: true, bubbles: true, submitter: trigger }));
        },
        onsubmit: async function (event) {
            event.preventDefault();
            if (s) {
                s.processing = true;
            }
            let { errors } = await action({
                input: parse(new FormData(this).entries()),
                response
            });
            for (let i = 0, n = errors.length; i < n; i++) {
                let { message, path } = errors[i], reactive = input.get(this[path]);
                if (!reactive) {
                    continue;
                }
                reactive.error = `${message[0].toUpperCase()}${message.substring(1)}`;
            }
            if (s) {
                s.processing = false;
            }
        }
    };
}
;
