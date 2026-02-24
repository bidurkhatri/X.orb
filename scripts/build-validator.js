#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { createInterface } = require('readline')

class BuildValidator {
  constructor() {
    this.rules = []
    this.results = []
    this.initializeRules()
  }

  initializeRules() {
    // Security rules
    this.rules.push({
      name: 'no-secrets',
      description: 'Ensure no secrets are included in the build',
      severity: 'error',
      category: 'security',
      check: async () => this.checkNoSecrets()
    })

    this.rules.push({
      name: 'csp-headers',
      description: 'Verify CSP headers are properly configured',
      severity: 'error',
      category: 'security',
      check: async () => this.checkCSPHeaders()
    })

    // Performance rules
    this.rules.push({
      name: 'bundle-size',
      description: 'Check bundle size limits',
      severity: 'warning',
      category: 'performance',
      check: async () => this.checkBundleSize()
    })

    this.rules.push({
      name: 'image-optimization',
      description: 'Verify images are optimized',
      severity: 'warning',
      category: 'performance',
      check: async () => this.checkImageOptimization()
    })

    // Accessibility rules
    this.rules.push({
      name: 'alt-texts',
      description: 'Verify all images have alt text',
      severity: 'warning',
      category: 'accessibility',
      check: async () => this.checkAltTexts()
    })

    // SEO rules
    this.rules.push({
      name: 'meta-tags',
      description: 'Verify meta tags are present',
      severity: 'info',
      category: 'seo',
      check: async () => this.checkMetaTags()
    })
  }

  async validate() {
    console.log('🔍 Running build validation...')
    
    this.results = []
    
    for (const rule of this.rules) {
      console.log(`  ✓ ${rule.name}: ${rule.description}`)
      try {
        const result = await rule.check()
        this.results.push({
          ...result,
          name: rule.name,
          category: rule.category,
          severity: rule.severity,
          message: `[${rule.name}] ${result.message}`
        })
      } catch (error) {
        this.results.push({
          passed: false,
          name: rule.name,
          category: rule.category,
          severity: rule.severity,
          message: `[${rule.name}] Validation error: ${error.message}`
        })
      }
    }
    
    this.generateReport()
    return this.results
  }

  async checkNoSecrets() {
    const distPath = path.resolve('dist')
    
    if (!fs.existsSync(distPath)) {
      return {
        passed: false,
        message: 'Build directory not found'
      }
    }
    
    const secretPatterns = [
      /sk-[a-zA-Z0-9]{48}/g, // OpenAI API keys
      /pk_live_[a-zA-Z0-9]{24,}/g, // Stripe live keys
      /pk_test_[a-zA-Z0-9]{24,}/g, // Stripe test keys
    ]
    
    const files = this.getFilesByType('dist', 'js')
    let secretsFound = 0
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8')
      for (const pattern of secretPatterns) {
        const matches = content.match(pattern)
        if (matches) {
          secretsFound += matches.length
        }
      }
    }
    
    return {
      passed: secretsFound === 0,
      message: secretsFound === 0 
        ? 'No secrets found in build' 
        : `Found ${secretsFound} potential secrets in build files`,
      details: { secretsFound }
    }
  }

  async checkCSPHeaders() {
    const indexPath = path.resolve('dist/index.html')
    
    if (!fs.existsSync(indexPath)) {
      return {
        passed: false,
        message: 'index.html not found'
      }
    }
    
    const content = fs.readFileSync(indexPath, 'utf8')
    const cspMeta = content.match(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i)
    
    return {
      passed: !!cspMeta,
      message: cspMeta 
        ? 'CSP meta tag found' 
        : 'Content Security Policy meta tag not found',
      details: { cspMeta: cspMeta?.[0] || null }
    }
  }

  async checkBundleSize() {
    const reportPath = path.resolve('dist/build-analysis.json')
    
    if (!fs.existsSync(reportPath)) {
      return {
        passed: false,
        message: 'Build analysis report not found'
      }
    }
    
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
    const maxBundleSize = 250 * 1024 // 250KB
    const largeFiles = report.files.filter(file => 
      file.type === 'javascript' && file.size > maxBundleSize
    )
    
    return {
      passed: largeFiles.length === 0,
      message: largeFiles.length === 0 
        ? 'All bundles within size limits' 
        : `${largeFiles.length} bundle(s) exceed size limit`,
      details: { largeFiles: largeFiles.map(f => ({ name: f.name, size: f.size })) }
    }
  }

  async checkImageOptimization() {
    const distPath = path.resolve('dist')
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif']
    const maxImageSize = 100 * 1024 // 100KB
    
    if (!fs.existsSync(distPath)) {
      return {
        passed: false,
        message: 'Build directory not found'
      }
    }
    
    const images = this.getFilesByExtension('dist', imageExtensions)
    const unoptimized = images.filter(imgPath => {
      const stats = fs.statSync(imgPath)
      return stats.size > maxImageSize
    })
    
    return {
      passed: unoptimized.length === 0,
      message: unoptimized.length === 0 
        ? 'All images are optimized' 
        : `${unoptimized.length} image(s) could be optimized`,
      details: { unoptimized: unoptimized.slice(0, 5) }
    }
  }

  async checkAltTexts() {
    const indexPath = path.resolve('dist/index.html')
    
    if (!fs.existsSync(indexPath)) {
      return {
        passed: false,
        message: 'index.html not found'
      }
    }
    
    const content = fs.readFileSync(indexPath, 'utf8')
    const imgMatches = content.match(/<img[^>]*>/g) || []
    const imagesWithoutAlt = imgMatches.filter(img => !img.match(/alt\s*=/))
    
    return {
      passed: imagesWithoutAlt.length === 0,
      message: imagesWithoutAlt.length === 0 
        ? 'All images have alt text' 
        : `${imagesWithoutAlt.length} image(s) missing alt text`,
      details: { 
        totalImages: imgMatches.length,
        missingAlt: imagesWithoutAlt.length
      }
    }
  }

  async checkMetaTags() {
    const indexPath = path.resolve('dist/index.html')
    
    if (!fs.existsSync(indexPath)) {
      return {
        passed: false,
        message: 'index.html not found'
      }
    }
    
    const content = fs.readFileSync(indexPath, 'utf8')
    const hasTitle = content.includes('<title>')
    const hasDescription = content.includes('name="description"')
    const hasViewport = content.includes('name="viewport"')
    
    const missing = []
    if (!hasTitle) missing.push('title')
    if (!hasDescription) missing.push('description')
    if (!hasViewport) missing.push('viewport')
    
    return {
      passed: missing.length === 0,
      message: missing.length === 0 
        ? 'All required meta tags present' 
        : `Missing meta tags: ${missing.join(', ')}`,
      details: { missing }
    }
  }

  getFilesByType(dir, type) {
    const files = []
    const walk = (currentPath) => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)
        
        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (entry.isFile() && entry.name.endsWith(`.${type}`)) {
          files.push(fullPath)
        }
      }
    }
    
    if (fs.existsSync(dir)) {
      walk(dir)
    }
    
    return files
  }

  getFilesByExtension(dir, extensions) {
    const files = []
    const walk = (currentPath) => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)
        
        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
          files.push(fullPath)
        }
      }
    }
    
    if (fs.existsSync(dir)) {
      walk(dir)
    }
    
    return files
  }

  generateReport() {
    const errors = this.results.filter(r => !r.passed && r.severity === 'error').length
    const warnings = this.results.filter(r => !r.passed && r.severity === 'warning').length
    const info = this.results.filter(r => !r.passed && r.severity === 'info').length
    const passed = this.results.filter(r => r.passed).length
    
    console.log('\n📋 Build Validation Report')
    console.log('=' .repeat(40))
    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Errors: ${errors}`)
    console.log(`⚠️  Warnings: ${warnings}`)
    console.log(`ℹ️  Info: ${info}`)
    console.log(`📊 Total: ${this.results.length}`)
    
    if (errors > 0) {
      console.log('\n🚨 Critical Issues:')
      this.results
        .filter(r => !r.passed && r.severity === 'error')
        .forEach(r => console.log(`  • ${r.message}`))
    }
    
    if (warnings > 0) {
      console.log('\n⚠️  Warnings:')
      this.results
        .filter(r => !r.passed && r.severity === 'warning')
        .forEach(r => console.log(`  • ${r.message}`))
    }
    
    // Save report
    const reportPath = path.resolve('dist/validation-report.json')
    const report = {
      timestamp: new Date().toISOString(),
      summary: { errors, warnings, info, passed, total: this.results.length },
      results: this.results
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\n📄 Report saved to: ${reportPath}`)
    
    if (errors > 0) {
      process.exit(1) // Exit with error code if there are critical issues
    }
  }
}

// CLI execution
if (require.main === module) {
  const validator = new BuildValidator()
  validator.validate().catch(error => {
    console.error('❌ Build validation failed:', error)
    process.exit(1)
  })
}

module.exports = BuildValidator
