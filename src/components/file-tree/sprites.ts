import agents from '@esportsplus/ui/svg/file-agents.svg';
import astro from '@esportsplus/ui/svg/file-astro.svg';
import babel from '@esportsplus/ui/svg/file-babel.svg';
import bash from '@esportsplus/ui/svg/file-bash.svg';
import biome from '@esportsplus/ui/svg/file-biome.svg';
import bootstrap from '@esportsplus/ui/svg/file-bootstrap.svg';
import browserslist from '@esportsplus/ui/svg/file-browserslist.svg';
import bun from '@esportsplus/ui/svg/file-bun.svg';
import c from '@esportsplus/ui/svg/file-c.svg';
import claude from '@esportsplus/ui/svg/file-claude.svg';
import css from '@esportsplus/ui/svg/file-css.svg';
import database from '@esportsplus/ui/svg/file-database.svg';
import docker from '@esportsplus/ui/svg/file-docker.svg';
import eslint from '@esportsplus/ui/svg/file-eslint.svg';
import font from '@esportsplus/ui/svg/file-font.svg';
import git from '@esportsplus/ui/svg/file-git.svg';
import go from '@esportsplus/ui/svg/file-go.svg';
import graphql from '@esportsplus/ui/svg/file-graphql.svg';
import html from '@esportsplus/ui/svg/file-html.svg';
import image from '@esportsplus/ui/svg/file-image.svg';
import javascript from '@esportsplus/ui/svg/file-javascript.svg';
import json from '@esportsplus/ui/svg/file-json.svg';
import markdown from '@esportsplus/ui/svg/file-markdown.svg';
import mcp from '@esportsplus/ui/svg/file-mcp.svg';
import nextjs from '@esportsplus/ui/svg/file-nextjs.svg';
import npm from '@esportsplus/ui/svg/file-npm.svg';
import oxc from '@esportsplus/ui/svg/file-oxc.svg';
import packageJson from '@esportsplus/ui/svg/file-package.svg';
import pnpm from '@esportsplus/ui/svg/file-pnpm.svg';
import postcss from '@esportsplus/ui/svg/file-postcss.svg';
import prettier from '@esportsplus/ui/svg/file-prettier.svg';
import python from '@esportsplus/ui/svg/file-python.svg';
import react from '@esportsplus/ui/svg/file-react.svg';
import readme from '@esportsplus/ui/svg/file-readme.svg';
import ruby from '@esportsplus/ui/svg/file-ruby.svg';
import rust from '@esportsplus/ui/svg/file-rust.svg';
import sass from '@esportsplus/ui/svg/file-sass.svg';
import stylelint from '@esportsplus/ui/svg/file-stylelint.svg';
import svelte from '@esportsplus/ui/svg/file-svelte.svg';
import svg from '@esportsplus/ui/svg/file-svg.svg';
import svgo from '@esportsplus/ui/svg/file-svgo.svg';
import swift from '@esportsplus/ui/svg/file-swift.svg';
import table from '@esportsplus/ui/svg/file-table.svg';
import tailwind from '@esportsplus/ui/svg/file-tailwind.svg';
import terraform from '@esportsplus/ui/svg/file-terraform.svg';
import text from '@esportsplus/ui/svg/file-text.svg';
import tsconfig from '@esportsplus/ui/svg/file-tsconfig.svg';
import typescript from '@esportsplus/ui/svg/file-typescript.svg';
import vite from '@esportsplus/ui/svg/file-vite.svg';
import vscode from '@esportsplus/ui/svg/file-vscode.svg';
import vue from '@esportsplus/ui/svg/file-vue.svg';
import wasm from '@esportsplus/ui/svg/file-wasm.svg';
import webpack from '@esportsplus/ui/svg/file-webpack.svg';
import yml from '@esportsplus/ui/svg/file-yml.svg';
import zig from '@esportsplus/ui/svg/file-zig.svg';
import zip from '@esportsplus/ui/svg/file-zip.svg';
import file from '@esportsplus/ui/svg/file.svg';
import assetsFolderOpen from '@esportsplus/ui/svg/folder-assets-open.svg';
import assetsFolder from '@esportsplus/ui/svg/folder-assets.svg';
import componentsFolderOpen from '@esportsplus/ui/svg/folder-components-open.svg';
import componentsFolder from '@esportsplus/ui/svg/folder-components.svg';
import docsFolderOpen from '@esportsplus/ui/svg/folder-docs-open.svg';
import docsFolder from '@esportsplus/ui/svg/folder-docs.svg';
import gitFolderOpen from '@esportsplus/ui/svg/folder-git-open.svg';
import gitFolder from '@esportsplus/ui/svg/folder-git.svg';
import folderOpen from '@esportsplus/ui/svg/folder-open.svg';
import outputFolderOpen from '@esportsplus/ui/svg/folder-output-open.svg';
import outputFolder from '@esportsplus/ui/svg/folder-output.svg';
import packagesFolderOpen from '@esportsplus/ui/svg/folder-packages-open.svg';
import packagesFolder from '@esportsplus/ui/svg/folder-packages.svg';
import publicFolderOpen from '@esportsplus/ui/svg/folder-public-open.svg';
import publicFolder from '@esportsplus/ui/svg/folder-public.svg';
import scriptsFolderOpen from '@esportsplus/ui/svg/folder-scripts-open.svg';
import scriptsFolder from '@esportsplus/ui/svg/folder-scripts.svg';
import srcFolderOpen from '@esportsplus/ui/svg/folder-src-open.svg';
import srcFolder from '@esportsplus/ui/svg/folder-src.svg';
import testFolderOpen from '@esportsplus/ui/svg/folder-test-open.svg';
import testFolder from '@esportsplus/ui/svg/folder-test.svg';
import folder from '@esportsplus/ui/svg/folder.svg';
import type { Folder, Name } from './icons';


const FILES: Readonly<Record<Name, string>> = {
    agents,
    astro,
    babel,
    bash,
    biome,
    bootstrap,
    browserslist,
    bun,
    c,
    claude,
    css,
    database,
    docker,
    eslint,
    file,
    font,
    git,
    go,
    graphql,
    html,
    image,
    javascript,
    json,
    markdown,
    mcp,
    nextjs,
    npm,
    oxc,
    package: packageJson,
    pnpm,
    postcss,
    prettier,
    python,
    react,
    readme,
    ruby,
    rust,
    sass,
    stylelint,
    svelte,
    svg,
    svgo,
    swift,
    table,
    tailwind,
    terraform,
    text,
    tsconfig,
    typescript,
    vite,
    vscode,
    vue,
    wasm,
    webpack,
    yml,
    zig,
    zip
};

// Closed and open, by the name the resolver reports.
const FOLDERS: Readonly<Record<'folder' | `folder-${Folder}`, readonly [string, string]>> = {
    folder: [folder, folderOpen],
    'folder-assets': [assetsFolder, assetsFolderOpen],
    'folder-components': [componentsFolder, componentsFolderOpen],
    'folder-docs': [docsFolder, docsFolderOpen],
    'folder-git': [gitFolder, gitFolderOpen],
    'folder-output': [outputFolder, outputFolderOpen],
    'folder-packages': [packagesFolder, packagesFolderOpen],
    'folder-public': [publicFolder, publicFolderOpen],
    'folder-scripts': [scriptsFolder, scriptsFolderOpen],
    'folder-src': [srcFolder, srcFolderOpen],
    'folder-test': [testFolder, testFolderOpen]
};


export { FILES, FOLDERS };
