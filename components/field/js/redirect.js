import { directive, dom } from 'ui/lib';


const redirect = function(e) {
    let current = window.location.pathname,
        value = this.get('refs.field.redirect').value;

    if (!value || [value, value.replace('/1', '')].includes(current)) {
        return;
    }

    window.location.href = window.location.href.replace(current, value);
};


directive.on('field.redirect', redirect);
