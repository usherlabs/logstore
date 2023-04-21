/* eslint-disable prefer-template */

process.env.NODE_ENV = process.env.NODE_ENV || 'development' // set a default NODE_ENV

const path = require('path')

const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin')
const LodashWebpackPlugin = require('lodash-webpack-plugin')
const { merge } = require('webpack-merge')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
const { GitRevisionPlugin } = require('git-revision-webpack-plugin')
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')

const pkg = require('./package.json')

const gitRevisionPlugin = new GitRevisionPlugin()


module.exports = (_, argv) => {
    const isProduction = argv.mode === 'production' || process.env.NODE_ENV === 'production'

    const analyze = !!process.env.BUNDLE_ANALYSIS

    const commonConfig = {
        cache: {
            type: 'filesystem',
        },
        name: 'streamr-client',
        mode: isProduction ? 'production' : 'development',
        entry: {
            'streamr-client': path.join(__dirname, 'src', 'LogStoreClient.ts'),
        },
        devtool: 'source-map',
        output: {
            umdNamedDefine: true,
        },
        optimization: {
            minimize: false,
            moduleIds: 'named',
        },
        module: {
            rules: [
                {
                    test: /(\.jsx|\.js|\.ts)$/,
                    exclude: /(node_modules|bower_components)/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            configFile: path.resolve(__dirname, '.babel.browser.config.js'),
                            babelrc: false,
                            cacheDirectory: true,
                        }
                    }
                }
            ]
        },
        resolve: {
            modules: ['node_modules', ...require.resolve.paths(''), path.resolve('./vendor')],
            extensions: ['.json', '.js', '.ts'],
        },
        plugins: [
            gitRevisionPlugin,
            new webpack.EnvironmentPlugin({
                NODE_ENV: process.env.NODE_ENV,
                version: pkg.version,
                GIT_VERSION: gitRevisionPlugin.version(),
                GIT_COMMITHASH: gitRevisionPlugin.commithash(),
                GIT_BRANCH: gitRevisionPlugin.branch(),
            })
        ],
        performance: {
            hints: 'warning',
        },
    }

    const clientConfig = merge({}, commonConfig, {
        target: 'web',
        output: {
            filename: 'browser/[name].web.js',
            libraryTarget: 'umd',
            library: 'Logstore',
            globalObject: 'globalThis',
        },
        resolve: {
            alias: {
                stream: 'readable-stream',
                util: 'util',
                http: path.resolve('./src/shim/http-https.ts'),
                '@ethersproject/wordlists': require.resolve('@ethersproject/wordlists/lib/browser-wordlists.js'),
                https: path.resolve('./src/shim/http-https.ts'),
                crypto: require.resolve('crypto-browserify'),
                buffer: require.resolve('buffer/'),
                'node-fetch': path.resolve('./src/shim/node-fetch.ts'),
                // swap out ServerPersistence for BrowserPersistence becase of node fs dependencies
                [path.resolve('./src/utils/persistence/ServerPersistence.ts')]: (
                    path.resolve('./src/utils/persistence/BrowserPersistence.ts')
                ),
            },
            fallback: {
                module: false,
                fs: false,
                net: false,
                http: false,
                https: false,
                express: false,
                ws: false,
                '@web3modal/standalone': false
            }
        },
        plugins: [
            new NodePolyfillPlugin({
                excludeAliases: ['console'],
            }),
            new LodashWebpackPlugin(),
            ...(analyze ? [
                new BundleAnalyzerPlugin({
                    analyzerMode: 'static',
                    openAnalyzer: false,
                    generateStatsFile: true,
                })
            ] : [])
        ]
    })

    let clientMinifiedConfig

    if (isProduction) {
        clientMinifiedConfig = merge({}, clientConfig, {
            cache: false,
            optimization: {
                minimize: true,
                minimizer: [
                    new TerserPlugin({
                        parallel: true,
                        terserOptions: {
                            ecma: 2018,
                            output: {
                                comments: false,
                            },
                        },
                    }),
                ],
            },
            output: {
                filename: 'browser/[name].web.min.js',
            },
        })
    }
    return [clientConfig, clientMinifiedConfig].filter(Boolean)
}