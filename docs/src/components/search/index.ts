import { command, nav, search } from '@esportsplus/ui/components';
import { redirect } from 'docs/app';
import { sections } from 'docs/data/nav';
import 'docs/components/search/scss/index.scss';


// The docs' one search: its modal mounts in the viewer shell, so Mod+K works with the sidebar closed, and the sidebar
// holds the trigger.
const state = search.state();


const modal = () => {
    let navigation = sections(),
        links = new Map(navigation.flatMap((section) => section.links.map((link) => [link.href, link] as const)));

    return search.modal({
        [command.dialog]: { class: 'overlay--blur docs-search' },
        commands: navigation.flatMap((section) => section.links.map(({ href, label }) => ({ group: section.label, id: href, label }))),
        onrun: (entry) => {
            let link = links.get(entry.id);

            if (link) {
                redirect(link.name, { slug: link.slug });
            }
        },
        placeholder: 'Search documentation…',
        render: (groups) => nav.tree({
            current: 'command',
            sections: groups.map((group) => ({
                label: group.label,
                groups: [{
                    links: group.items.map((item) => ({
                        attributes: item.attributes,
                        content: item.content,
                        href: item.id,
                        label: item.label
                    }))
                }]
            })),
            [nav.tree.highlight]: {}
        }),
        state
    });
};

const trigger = () => search.trigger({ class: 'button--tactile', state });


export { modal, trigger };
