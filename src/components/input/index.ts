import field from './field';
import scrub from './scrub';
import tag from './tag';
import './scss/index.scss';


const input: typeof field & { scrub: typeof scrub, tag: typeof tag } = Object.assign(field, { scrub, tag });


export default input;
