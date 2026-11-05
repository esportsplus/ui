import { ts as ast } from '@esportsplus/typescript';
import { plugin } from '@esportsplus/typescript/compiler';


const PREFIX = 'virtual:docs-example-source/';


// A declaration a snippet copies, whose own references the snippet then follows
function copies(declaration, statement) {
    if (ast.isImportDeclaration(statement)) {
        return false;
    }

    return (ast.isVariableDeclaration(declaration) && ast.isVariableStatement(statement) && declaration.parent === statement.declarationList)
        || (statement === declaration && (ast.isFunctionDeclaration(declaration) || ast.isTypeAliasDeclaration(declaration) || ast.isInterfaceDeclaration(declaration) || ast.isEnumDeclaration(declaration)));
}

function dedent(text) {
    let lines = text.replace(/\r\n/g, '\n').split('\n'),
        widths = lines.slice(1).filter((line) => line.trim()).map((line) => line.match(/^\s*/)[0].length),
        indent = Math.min(...widths);

    return lines.map((line, index) => index === 0 ? line : line.slice(Math.min(indent, line.match(/^\s*/)[0].length))).join('\n');
}

function inside(node, container) {
    return node.getSourceFile().fileName === container.getSourceFile().fileName && node.pos >= container.pos && node.end <= container.end;
}

function key(handle) {
    return `${handle.path}#${handle.index}`;
}

// Everything the walks of a file's renderers read, asked for together: the symbol of every
// identifier they can reach and this file's declarations of those symbols. A copied declaration's
// identifiers are only known once it resolves, so each depth of helpers costs one more request.
async function resolve(checker, sourceFile, renders) {
    let declarations = new Map(),
        nodes = renders,
        symbols = new Map();

    while (nodes.length > 0) {
        let handles = [],
            references = [],
            shorthands = [];

        for (let node of nodes) {
            walk(node, (reference) => {
                if (!ast.isIdentifier(reference) || symbols.has(reference)) {
                    return;
                }

                if (ast.isShorthandPropertyAssignment(reference.parent)) {
                    shorthands.push(reference);
                }
                else {
                    references.push(reference);
                }
            });
        }

        let [found, values] = await Promise.all([
            checker.getSymbolAtLocation(references),
            Promise.all(shorthands.map((reference) => checker.getShorthandAssignmentValueSymbol(reference.parent)))
        ]);

        for (let i = 0, n = references.length; i < n; i++) {
            symbols.set(references[i], found[i]);
        }

        for (let i = 0, n = shorthands.length; i < n; i++) {
            symbols.set(shorthands[i], values[i]);
        }

        for (let symbol of [...found, ...values]) {
            for (let handle of symbol?.declarations ?? []) {
                let id = key(handle);

                if (handle.path !== sourceFile.path || declarations.has(id)) {
                    continue;
                }

                declarations.set(id, undefined);
                handles.push(handle);
            }
        }

        let resolved = await Promise.all(handles.map((handle) => handle.resolve()));

        nodes = [];

        for (let i = 0, n = handles.length; i < n; i++) {
            let declaration = resolved[i];

            declarations.set(key(handles[i]), declaration);

            if (declaration && copies(declaration, statement(declaration, sourceFile))) {
                nodes.push(declaration);
            }
        }
    }

    return { declarations, symbols };
}

// Follow symbols rather than names: a local variable named `state` must not pull in an unrelated helper.
function snippet(answers, sourceFile, render) {
    let declarations = new Map(),
        imports = new Map(),
        captures = new Set(),
        visited = new Set();

    function dependencies(node) {
        let references = [];

        walk(node, (reference) => {
            if (ast.isIdentifier(reference)) {
                references.push(reference);
            }
        });

        for (let reference of references) {
            let symbol = answers.symbols.get(reference);

            if (!symbol || visited.has(symbol.id)) {
                continue;
            }

            visited.add(symbol.id);

            for (let handle of symbol.declarations ?? []) {
                let declaration = answers.declarations.get(key(handle));

                if (!declaration || inside(declaration, node) || inside(declaration, render)) {
                    continue;
                }

                let parent = statement(declaration, sourceFile);

                if (ast.isImportDeclaration(parent)) {
                    imports.set(parent.pos, parent.getText(sourceFile));
                }
                else if (ast.isVariableDeclaration(declaration) && ast.isVariableStatement(parent) && declaration.parent === parent.declarationList) {
                    let keyword = parent.getText(sourceFile).match(/\b(const|let|var)\b/)[0];

                    declarations.set(declaration.pos, `${keyword} ${dedent(declaration.getText(sourceFile))};`);
                    dependencies(declaration);
                }
                else if (copies(declaration, parent)) {
                    declarations.set(declaration.pos, dedent(declaration.getText(sourceFile)).replace(/^export\s+/, ''));
                    dependencies(declaration);
                }
                else if (ast.isParameterDeclaration(declaration) || ast.isBindingElement(declaration) || ast.isVariableDeclaration(declaration)) {
                    // Values closed over by map/factory-generated variants belong to this selected example.
                    captures.add(reference.text);
                }
            }
        }
    }

    dependencies(render);

    for (let node of sourceFile.statements) {
        if (ast.isImportDeclaration(node) && !node.importClause) {
            imports.set(node.pos, node.getText(sourceFile));
        }
    }

    let ordered = (parts, separator = '\n\n') => [...parts].sort(([a], [b]) => a - b).map(([, text]) => text).join(separator),
        header = ordered(imports, '\n'),
        helpers = ordered(declarations),
        example = `export const example = ${dedent(render.getText(sourceFile))};`;

    return { captures: [...captures], example, header, helpers };
}

async function snippets({ checker, sourceFile }, renders) {
    let answers = await resolve(checker, sourceFile, renders);

    return renders.map((render) => snippet(answers, sourceFile, render));
}

// The file's top-level statement a declaration belongs to
function statement(declaration, sourceFile) {
    let node = declaration;

    while (node.parent && node.parent !== sourceFile) {
        node = node.parent;
    }

    return node;
}

function walk(node, visit) {
    visit(node);
    node.forEachChild((child) => { walk(child, visit); });
}


// Each example's source is a virtual module its compile emits; the host serves it, keeps it with a
// reused result and invalidates it with the example on HMR
function exampleSource() {
    return plugin.vite({
        name: 'docs-example-source',
        plugins: [{
            patterns: ['render:'],
            async transform(context) {
                let { sourceFile } = context,
                    modules = new Map(),
                    renders = [],
                    replacements = [];

                if (!sourceFile.fileName.replace(/\\/g, '/').includes('/docs/src/examples/')) {
                    return {};
                }

                walk(sourceFile, (node) => {
                    if (!ast.isObjectLiteralExpression(node)) {
                        return;
                    }

                    let render = node.properties.find((property) => property.name?.getText(sourceFile) === 'render'),
                        title = node.properties.find((property) => property.name?.getText(sourceFile) === 'title');

                    if (!render?.initializer || !title || node.properties.some((property) => property.name?.getText(sourceFile) === 'source')) {
                        return;
                    }

                    renders.push(render);
                });

                // Every checker answer is in before generate runs: generators are synchronous
                let results = await snippets(context, renders.map((render) => render.initializer));

                for (let i = 0, n = renders.length; i < n; i++) {
                    let { captures, example, header, helpers } = results[i],
                        render = renders[i],
                        id = `${PREFIX}${encodeURIComponent(sourceFile.fileName)}/${render.pos}`;

                    modules.set(id, `export default (values) => [
                            ${JSON.stringify(header)},
                            ${JSON.stringify(helpers)},
                            Object.entries(values).map(([name, value]) => 'const ' + name + ' = ' + JSON.stringify(value, null, 4) + ';').join('\\n'),
                            ${JSON.stringify(example)}
                        ].filter(Boolean).join('\\n\\n');`);

                    // text(render): the property as compiled by every plugin, the template compiler included
                    replacements.push({
                        node: render,
                        generate: (_, text) => `${text(render)}, source: () => import(${JSON.stringify(id)}).then((module) => module.default({ ${captures.join(', ')} }))`
                    });
                }

                return { modules, replacements };
            }
        }]
    })();
}


export { dedent, snippets };
export default exampleSource;
