import copy from './copy';
import faces from './faces';
import kbd from './kbd';
import morph from './morph';
import sidebar from './sidebar';
import split from './split';
import './scss/index.scss';


const button: {
    copy: typeof copy,
    faces: typeof faces,
    kbd: typeof kbd,
    morph: typeof morph,
    sidebar: typeof sidebar,
    split: typeof split
} = { copy, faces, kbd, morph, sidebar, split };


export default button;
