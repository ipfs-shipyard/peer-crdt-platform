const path = require("path");

module.exports = {
  entry: {
    app: ["./demo.js"]
  },
  output: {
    path: path.resolve(__dirname, "build"),
    //publicPath: "/assets/",
    filename: "out.js"
  },
  node: {
    fs: 'empty'
  },
  mode: 'development',
  stats: {
    warnings: false
  },
  plugins: [
    /*
    new BabiliPlugin(),
    new OfflinePlugin({
      caches: {
        main: [
          'out.js',
          ':externals:',
        ]
      },
      externals: [
        '/',
        '/assets/icons.png',
        '/assets/alley.jpg',
        '/assets/long-blue-arrow-right.png',
        '/assets/swish.wav'

      ],
      ServiceWorker: {
        navigateFallbackUrl: '/'
      }

    })
    */
  ]
};
