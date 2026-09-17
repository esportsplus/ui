import { html } from '~/viewer/app';
import { layout } from '~/viewer/components/preview';
import readme from '/README.md?raw';
import type { Router } from '~/viewer/app';
import type { Page } from '~/viewer/types';


function escape(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function inline(value: string) {
    return escape(value)
        .replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdown(source: string) {
    let html: string[] = [],
        lines = source.replace(/\r\n/g, '\n').split('\n'),
        list: 'ol' | 'ul' | null = null;

    let closeList = () => {
        if (list !== null) {
            html.push(`</${list}>`);
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
                code.push(escape(lines[i]));
                i++;
            }

            html.push(`<pre class="--scrollbar"><code>${code.join('\n')}</code></pre>`);
            continue;
        }

        let heading = line.match(/^(#{1,4})\s+(.*)$/);

        if (heading) {
            closeList();
            html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
            continue;
        }

        if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
            closeList();
            html.push('<hr />');
            continue;
        }

        if (line.trim().startsWith('|') && lines[i + 1] && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
            closeList();

            let cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()),
                head = cells(line);

            i += 2;

            let body: string[][] = [];

            while (i < n && lines[i].trim().startsWith('|')) {
                body.push(cells(lines[i]));
                i++;
            }

            i--;

            html.push(
                '<table><thead><tr>' +
                head.map((cell) => `<th>${inline(cell)}</th>`).join('') +
                '</tr></thead><tbody>' +
                body.map((row) => '<tr>' + row.map((cell) => `<td>${inline(cell)}</td>`).join('') + '</tr>').join('') +
                '</tbody></table>'
            );
            continue;
        }

        let ordered = line.match(/^\s*\d+\.\s+(.*)$/),
            unordered = line.match(/^\s*[-*]\s+(.*)$/);

        if (ordered) {
            if (list !== 'ol') {
                closeList();
                html.push('<ol>');
                list = 'ol';
            }

            html.push(`<li>${inline(ordered[1])}</li>`);
            continue;
        }

        if (unordered) {
            if (list !== 'ul') {
                closeList();
                html.push('<ul>');
                list = 'ul';
            }

            html.push(`<li>${inline(unordered[1])}</li>`);
            continue;
        }

        closeList();

        if (line.trim() !== '') {
            html.push(`<p>${inline(line)}</p>`);
        }
    }

    closeList();

    return html.join('\n');
}


const page = (): Page => ({
    render: () => html`
        <div class='page'>
            <div class='prose' ${{ onconnect: (element: HTMLElement) => { element.innerHTML = markdown(readme); } }}></div>
        </div>
    `,
    toc: []
});


export { page };
export default (r: Router) => r
    .get({ name: 'docs', path: '/docs', responder: () => layout(page()) })
    .get({ name: 'home', path: '/', responder: () => layout(page()) });
