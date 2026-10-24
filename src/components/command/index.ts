import palette from './palette';
import search from './search';
import './scss/index.scss';


const command: typeof palette & { search: typeof search } = Object.assign(palette, { search });


export default command;
export type { Command, Matcher, Result, ResultGroup, Shortcut, State, Store, Tab } from './palette';
