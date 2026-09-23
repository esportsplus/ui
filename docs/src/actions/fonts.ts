import { pageHead } from '../components/page/head';
import { html } from '../app';
import { fonts } from '../data/scss';
import { layout } from '../components/layout';
import type { Router } from '../app';
import type { Page, TocItem } from '../types';


type Face = {
    family: string;
    formats: string;
    style: string;
    weight: string;
};

type Family = {
    faces: Face[];
    family: string;
    id: string;
    name: string;
    weights: string[];
};


function faces(source: string): Face[] {
    let blocks = source.match(/@font-face\s*\{[^}]*\}/g) ?? [],
        out: Face[] = [];

    for (let i = 0, n = blocks.length; i < n; i++) {
        let block = blocks[i],
            family = block.match(/font-family:\s*['"]?([^;'"]+)['"]?\s*;/),
            style = block.match(/font-style:\s*([^;]+);/),
            weight = block.match(/font-weight:\s*([^;]+);/);

        out.push({
            family: family ? family[1].trim() : '',
            formats: (block.match(/format\(['"]([^'"]+)['"]\)/g) ?? [])
                .map((token) => token.replace(/format\(['"]([^'"]+)['"]\)/, '$1'))
                .join(', '),
            style: style ? style[1].trim() : 'normal',
            weight: weight ? weight[1].trim() : '400'
        });
    }

    return out;
}

function families(): Family[] {
    return fonts().flatMap((font) => {
        let grouped = new Map<string, Face[]>();

        for (let face of faces(font.source)) {
            let group = grouped.get(face.family) ?? [];

            group.push(face);
            grouped.set(face.family, group);
        }

        return Array.from(grouped, ([family, parsed]) => {
            parsed.sort((a, b) => parseFloat(a.weight) - parseFloat(b.weight) || a.style.localeCompare(b.style));

            let weights: string[] = [],
                id = family.toLowerCase().replace(/\s+/g, '-');

            for (let face of parsed) {
                if (face.style !== 'normal') {
                    continue;
                }

                let [start, end = start] = face.weight.split(/\s+/).map(Number);

                for (let weight = start; weight <= end; weight += 100) {
                    if (!weights.includes(String(weight))) {
                        weights.push(String(weight));
                    }
                }
            }

            return { faces: parsed, family, id, name: font.name, weights };
        });
    });
}


const page = (): Page => {
    let rendered = families(),
        toc: TocItem[] = rendered.map((family) => ({ id: family.id, label: family.family }));

    return {
        render: () => html`
            <div class='page docs-page'>
                ${pageHead('Fonts', 'The typefaces bundled with the library, with a live specimen at every available weight and the raw @font-face definitions read from source.')}

                ${rendered.map((family) => html`
                    <section
                        id='${family.id}'
                        class='--font-${family.id}'
                        style='font-family: var(--font-family); font-weight: var(--font-weight-400);'
                    >
                        <h2 class='docs-page-section-title'>${family.family}</h2>

                        <div style='display: grid; gap: var(--size-400); margin-bottom: var(--size-500);'>
                            ${family.weights.map((weight) => html`
                                <div>
                                    <div class='spec-value'>${weight}</div>
                                    <div style="font-size: var(--font-size-500); font-weight: ${weight};">The quick brown fox jumps over the lazy dog</div>
                                </div>
                            `)}
                        </div>

                        <div class='spec-table-scroll'><table class='spec-table'>
                            <thead class='table-head'>
                                <tr><th>Weight</th><th>Style</th><th>Formats</th></tr>
                            </thead>
                            <tbody>
                                ${family.faces.map((face) => html`
                                    <tr>
                                        <td class='spec-name'>${face.weight}</td>
                                        <td>${face.style}</td>
                                        <td class='spec-value'>${face.formats}</td>
                                    </tr>
                                `)}
                            </tbody>
                        </table></div>
                    </section>
                `)}
            </div>
        `,
        toc
    };
};


export default (r: Router) => r
    .get({ name: 'fonts', path: '/fonts', responder: () => layout(page()) });
