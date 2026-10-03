import frostBlur from '../../shared/frost-blur';
import './scss/index.scss';


export default () => ({
    class: '--glass',
    onconnect: (element: HTMLElement) => {
        if (!element.querySelector(':scope > .--glass-blur')) {
            element.appendChild(frostBlur(element, '--glass-blur'));
        }
    }
});
