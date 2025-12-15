module.exports = {
  appId: 'com.dragonitelm.app',
  productName: 'DragoniteLM',
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
