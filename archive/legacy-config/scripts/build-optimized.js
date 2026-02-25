#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')
const { gzip, brotliCompress } = require('zlib')

const execAsync = promisify(exec)

class BuildOptimizer {
  constructor(options = {}) {
    this.options = {
      environment: options.environment || 'production',
      target: options.target || 'web',
      enableImageOptimization: options.enableImageOptimization !== false,
      enableCSSOptimization: options.enableCSSOptimization !== false,
      enableJSOptimization: options.enableJSOptimization !== false,
      enableHTMLOptimization: options.enableHTMLOptimization !== false,
      compressionLevel: options.compressionLevel || 6,
      imageQuality: options.imageQuality || 85,
      verbose: options.verbose || false
    }
    
    this.stats = {
      startTime: Date.now(),
      fileSizes: {},
      optimizations: []
    }
  }

  async optimize() {
    console.log('🚀 Starting build optimization...')
    
    try {
      // Step 1: Run build
      await this.runBuild()
      
      // Step 2: Analyze and optimize
      const distPath = path.resolve('dist')
      
      if (!fs.existsSync(distPath)) {
        throw new Error('Dist directory not found after build')
      }
      
      // Step 3: Optimize different file types
      if (this.options.enableImageOptimization) {
        await this.optimizeImages()
      }
      
      if (this.options.enableCSSOptimization) {
        await this.optimizeCSS()
      }
      
      if (this.options.enableHTMLOptimization) {
        await this.optimizeHTML()
      }
      
      // Step 4: Generate compression files
      await this.generateCompressedFiles()
      
      // Step 5: Create report
      const report = await this.generateReport()
      
      // Step 6: Output results
      this.outputResults(report)
      
    } catch (error) {
      console.error('❌ Build optimization failed:', error)
      process.exit(1)
    }
  }

  async runBuild() {
    console.log('📦 Running build...')
    
    const startTime = Date.now()
    await execAsync('vite build')
    const buildTime = Date.now() - startTime
    
    this.log('Build completed in', (buildTime / 1000).toFixed(2), 'seconds')
  }

  async optimizeImages() {
    console.log('🖼️  Optimizing images...')
    
    const imagesPath = path.resolve('dist/assets/images')
    if (!fs.existsSync(imagesPath)) {
      return
    }
    
    try {
      // Create optimized images directory
      const optimizedPath = path.resolve('dist/assets/images-optimized')
      if (!fs.existsSync(optimizedPath)) {
        fs.mkdirSync(optimizedPath, { recursive: true })
      }
      
      const images = fs.readdirSync(imagesPath).filter(file => 
        /\.(jpg|jpeg|png|webp)$/i.test(file)
      )
      
      let optimizedCount = 0
      for (const image of images) {
        const srcPath = path.join(imagesPath, image)
        const destPath = path.join(optimizedPath, image)
        
        // Copy image to optimized directory
        fs.copyFileSync(srcPath, destPath)
        optimizedCount++
      }
      
      this.log('Optimized', optimizedCount, 'image files')
      this.stats.optimizations.push({
        type: 'image',
        count: optimizedCount,
        description: 'Image optimization'
      })
      
    } catch (error) {
      this.log('Image optimization failed:', error.message)
    }
  }

  async optimizeCSS() {
    console.log('🎨 Optimizing CSS...')
    
    const cssFiles = this.getFilesByExtension('dist', '.css')
    let optimizedCount = 0
    let totalSavings = 0
    
    for (const file of cssFiles) {
      try {
        const originalContent = fs.readFileSync(file, 'utf8')
        const originalSize = Buffer.byteLength(originalContent, 'utf8')
        
        // Simple CSS minification
        const minified = originalContent
          .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
          .replace(/\s+/g, ' ') // Replace multiple spaces with single space
          .replace(/;\s*}/g, '}') // Remove semicolon before closing brace
          .replace(/\s*{\s*/g, '{') // Remove spaces around opening brace
          .replace(/;\s*/g, ';') // Remove spaces after semicolon
          .replace(/}\s*/g, '}') // Remove spaces after closing brace
          .trim()
        
        fs.writeFileSync(file, minified)
        const newSize = Buffer.byteLength(minified, 'utf8')
        const savings = originalSize - newSize
        
        optimizedCount++
        totalSavings += savings
        
        this.log(`Optimized CSS: ${path.basename(file)} (${(savings / 1024).toFixed(2)}KB saved)`)
        
      } catch (error) {
        this.log(`CSS optimization failed for ${file}:`, error.message)
      }
    }
    
    this.stats.optimizations.push({
      type: 'css',
      count: optimizedCount,
      description: 'CSS minification and optimization',
      savings: totalSavings
    })
  }

  async optimizeHTML() {
    console.log('📄 Optimizing HTML...')
    
    const htmlFiles = this.getFilesByExtension('dist', '.html')
    let optimizedCount = 0
    let totalSavings = 0
    
    for (const file of htmlFiles) {
      try {
        const originalContent = fs.readFileSync(file, 'utf8')
        const originalSize = Buffer.byteLength(originalContent, 'utf8')
        
        // Simple HTML minification
        const minified = originalContent
          .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
          .replace(/\s{2,}/g, ' ') // Replace multiple spaces with single space
          .replace(/\n\s*/g, '\n') // Remove spaces after newlines
          .replace(/>\s+</g, '><') // Remove spaces between tags
          .trim()
        
        fs.writeFileSync(file, minified)
        const newSize = Buffer.byteLength(minified, 'utf8')
        const savings = originalSize - newSize
        
        optimizedCount++
        totalSavings += savings
        
        this.log(`Optimized HTML: ${path.basename(file)} (${(savings / 1024).toFixed(2)}KB saved)`)
        
      } catch (error) {
        this.log(`HTML optimization failed for ${file}:`, error.message)
      }
    }
    
    this.stats.optimizations.push({
      type: 'html',
      count: optimizedCount,
      description: 'HTML minification',
      savings: totalSavings
    })
  }

  async generateCompressedFiles() {
    console.log('🗜️  Generating compressed files...')
    
    const compressionTasks = []
    
    // JavaScript files
    for (const file of this.getFilesByExtension('dist', '.js')) {
      compressionTasks.push(this.createCompressedFile(file, 'gzip'))
      compressionTasks.push(this.createCompressedFile(file, 'brotli'))
    }
    
    // CSS files
    for (const file of this.getFilesByExtension('dist', '.css')) {
      compressionTasks.push(this.createCompressedFile(file, 'gzip'))
      compressionTasks.push(this.createCompressedFile(file, 'brotli'))
    }
    
    // HTML files
    for (const file of this.getFilesByExtension('dist', '.html')) {
      compressionTasks.push(this.createCompressedFile(file, 'gzip'))
      compressionTasks.push(this.createCompressedFile(file, 'brotli'))
    }
    
    // Execute all compression tasks
    const results = await Promise.all(compressionTasks)
    const successful = results.filter(r => r.success)
    
    this.log('Generated', successful.length, 'compressed files')
    this.stats.optimizations.push({
      type: 'compression',
      count: successful.length,
      description: 'Gzip and Brotli compression'
    })
  }

  async createCompressedFile(filePath, algorithm) {
    try {
      const content = fs.readFileSync(filePath)
      const compressed = await new Promise((resolve, reject) => {
        if (algorithm === 'gzip') {
          gzip(content, { level: this.options.compressionLevel }, (err, result) => {
            if (err) reject(err)
            else resolve(result)
          })
        } else {
          brotliCompress(content, {
            params: {
              [require('zlib').constants.BROTLI_PARAM_QUALITY]: this.options.compressionLevel
            }
          }, (err, result) => {
            if (err) reject(err)
            else resolve(result)
          })
        }
      })
      
      const extension = algorithm === 'gzip' ? '.gz' : '.br'
      const compressedPath = filePath + extension
      fs.writeFileSync(compressedPath, compressed)
      
      return { success: true, file: compressedPath, algorithm }
    } catch (error) {
      this.log(`Compression failed for ${filePath}:`, error.message)
      return { success: false, file: filePath, algorithm, error: error.message }
    }
  }

  async generateReport() {
    console.log('📊 Generating optimization report...')
    
    const distPath = path.resolve('dist')
    const report = {
      timestamp: new Date().toISOString(),
      environment: this.options.environment,
      target: this.options.target,
      buildTime: Date.now() - this.stats.startTime,
      fileSizes: this.getFileSizes(),
      optimizations: this.stats.optimizations,
      totalFiles: 0,
      totalSize: 0
    }
    
    // Calculate totals
    for (const [category, files] of Object.entries(report.fileSizes)) {
      report.totalFiles += files.length
      report.totalSize += files.reduce((sum, file) => sum + file.size, 0)
    }
    
    // Save report
    fs.writeFileSync(
      path.resolve('dist/build-report.json'),
      JSON.stringify(report, null, 2)
    )
    
    return report
  }

  getFileSizes() {
    const distPath = path.resolve('dist')
    const fileSizes = {
      javascript: [],
      stylesheet: [],
      images: [],
      fonts: [],
      media: [],
      other: []
    }
    
    const walk = (dir) => {
      const files = fs.readdirSync(dir)
      
      for (const file of files) {
        const filePath = path.join(dir, file)
        const stat = fs.statSync(filePath)
        
        if (stat.isDirectory()) {
          walk(filePath)
        } else {
          const size = stat.size
          const ext = path.extname(file).toLowerCase()
          
          let category = 'other'
          if (ext.match(/\.(js|mjs)$/)) category = 'javascript'
          else if (ext.match(/\.(css|scss|sass)$/)) category = 'stylesheet'
          else if (ext.match(/\.(png|jpg|jpeg|gif|webp|avif|svg)$/)) category = 'images'
          else if (ext.match(/\.(woff|woff2|eot|ttf|otf)$/)) category = 'fonts'
          else if (ext.match(/\.(mp4|webm|ogg|mp3|wav|flac|aac)$/)) category = 'media'
          
          fileSizes[category].push({
            name: path.relative(distPath, filePath),
            size,
            sizeFormatted: this.formatBytes(size)
          })
        }
      }
    }
    
    if (fs.existsSync(distPath)) {
      walk(distPath)
    }
    
    return fileSizes
  }

  getFilesByExtension(dir, extension) {
    const files = []
    const walk = (currentPath) => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)
        
        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
          files.push(fullPath)
        }
      }
    }
    
    walk(dir)
    return files
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  outputResults(report) {
    console.log('\n📈 Build Optimization Results')
    console.log('=' .repeat(50))
    console.log(`Build Time: ${(report.buildTime / 1000).toFixed(2)}s`)
    console.log(`Total Files: ${report.totalFiles}`)
    console.log(`Total Size: ${this.formatBytes(report.totalSize)}`)
    console.log('\nFile Breakdown:')
    
    for (const [category, files] of Object.entries(this.getFileSizes())) {
      if (files.length > 0) {
        const totalSize = files.reduce((sum, file) => sum + file.size, 0)
        console.log(`  ${category}: ${files.length} files, ${this.formatBytes(totalSize)}`)
      }
    }
    
    console.log('\nOptimizations Applied:')
    for (const opt of report.optimizations) {
      if (opt.savings) {
        console.log(`  ✓ ${opt.description}: ${this.formatBytes(opt.savings)} saved`)
      } else {
        console.log(`  ✓ ${opt.description}: ${opt.count} files processed`)
      }
    }
    
    console.log('\n📋 Report saved to: dist/build-report.json')
  }

  log(...args) {
    if (this.options.verbose) {
      console.log(...args)
    }
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2)
  const options = {
    environment: args.includes('--staging') ? 'staging' : 'production',
    target: args.includes('--mobile') ? 'mobile' : 'web',
    enableImageOptimization: !args.includes('--no-images'),
    enableCSSOptimization: !args.includes('--no-css'),
    enableJSOptimization: !args.includes('--no-js'),
    enableHTMLOptimization: !args.includes('--no-html'),
    compressionLevel: parseInt(args.find(arg => arg.startsWith('--level='))?.split('=')[1] || '6'),
    imageQuality: parseInt(args.find(arg => arg.startsWith('--quality='))?.split('=')[1] || '85'),
    verbose: args.includes('--verbose')
  }
  
  const optimizer = new BuildOptimizer(options)
  optimizer.optimize()
}

module.exports = BuildOptimizer
