import { html } from '../../app';
import type { Renderable } from '../../app';
import '../spec/scss/index.scss';
import './scss/index.scss';


const HEADING = /^(#{1,4})\s+(.*)$/;

const HORIZONTAL_RULE = /^(-{3,}|\*{3,})$/;

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/;

const INLINE_LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;

const LINE_BREAK = /\r\n/g;

const ORDERED_LIST = /^\s*\d+\.\s+(.*)$/;

const TABLE_BORDER = /^\||\|$/g;

const TABLE_SEPARATOR = /^\s*\|?[\s:|-]+\|?\s*$/;

const UNORDERED_LIST = /^\s*[-*]\s+(.*)$/;


function inline(value: string) {
    let output: Renderable<unknown>[] = [],
        remaining = value,
        match: RegExpExecArray | null;

    while ((match = INLINE.exec(remaining)) !== null) {
        if (match.index > 0) {
            output.push(remaining.slice(0, match.index));
        }

        let token = match[0];

        if (token.startsWith('`')) {
            output.push(html`<code>${token.slice(1, -1)}</code>`);
        }
        else if (token.startsWith('**')) {
            output.push(html`<strong>${inline(token.slice(2, -2))}</strong>`);
        }
        else {
            let link = token.match(INLINE_LINK)!;

            output.push(html`<a href='${link[2]}'>${inline(link[1])}</a>`);
        }

        remaining = remaining.slice(match.index + token.length);
    }

    if (remaining !== '') {
        output.push(remaining);
    }

    return output;
}

function markdown(source: string) {
    let renderables: Renderable<unknown>[] = [],
        lines = source.replace(LINE_BREAK, '\n').split('\n'),
        list: { items: Renderable<unknown>[]; type: 'ol' | 'ul' } | null = null;

    let closeList = () => {
        if (list !== null) {
            let { items, type } = list;

            renderables.push(type === 'ol' ? html`<ol>${items}</ol>` : html`<ul>${items}</ul>`);
            list = null;
        }
    };

    for (let i = 0, n = lines.length; i < n; i++) {
        let line = lines[i];

        if (line.startsWith('```')) {
            closeList();

            let code: string[] = [];

            i++;

            while (i < n && !lines[i].startsWith('```')) {
                code.push(lines[i]);
                i++;
            }

            renderables.push(html`<pre class="--scrollbar"><code>${code.join('\n')}</code></pre>`);
            continue;
        }

        let heading = line.match(HEADING);

        if (heading) {
            closeList();

            let content = inline(heading[2]);

            if (heading[1].length === 1) {
                renderables.push(html`<h1>${content}</h1>`);
            }
            else if (heading[1].length === 2) {
                renderables.push(html`<h2>${content}</h2>`);
            }
            else if (heading[1].length === 3) {
                renderables.push(html`<h3>${content}</h3>`);
            }
            else {
                renderables.push(html`<h4>${content}</h4>`);
            }

            continue;
        }

        if (HORIZONTAL_RULE.test(line.trim())) {
            closeList();
            renderables.push(html`<hr />`);
            continue;
        }

        if (line.trim().startsWith('|') && lines[i + 1] && TABLE_SEPARATOR.test(lines[i + 1])) {
            closeList();

            let cells = (row: string) => row.trim().replace(TABLE_BORDER, '').split('|').map((cell) => cell.trim()),
                head = cells(line);

            i += 2;

            let body: string[][] = [];

            while (i < n && lines[i].trim().startsWith('|')) {
                body.push(cells(lines[i]));
                i++;
            }

            i--;

            renderables.push(html`
                <table class='spec-table'>
                    <thead class='table-head'>
                        <tr>${head.map((cell) => html`<th>${inline(cell)}</th>`)}</tr>
                    </thead>
                    <tbody>
                        ${body.map((row) => html`<tr>${row.map((cell) => html`<td>${inline(cell)}</td>`)}</tr>`)}
                    </tbody>
                </table>
            `);
            continue;
        }

        let ordered = line.match(ORDERED_LIST),
            unordered = line.match(UNORDERED_LIST);

        if (ordered) {
            if (list === null || list.type !== 'ol') {
                closeList();
                list = { items: [], type: 'ol' };
            }

            list.items.push(html`<li>${inline(ordered[1])}</li>`);
            continue;
        }

        if (unordered) {
            if (list === null || list.type !== 'ul') {
                closeList();
                list = { items: [], type: 'ul' };
            }

            list.items.push(html`<li>${inline(unordered[1])}</li>`);
            continue;
        }

        closeList();

        if (line.trim() !== '') {
            renderables.push(html`<p>${inline(line)}</p>`);
        }
    }

    closeList();

    return renderables;
}


const prose = (source: string) => html`<div class='prose'>${markdown(source)}</div>`;


export { prose };
