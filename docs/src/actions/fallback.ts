import { layout } from 'docs/components/layout';
import { page } from 'docs/actions/docs';


export default {
    handler: () => layout(page()),
    name: null,
    path: null,
    subdomain: null
};
