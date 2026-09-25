import { rangeBubbleVariations, rangeVariations } from './form-prototypes';


export default {
    name: 'range',
    variants: [...rangeVariations(), ...rangeBubbleVariations()]
};
