import copy from './copy';
import fan from './fan';
import hold from './hold';
import kbd from './kbd';
import loading from './loading';
import './scss/index.scss';


const button: { copy: typeof copy, fan: typeof fan, hold: typeof hold, kbd: typeof kbd, loading: typeof loading } = { copy, fan, hold, kbd, loading };


export default button;
