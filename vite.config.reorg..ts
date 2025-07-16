import { build, defineConfig, PluginOption } from 'vite';
import autoprefixer from 'autoprefixer';


export default (): PluginOption => {
    let key = 'VITE_REORGANIZE_SCSS_ORDER',
        outDir = '',
        replacing,
        scss = new Set<string>();

    return {
        configResolved(config) {
            outDir = config.build.outDir;
        },
        async closeBundle() {
            if (process.env[key]) {
                return;
            }

            process.env[key] = '1';

            let normalize: string | undefined = undefined,
                sorted: string[] = [];

            for (let file of scss) {
                if (file.indexOf('@esportsplus/ui/build/components/normalize') !== -1) {
                    normalize = file;
                }
                else if (file.indexOf('@esportsplus/ui/build/css-utilities/') !== -1) {
                    sorted.unshift(file);
                }
                else {
                    sorted.push(file);
                }
            }

            if (normalize) {
                sorted.unshift(normalize);
            }

            await build(
                defineConfig({
                    build: {
                        cssMinify: 'lightningcss',
                        outDir,
                        rollupOptions: {
                            input: sorted,
                            output: {
                                assetFileNames: ({ originalFileNames: [filename] }) => {
                                    if (filename && filename.endsWith('.css')) {
                                        return replacing;
                                    }

                                    return '[name].[ext]';
                                }
                            }
                        }
                    },
                    css: {
                        postcss: {
                            plugins: [
                                autoprefixer()
                            ]
                        },
                        transformer: 'lightningcss'
                    },
                })
            );

            delete process.env[key];
        },
        generateBundle(_, bundle) {
            if (process.env[key]) {
                return;
            }

            for (let key in bundle) {
                if (key.endsWith('.css')) {
                    replacing = key;
                    return;
                }
            }
        },
        load(id) {
            if (id.endsWith('.scss')) {
                scss.add(id);
            }
        },
        name: '@esportsplus/ui'
    };
};