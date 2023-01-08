import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import { default as MiniCssExtractPlugin } from 'mini-css-extract-plugin';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import glob from 'glob';
import path from 'path';
import sass from 'sass';


const scss = (pattern, { normalizer, ui } = {}) => {
    let scss = glob.sync(path.resolve(pattern).replace(/\\/g, '/'), { nosort: true });

    if (ui) {
        let str = typeof ui === 'string';

        scss.push(`@esportsplus/ui/build/css/css-utilities${str ? `.${str}` : ''}.scss`);
        scss.unshift(`@esportsplus/ui/build/css/components${str ? `.${str}` : ''}.scss`);
    }

    if (normalizer) {
        scss.unshift('modern-normalize/modern-normalize.css');
    }

    return scss.flat();
};


export default (entry, output, production) => {
    output = path.resolve(output).replace(/\\/g, '/');
    production = production !== 'false' ? true : false;

    return {
        entry,
        mode: (production ? 'production' : 'development'),
        module: {
            rules: [
                {
                    test: /\.(c|sc|sa)ss$/,
                    use: [
                        {
                            loader: MiniCssExtractPlugin.loader,
                            options: {
                                esModule: false,
                            },
                        },
                        {
                            loader: 'css-loader',
                            options: {
                                // Prevents Following Urls To Fonts/Images
                                url: false,
                                importLoaders: 1
                            }
                        },
                        {
                            loader: 'postcss-loader',
                            options: {
                                postcssOptions: {
                                    plugins: [
                                        autoprefixer(),
                                        cssnano({
                                            preset: 'default',
                                        })
                                    ]
                                }
                            }
                        },
                        {
                            loader: 'sass-loader',
                            options: {
                                // Use `dart-sass`
                                implementation: sass,
                            },
                        },
                    ],
                },
            ],
        },
        optimization: {
            minimize: production
        },
        output: {
            path: output,
        },
        plugins: [
            new MiniCssExtractPlugin(),
            new CleanWebpackPlugin({
                cleanAfterEveryBuildPatterns: [`${output}/**/*.js`],
                cleanOnceBeforeBuildPatterns: [],
                dangerouslyAllowCleanPatternsOutsideProject: false,
                dry: false,
                verbose: false
            })
        ],
        watch: !production
    };
};
export { scss };