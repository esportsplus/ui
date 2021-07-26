import { alert } from 'ui/components';
import { directive } from 'ui/lib';


const copy = function(data) {
    let target = this.refs.copy;

    if (!target) {
        return;
    }

    target.select();

    document.execCommand('copy');

    alert.success('Copied to clipboard!', 2);
};


directive.on('copy', copy);
