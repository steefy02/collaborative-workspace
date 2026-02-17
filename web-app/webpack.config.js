const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;

// Microfrontend URLs - configurable via environment variables
// In Docker, the shell's nginx proxies /mfe/* to the respective MFE containers
// In development, they point directly to the MFE dev servers
const NOTIFICATIONS_MFE_URL = process.env.NOTIFICATIONS_MFE_URL || 'http://localhost:3010';
const AUTH_MFE_URL = process.env.AUTH_MFE_URL || 'http://localhost:3011';

module.exports = {
  entry: './src/index.js',
  output: {
    publicPath: 'auto',
    clean: true,
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    // Module Federation: host/shell configuration
    // Consumes microfrontends as remote modules loaded at runtime
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
        notifications_mfe: `notifications_mfe@${NOTIFICATIONS_MFE_URL}/remoteEntry.js`,
        auth_mfe: `auth_mfe@${AUTH_MFE_URL}/remoteEntry.js`,
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.2.0', eager: true },
        'react-dom': { singleton: true, requiredVersion: '^18.2.0', eager: true },
      },
    }),
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
  ],
  devServer: {
    port: 3000,
    historyApiFallback: true,
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:80',
        changeOrigin: true,
      },
      {
        context: ['/socket.io'],
        target: 'http://localhost:80',
        ws: true,
      },
    ],
  },
};
