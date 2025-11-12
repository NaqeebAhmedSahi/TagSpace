/**
 * Webpack config for development electron main process
 */

import path from 'path';
import webpack from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { merge } from 'webpack-merge';
import checkNodeEnv from '../scripts/check-node-env';
import baseConfig from './webpack.config.base';
import webpackPaths from './webpack.paths';

// When an ESLint server is running, we can't set the NODE_ENV so we'll check if it's
// at the dev webpack config is not accidentally run in a production environment
if (process.env.NODE_ENV === 'production') {
  checkNodeEnv('development');
}

const configuration: webpack.Configuration = {
  devtool: 'inline-source-map',

  mode: 'development',

  target: 'electron-main',

  // Fix for ENOSPC: system limit for number of file watchers reached
  watchOptions: {
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/release/**',
      '**/web/dist/**',
      '**/cordova/www/**',
      '**/tests/testdata/**',
      '**/tests/testdata-tmp/**',
      '**/coverage/**',
      '**/.erb/dll/**',
      '**/beekeeper-studio/**',
      '**/src/renderer/locales/**',
      '**/assets/**',
      '**/src/main/config/**',
    ],
    aggregateTimeout: 300,
    poll: 1000, // Use polling to avoid file watcher limits
  },

  entry: {
    main: path.join(webpackPaths.srcMainPath, 'main.ts'),
    preload: path.join(webpackPaths.srcMainPath, 'preload.ts'),
  },

  output: {
    path: webpackPaths.dllPath,
    filename: '[name].bundle.dev.js',
    library: {
      type: 'umd',
    },
  },

  plugins: [
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    new BundleAnalyzerPlugin({
      analyzerMode: process.env.ANALYZE === 'true' ? 'server' : 'disabled',
      analyzerPort: 8888,
    }),

    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     */
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'development',
      DEBUG_PROD: false,
      START_MINIMIZED: false,
    }),

    new webpack.DefinePlugin({
      'process.type': '"browser"',
    }),
  ],

  /**
   * Disables webpack processing of __dirname and __filename.
   * If you run the bundle in node.js it falls back to these values of node.js.
   * https://github.com/webpack/webpack/issues/2010
   */
  node: {
    __dirname: false,
    __filename: false,
  },
  // Treat native sqlite modules as externals so native bindings are resolved at runtime
  externals: {
    sqlite3: 'commonjs sqlite3',
    'better-sqlite3': 'commonjs better-sqlite3',
    'pg-cursor': 'commonjs pg-cursor',
    // Optional knex dependencies (not needed for MySQL, PostgreSQL, SQLite)
    'tedious': 'commonjs tedious',
    'mysql': 'commonjs mysql',
    'oracledb': 'commonjs oracledb',
    'pg-query-stream': 'commonjs pg-query-stream',
  },
};

export default merge(baseConfig, configuration);
