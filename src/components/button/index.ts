import copy from './copy';
import fan from './fan';
import hold from './hold';
import kbd from './kbd';
import loading from './loading';
import morph from './morph';
import sidebar from './sidebar';
import './scss/index.scss';


const button: {
    copy: typeof copy,
    fan: typeof fan,
    hold: typeof hold,
    kbd: typeof kbd,
    loading: typeof loading,
    morph: typeof morph,
    sidebar: typeof sidebar
} = { copy, fan, hold, kbd, loading, morph, sidebar };


export default button;
