import { editor, type EditorAttributes } from '../code/editor';
import { view, type MarkdownController, type MarkdownOptions } from './view';


type MarkdownEditorAttributes = EditorAttributes<MarkdownController, MarkdownOptions>;


export default editor<MarkdownController, MarkdownOptions>(view, { wrap: true });
export type { MarkdownController, MarkdownEditorAttributes, MarkdownOptions };
