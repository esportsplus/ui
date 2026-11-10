import field from './field';
import otp from './otp';
import password from './password';
import scrub from './scrub';
import tag from './tag';
import './scss/index.scss';


const input: typeof field & { otp: typeof otp, password: typeof password, scrub: typeof scrub, tag: typeof tag } = Object.assign(field, { otp, password, scrub, tag });


export default input;
