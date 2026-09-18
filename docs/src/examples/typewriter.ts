import { typewriter } from '@esportsplus/ui';


export default {
    name: 'typewriter',
    variants: [
        {
            render: () => typewriter({}, ['Build once.', 'Ship everywhere.', '@esportsplus/ui']),
            title: 'cycling text'
        }
    ]
};
