import { ts as ast } from '@esportsplus/typescript';
import { plugin } from '@esportsplus/typescript/compiler';


const PREFIX = 'virtual:docs-example-source/';


function walk(node, visit) {
    visit(node);
    node.forEachChild((child) => { walk(child, visit); });
}

function inside(node, container) {
    return node.getSourceFile().fileName === container.getSourceFile().fileName && node.pos >= container.pos && node.end <= container.end;
}

function dedent(text) {
    let lines = text.replace(/\r\n/g, '\n').split('\n'),
        widths = lines.slice(1).filter((line) => line.trim()).map((line) => line.match(/^\s*/)[0].length),
        indent = Math.min(...widths);

    return lines.map((line, index) => index === 0 ? line : line.slice(Math.min(indent, line.match(/^\s*/)[0].length))).join('\n');
}

// Follow symbols rather than names: a local variable named `state` must not pull in an unrelated helper.
function snippet(context, render) {
    let { checker, sourceFile } = context,
        declarations = new Map(),
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

        let symbols = checker.getSymbolAtLocation(references);

        for (let [index, reference] of references.entries()) {
            let symbol = ast.isShorthandPropertyAssignment(reference.parent)
                ? checker.getShorthandAssignmentValueSymbol(reference.parent)
                : symbols[index];

            if (!symbol || visited.has(symbol.id)) {
                continue;
            }

            visited.add(symbol.id);

            for (let handle of symbol.declarations ?? []) {
                let declaration = handle.resolve();

                if (!declaration || declaration.getSourceFile().fileName !== sourceFile.fileName || inside(declaration, node) || inside(declaration, render)) {
                    continue;
                }

                let statement = declaration;

                while (statement.parent && statement.parent !== sourceFile) {
                    statement = statement.parent;
                }

                if (ast.isImportDeclaration(statement)) {
                    imports.set(statement.pos, statement.getText(sourceFile));
                }
                else if (ast.isVariableDeclaration(declaration) && ast.isVariableStatement(statement) && declaration.parent === statement.declarationList) {
                    let keyword = statement.getText(sourceFile).match(/\b(const|let|var)\b/)[0];

                    declarations.set(declaration.pos, `${keyword} ${dedent(declaration.getText(sourceFile))};`);
                    dependencies(declaration);
                }
                else if (statement === declaration && (ast.isFunctionDeclaration(declaration) || ast.isTypeAliasDeclaration(declaration) || ast.isInterfaceDeclaration(declaration) || ast.isEnumDeclaration(declaration))) {
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

    for (let statement of sourceFile.statements) {
        if (ast.isImportDeclaration(statement) && !statement.importClause) {
            imports.set(statement.pos, statement.getText(sourceFile));
        }
    }

    let ordered = (parts, separator = '\n\n') => [...parts].sort(([a], [b]) => a - b).map(([, text]) => text).join(separator),
        header = ordered(imports, '\n'),
        helpers = ordered(declarations),
        example = `export const example = ${dedent(render.getText(sourceFile))};`;

    return { captures: [...captures], example, header, helpers };
}


function exampleSource() {
    let modules = new Map(),
        compiler = plugin.vite({
            name: 'docs-example-source',
            plugins: [{
                patterns: ['render:'],
                transform(context) {
                    let { sourceFile } = context,
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

                        let { captures, example, header, helpers } = snippet(context, render.initializer),
                            id = `${PREFIX}${encodeURIComponent(sourceFile.fileName)}/${render.pos}`;

                        modules.set(id, { file: sourceFile.fileName.replace(/\\/g, '/').toLowerCase(), code: `export default (values) => [
                            ${JSON.stringify(header)},
                            ${JSON.stringify(helpers)},
                            Object.entries(values).map(([name, value]) => 'const ' + name + ' = ' + JSON.stringify(value, null, 4) + ';').join('\\n'),
                            ${JSON.stringify(example)}
                        ].filter(Boolean).join('\\n\\n');` });

                        replacements.push({
                            node: render,
                            generate: () => `${render.getText(sourceFile)}, source: () => import(${JSON.stringify(id)}).then((module) => module.default({ ${captures.join(', ')} }))`
                        });
                    });

                    return { replacements };
                }
            }]
        })();

    return {
        ...compiler,
        handleHotUpdate(context) {
            let updated = compiler.handleHotUpdate(context) ?? context.modules,
                file = context.file.replace(/\\/g, '/').toLowerCase(),
                snippets = [];

            for (let [id, module] of modules) {
                if (module.file !== file) {
                    continue;
                }

                let loaded = context.server.moduleGraph.getModuleById(`\0${id}`);

                if (loaded) {
                    context.server.moduleGraph.invalidateModule(loaded);
                    snippets.push(loaded);
                }
            }

            return [...new Set([...updated, ...snippets])];
        },
        resolveId(id) {
            return id.startsWith(PREFIX) ? `\0${id}` : null;
        },
        load(id) {
            return id.startsWith(`\0${PREFIX}`) ? modules.get(id.slice(1))?.code : null;
        }
    };
}


export { dedent, snippet };
export default exampleSource;
