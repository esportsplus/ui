import { reactive } from '@esportsplus/reactivity';


const DEFAULT_SECTION = 'docs';


const state = reactive({ section: DEFAULT_SECTION, slug: '' });


function parse() {
    let hash = location.hash.replace(/^#\/?/, ''),
        [section, slug] = hash.split('/');

    state.section = section || DEFAULT_SECTION;
    state.slug = slug ? decodeURIComponent(slug) : '';
}


const href = (section: string, slug?: string) => slug ? `#/${section}/${slug}` : `#/${section}`;

const navigate = (section: string, slug?: string) => {
    location.hash = href(section, slug);
};


parse();

window.addEventListener('hashchange', parse);


export { href, navigate, state };
