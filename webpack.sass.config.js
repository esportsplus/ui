const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const autoprefixer = require('autoprefixer');
const glob = require('glob');
const cssnano = require('cssnano');
const path = require('path');
const sass = require('sass');


module.exports = ({ directory, entry, filename, normalizer, output, production }) => {
    filename = filename || 'app';
    output = path.resolve(output).replace(/\\/g, '/');
    production = production !== 'false' ? true : false;

    if (directory) {
        entry = glob.sync(`${path.resolve(directory).replace(/\\/g, '/')}/**/scss/${entry}.scss`, { nosort: true });

        if (normalizer == 'true') {
            entry.unshift('modern-normalize/modern-normalize.css');
        }
    }

    return {
        cache: false,
        entry: {
            [filename]: entry
        },
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
                dangerouslyAllowCleanPatternsOutsideProject: true,
                dry: false,
                verbose: false
            })
        ],
        resolve: {
            alias: {
                '/lib': path.resolve('./src/lib').replace(/\\/g, '/'),
                '/tokens': path.resolve('./src/tokens').replace(/\\/g, '/')
            }
        },
        watch: !production
    };
};