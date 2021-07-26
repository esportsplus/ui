const glob = require('glob');
const path = require('path');


const config = ({ filename, input, output, production }) => {
    let optimization = {},
        paths = {
            current: path.resolve(__dirname),
            input: path.resolve(process.cwd() + `/${input || ''}`),
            output: path.resolve(process.cwd() + `/${output || ''}`)
        };

    if (production === 'false') {
        optimization = {
            mangleWasmImports: false,
            minimize: false
        };
    }

    return {
        entry: {
            [filename || 'app']: glob.sync(`{${paths.input},${paths.current}}/{,!(node_modules)/**/}!(webpack)*.js`)
        },
        mode: (production === 'false' ? 'development' : 'production'),
        optimization,
        output: {
            path: paths.output,
        },
        resolve: {
            fallback: {
                fs: false
            }
        }
    };
};


module.exports = config;
