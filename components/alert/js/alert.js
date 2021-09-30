import { state } from 'ui/components';
import { dom, node, render } from 'ui/lib';


let ref = {
        alert: (key) => `alert.${key}.alert`,
        all: (key) => `alert.${key}`
    },
    template = (message) => `<span class='alert-message'><p>${message}</p></span>`;


function activate(key, values, seconds = 0) {
    let { alert, messages } = dom.element( ref.all(key) );

    if (!Array.isArray(values)) {
        values = [values];
    }

    values = values.filter(Boolean);

    if (!alert || !messages || values.length < 1) {
        return;
    }

    dom.update(() => {
        node.html(messages, render.template(template, values));
        state.activate(alert);

        if (!seconds) {
            return;
        }

        setTimeout(() => {
            deactivate(key);
        }, 1000 * seconds);
    });
}

function deactivate(key) {
    dom.update(() => {
        state.deactivate( dom.element(ref.alert(key)) );
    });
}


const error = (messages, seconds = 0) => {
    activate('error', messages, seconds);
};

const info = (messages, seconds = 0) => {
    activate('info', messages, seconds);
};

const messages = (messages) => {
    error(messages.error || []);
    info(messages.info || []);
    success(messages.success || []);
};

const success = (messages, seconds = 0) => {
    activate('success', messages, seconds);
};


export default {
    deactivate: {
        error: () => {
            deactivate('error');
        },
        info: () => {
            deactivate('info');
        },
        success: () => {
            deactivate('success');
        }
    },
    error, info, messages, success
};
