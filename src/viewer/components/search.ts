import { reactive } from '~/viewer/app';


const search = reactive({ query: '' });


const matches = (label: string) => {
    let query = search.query.trim().toLowerCase();

    return query === '' || label.toLowerCase().includes(query);
};


export { matches, search };
