import copy from './copy';
import fan from './fan';
import hold from './hold';
import kbd from './kbd';
import loading from './loading';
import morph from './morph';
import './scss/index.scss';


const button: { copy: typeof copy, fan: typeof fan, hold: typeof hold, kbd: typeof kbd, loading: typeof loading, morph: typeof morph } = { copy, fan, hold, kbd, loading, morph };


export default button;
