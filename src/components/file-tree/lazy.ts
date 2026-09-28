import { html, type Attributes } from '@esportsplus/template';
import loading from '~/components/loading';
import type { FileTreeElement as Element } from '.';


type Load = (element: Element) => Promise<Element[]>;

type Notice = { reason: string; type: 'error' } | { type: 'loading' };

type Settled = (id: string, children: Element[] | null) => void;


function reason(error: unknown) {
    return (error instanceof Error ? error.message : typeof error === 'string' ? error : '') || `Couldn't load this folder`;
}


// Children of folders that aren't known until they open, fetched once per folder at a time. A failure holds until
// it's forgotten, which closing the folder does, so reopening it tries again.
class Loader {
    private load: Load;
    private notices = new Map<string, Notice>();
    private settled: Settled;


    constructor(load: Load, settled: Settled) {
        this.load = load;
        this.settled = settled;
    }


    // Drops a failure so the next request loads again; true when there was one.
    forget(id: string) {
        if (this.notices.get(id)?.type !== 'error') {
            return false;
        }

        this.notices.delete(id);

        return true;
    }

    // What the folder shows in place of its children, starting the load when none is under way.
    request(element: Element) {
        let id = element.id,
            notice = this.notices.get(id);

        if (notice) {
            return notice;
        }

        let pending: Notice = { type: 'loading' };

        this.notices.set(id, pending);
        this.load(element).then(
            (children) => {
                if (this.notices.get(id) === pending) {
                    this.notices.delete(id);
                    this.settled(id, children);
                }
            },
            (error: unknown) => {
                if (this.notices.get(id) === pending) {
                    this.notices.set(id, { reason: reason(error), type: 'error' });
                    this.settled(id, null);
                }
            }
        );

        return pending;
    }
}


// Stands in the row under a folder while its children load, or says why they couldn't; the error row retries.
const placeholder = (notice: Notice, attributes: Attributes) => html`
    <div
        class='file-tree-row file-tree-notice'
        role='treeitem'
        ${notice.type === 'error' ? { 'data-tone': 'error' } : { 'aria-busy': 'true' }}
        ${attributes}
    >
        <span aria-hidden='true' class='file-tree-twistie'></span>
        ${notice.type === 'error'
            ? html`
                <span class='file-tree-name' title='${notice.reason}'>${notice.reason}</span>
                <span class='file-tree-badge'>Retry</span>
            `
            : html`
                ${loading({ 'aria-hidden': 'true', class: 'file-tree-spinner' })}
                <span class='file-tree-name'>Loading…</span>
            `}
    </div>
`;


export default Loader;
export { placeholder };
export type { Load, Notice };
