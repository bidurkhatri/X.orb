const path = require('path');

module.exports = {
  analyzerMode: 'static',
  openAnalyzer: false,
  reportFilename: 'bundle-analysis.html',
  reportTitle: 'SylOS Bundle Analysis',
  logLevel: 'info',
  defaultSizes: 'parsed',
  createAssetsFolder: true,
  gzipSize: true,
  brotliSize: true,
  addModuleNumbersToFileNames: true,
  showContent: true,
  showErroredAssets: true,
  showPerformance: true,
  showHistory: true,
  showAst: false,
  showDependencies: true,
  showTree: true,
  showList: true,
  showSummary: true,
  showTooltips: true,
  target: 'web',
  colors: {
    'bundle-size': {
      'k>400': '#ff0000',
      'k>300': '#ff7f00',
      'k>200': '#ffbf00',
      'k>100': '#00ff00',
      'k<100': '#00bfff'
    }
  }
};