import field from './field';
import scrub from './scrub';
import './scss/index.scss';


const input: typeof field & { scrub: typeof scrub } = Object.assign(field, { scrub });


export default input;
