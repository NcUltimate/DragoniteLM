module.exports = {
  appId: 'com.lmnade.app',
  productName: 'LMnade',
  directories: {
    output: 'dist'
  },
  files: [
    'src/**/*',
    'config/**/*',
    'package.json'
  ],
  mac: {
    category: 'public.app-category.productivity'
  },
  win: {
    target: 'nsis'
  },
  linux: {
    target: 'AppImage'
  }
};
