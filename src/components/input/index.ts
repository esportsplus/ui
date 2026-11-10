import field from './field';
import otp from './otp';
import password from './password';
import scrub from './scrub';
import search from './search';
import tag from './tag';
import './scss/index.scss';


const input: typeof field & { otp: typeof otp, password: typeof password, scrub: typeof scrub, search: typeof search, tag: typeof tag } = Object.assign(field, { otp, password, scrub, search, tag });


export default input;
