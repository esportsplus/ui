import context from './context';
import group from './group';
import menu from './menu';
import onclick from './onclick';
import onhover from './onhover';
import './scss/index.scss';


const tooltip: { context: typeof context, group: typeof group, menu: typeof menu, onclick: typeof onclick, onhover: typeof onhover } = { context, group, menu, onclick, onhover };


export default tooltip;
