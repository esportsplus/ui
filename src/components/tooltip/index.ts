import context from './context';
import menu from './menu';
import onclick from './onclick';
import onhover from './onhover';
import shared from './shared';
import './scss/index.scss';


const tooltip: { context: typeof context, menu: typeof menu, onclick: typeof onclick, onhover: typeof onhover, shared: typeof shared } = { context, menu, onclick, onhover, shared };


export default tooltip;
