import { waitlistJoin } from '@esportsplus/ui';
import ava from './waitlist-join-avatars/ava.svg?url';
import ben from './waitlist-join-avatars/ben.svg?url';
import cara from './waitlist-join-avatars/cara.svg?url';
import dev from './waitlist-join-avatars/dev.svg?url';
import fay from './waitlist-join-avatars/fay.svg?url';


// Faces are "Notionists" by Zoish (CC0 1.0). People further up the line are plain silhouettes: too far off to make out.
let queue = [
    { id: 'q0', name: 'Priya Nair' },
    { id: 'q1', name: 'Hugo Laurent' },
    { id: 'q2', name: 'Noah Fischer' },
    { id: 'q3', name: 'Lena Park' },
    { id: 'q4', name: 'Omar Haddad' },
    { avatar: ava, id: 'q5', name: 'Amara Okafor' },
    { avatar: ben, id: 'q6', name: 'Jonas Weber' },
    { avatar: cara, id: 'q7', name: 'Mei Tanaka' },
    { avatar: dev, id: 'q8', name: 'Rafael Costa' },
    { avatar: fay, id: 'q9', name: 'Sara Lindqvist' }
];


export default {
    name: 'waitlist-join',
    variants: [
        {
            render: () => waitlistJoin({ queue, waiting: 1283 }),
            title: 'private beta'
        },
        {
            render: () => waitlistJoin({
                linkBase: 'orbit.app/r',
                product: 'Orbit',
                queue: queue.slice(0, 5),
                skip: 20,
                style: '--accent: var(--color-blue-400);',
                waiting: 48210
            }),
            title: 'short queue, bigger skip'
        }
    ]
};
