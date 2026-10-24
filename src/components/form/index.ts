import action from './action';
import input from './input';
import './scss/index.scss';


const form: { action: typeof action, input: typeof input } = { action, input };


export default form;
