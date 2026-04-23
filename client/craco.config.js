console.log('--- CRACO CONFIG IS BEING LOADED! If you see this, craco is working. ---');

const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "util": require.resolve("util/"),
        "zlib": require.resolve("browserify-zlib"),
        "stream": require.resolve("stream-browserify"),
        "url": require.resolve("url/"),
        "crypto": require.resolve("crypto-browserify"),
        "assert": require.resolve("assert/"),
        "process": require.resolve("process/browser"),
        // http2 is not needed for browser environments and is difficult to polyfill
        "http2": false, 
      };
      
      return webpackConfig;
    },
  },
};
