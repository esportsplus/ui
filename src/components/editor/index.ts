import code from './code';
import markdown from './markdown';
import tree from './tree';
import workspace from './workspace';


const editor: {
    code: typeof code,
    markdown: typeof markdown,
    tree: typeof tree,
    workspace: typeof workspace
} = { code, markdown, tree, workspace };


export default editor;
export * from './code';
export {
    createFileTreeIconResolver,
    FileTreeDecorations,
    FileTreeEditor,
    FileTreeElements,
    FileTreeHistory,
    fileTreeIcon,
    resolveFileTreeIcon
} from './tree';
export { EditorWorkspaceModel, isWorkspaceCodeEditor } from './workspace';
export type { MarkdownController, MarkdownEditorAttributes, MarkdownOptions } from './markdown';
export type * from './tree';
export type {
    CodeEditorWorkspaceAttributes,
    CodeEditorWorkspaceController,
    WorkspaceAction,
    WorkspaceConfirmation,
    WorkspaceDecision,
    WorkspaceEditor,
    WorkspaceEditorAttributes,
    WorkspaceEditorContext,
    WorkspaceEditorController,
    WorkspaceEntry,
    WorkspaceHost,
    WorkspacePreferences,
    WorkspaceTab,
    WorkspaceTarget
} from './workspace';
