import button from './button';
import input from './input';
import './scss/index.scss';


const search: {
    button: typeof button,
    input: typeof input
} = { button, input };


export default search;
