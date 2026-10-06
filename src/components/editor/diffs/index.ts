import merge from './merge';
import view from './view';
import '~/css-utilities/scrollbar/scss/index.scss';
import './scss/index.scss';


const diffs: typeof view & { merge: typeof merge } = Object.assign(view, { merge });


export default diffs;
export { conflictMarkers, diff3, resolveMarker } from './diff3';
export { changes, diffLines, diffSequences } from './engine';
export { acceptChange, diffTexts, hunks, revertChange } from './hunks';
export { words } from './words';
export type { ConflictMarker, MergeChoice, MergeRegion, MergeResult } from './diff3';
export type { Change, Op, Range } from './engine';
export type { Diff, DiffChange, Hunk, Layout, Row, RowType } from './hunks';
export type { MergeAttributes } from './merge';
export type { DiffsAttributes, DiffsController, DiffsState, Mode } from './view';
export type { Words } from './words';
