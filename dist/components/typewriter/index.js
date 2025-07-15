import { html } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import './scss/index.scss';
const EMPTY_NODE = html ` `;
export default (content) => {
    let state = reactive({ text: '' });
    return {
        attributes: {
            class: 'typewriter',
            onmount: () => {
                let character = 0, i = 0, isWriting = true, write = content[i];
                function play() {
                    setTimeout(() => {
                        state.text = write.slice(0, character);
                        if (isWriting) {
                            if (character > write.length) {
                                isWriting = false;
                                setTimeout(play, 2000);
                                return;
                            }
                            else {
                                character++;
                            }
                        }
                        else {
                            if (character === 0) {
                                isWriting = true;
                                write = content[++i] || content[i = 0];
                            }
                            else {
                                character--;
                            }
                        }
                        play();
                    }, isWriting ? 64 : 32);
                }
                play();
            }
        },
        html: () => state.text || EMPTY_NODE
    };
};
