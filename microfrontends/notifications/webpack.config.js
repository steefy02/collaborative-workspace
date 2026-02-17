const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;

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
    // Module Federation: exposes NotificationsWidget as a remote module
    new ModuleFederationPlugin({
      name: 'notifications_mfe',
      filename: 'remoteEntry.js',
      exposes: {
        './NotificationsWidget': './src/NotificationsWidget',
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
    port: 3010,
    historyApiFallback: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
};
