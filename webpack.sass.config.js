const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const glob = require('glob');
const path = require('path');


function scss(bundle, paths, scss = {}) {
    return [
        scss.prepend || [],
        glob.sync(`{${paths.current}/components,${paths.input}/components,${paths.input}/pages,${paths.current}/css-utilities}/**/${bundle}`, { nosort: true }),
        scss.append  || []
    ].flat();
}


module.exports = ({ filename, input, output, production, theme }) => {
    let paths = {
            current: path.resolve(process.cwd()).replace('\\', '/') + `/node_modules/@esportsplus/ui`,
            input: path.resolve(process.cwd()).replace('\\', '/') + `/${input || ''}`,
            output: path.resolve(process.cwd()).replace('\\', '/') + `/${output || ''}`
        };

    return {
        entry: {
            [filename || 'app']: scss('!(variables).scss', paths, { prepend: ['modern-normalize/modern-normalize.css'] }),
            [`themes/${theme || 'default'}`]: scss('variables.scss', paths, { append: [`${paths.current}/storage/fonts/Montserrat/montserrat.css`] })
        },
        mode: (production == false ? 'development' : 'production'),
        module: {
            rules: [
                {
                    test: /\.(c|sc|sa)ss$/,
                    use: [
                        MiniCssExtractPlugin.loader,
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
                                    plugins: [autoprefixer(), cssnano()]
                                }
                            }
                        },
                        { loader: 'sass-loader' },
                    ],
                },
            ],
        },
        optimization: {
            minimize: true,
            minimizer: [new CssMinimizerPlugin()]
        },
        output: {
            path: paths.output
        },
        plugins: [
            new MiniCssExtractPlugin({
                filename: '[name].css',
                chunkFilename: '[id].css',
            }),
            new CleanWebpackPlugin({
                cleanAfterEveryBuildPatterns: [`${paths.output}/**/*.js`],
                cleanOnceBeforeBuildPatterns: [],
                dangerouslyAllowCleanPatternsOutsideProject: true,
                dry: false,
                verbose: false
            })
        ]
    };
};
