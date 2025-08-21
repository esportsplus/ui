import checkbox from './checkbox';
import description from './description';
import input from './input';
import select from './select';
import title from './title';
import './scss/index.scss';


const { checkbox: cb, radio, switch: sw } = checkbox;

const { file, range, text, textarea } = input;


export default { checkbox: cb, description, file, radio, range, select, switch: sw, textarea, text, title };
export { cb as checkbox, description, file, radio, range, select, sw as switch, textarea, text, title };