import assetsOpen from '@esportsplus/ui/svg/folder-assets-open.svg';
import assets from '@esportsplus/ui/svg/folder-assets.svg';
import componentsOpen from '@esportsplus/ui/svg/folder-components-open.svg';
import components from '@esportsplus/ui/svg/folder-components.svg';
import docsOpen from '@esportsplus/ui/svg/folder-docs-open.svg';
import docs from '@esportsplus/ui/svg/folder-docs.svg';
import gitOpen from '@esportsplus/ui/svg/folder-git-open.svg';
import git from '@esportsplus/ui/svg/folder-git.svg';
import outputOpen from '@esportsplus/ui/svg/folder-output-open.svg';
import output from '@esportsplus/ui/svg/folder-output.svg';
import packagesOpen from '@esportsplus/ui/svg/folder-packages-open.svg';
import packages from '@esportsplus/ui/svg/folder-packages.svg';
import publicOpen from '@esportsplus/ui/svg/folder-public-open.svg';
import publicClosed from '@esportsplus/ui/svg/folder-public.svg';
import scriptsOpen from '@esportsplus/ui/svg/folder-scripts-open.svg';
import scripts from '@esportsplus/ui/svg/folder-scripts.svg';
import srcOpen from '@esportsplus/ui/svg/folder-src-open.svg';
import src from '@esportsplus/ui/svg/folder-src.svg';
import testOpen from '@esportsplus/ui/svg/folder-test-open.svg';
import test from '@esportsplus/ui/svg/folder-test.svg';


// Closed and open icons for folder names icon themes mark, keyed lowercase. A Map, so a folder named 'constructor'
// doesn't find Object's.
const FOLDERS = new Map<string, [string, string]>([
    ['.git', [git, gitOpen]],
    ['__tests__', [test, testOpen]],
    ['assets', [assets, assetsOpen]],
    ['bin', [scripts, scriptsOpen]],
    ['build', [output, outputOpen]],
    ['components', [components, componentsOpen]],
    ['dist', [output, outputOpen]],
    ['doc', [docs, docsOpen]],
    ['docs', [docs, docsOpen]],
    ['images', [assets, assetsOpen]],
    ['img', [assets, assetsOpen]],
    ['media', [assets, assetsOpen]],
    ['node_modules', [packages, packagesOpen]],
    ['out', [output, outputOpen]],
    ['packages', [packages, packagesOpen]],
    ['public', [publicClosed, publicOpen]],
    ['scripts', [scripts, scriptsOpen]],
    ['spec', [test, testOpen]],
    ['src', [src, srcOpen]],
    ['static', [assets, assetsOpen]],
    ['test', [test, testOpen]],
    ['tests', [test, testOpen]],
    ['vendor', [packages, packagesOpen]]
]);


export default FOLDERS;
