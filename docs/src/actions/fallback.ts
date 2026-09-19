import { layout } from '../components/layout';
import { page } from './docs';


export default {
    handler: () => layout(page()),
    name: null,
    path: null,
    subdomain: null
};
