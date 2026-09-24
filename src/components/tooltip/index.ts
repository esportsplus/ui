import menu from './menu';
import onclick from './onclick';
import onhover from './onhover';
import './scss/index.scss';


const tooltip: { menu: typeof menu, onclick: typeof onclick, onhover: typeof onhover } = { menu, onclick, onhover };


export default tooltip;
