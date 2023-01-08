const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const autoprefixer = require('autoprefixer');
const glob = require('glob');
const path = require('path');
const sass = require('sass');


const config = (entry, output, production) => {
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
                                        // cssnano({
                                        //     preset: 'default',
                                        // })
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
            minimize: production,
            minimizer: [
                `...`,
                new CssMinimizerPlugin()
            ]
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

const scss = (pattern, { normalizer, ui } = {}) => {
    let scss = glob.sync(path.resolve(pattern).replace(/\\/g, '/'), { nosort: true });

    if (ui) {
        if (typeof ui === 'string') {
            throw new Error('`ui` must be a string');
        }

        scss.push(`@esportsplus/ui/build/css/css-utilities${str ? `.${str}` : ''}.scss`);
        scss.unshift(`@esportsplus/ui/build/css/components${str ? `.${str}` : ''}.scss`);
    }

    if (normalizer) {
        scss.unshift('modern-normalize/modern-normalize.css');
    }

    return scss.flat();
};


module.exports = { config, scss };