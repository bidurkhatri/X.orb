// Optimized Image Component with Performance Features
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useLazyImage, useNetworkAware } from '../hooks/usePerformance'

export interface OptimizedImageProps {
  src: string
  alt: string
  className?: string
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'avif' | 'jpeg' | 'png'
  lazy?: boolean
  priority?: boolean
  placeholder?: 'blur' | 'empty' | 'color'
  blurDataURL?: string
  onLoad?: () => void
  onError?: (error: Error) => void
  sizes?: string
  loading?: 'lazy' | 'eager'
  decoding?: 'sync' | 'async' | 'auto'
}

const OPTIMIZED_IMAGE_FORMATS = {
  webp: { quality: 80, mimeType: 'image/webp' },
  avif: { quality: 75, mimeType: 'image/avif' },
  jpeg: { quality: 85, mimeType: 'image/jpeg' },
  png: { quality: 90, mimeType: 'image/png' }
}

export function OptimizedImage({
  src,
  alt,
  className = '',
  width,
  height,
  quality = 80,
  format = 'webp',
  lazy = true,
  priority = false,
  placeholder = 'blur',
  blurDataURL,
  onLoad,
  onError,
  sizes,
  loading,
  decoding
}: OptimizedImageProps) {
  const { networkQuality } = useNetworkAware()
  const [imageSrc, setImageSrc] = useState<string>('')
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(!lazy || priority)
  const [error, setError] = useState<Error | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Generate optimized image URL
  const getOptimizedSrc = useCallback((originalSrc: string) => {
    // If already optimized or external URL, return as is
    if (originalSrc.includes('?') || originalSrc.startsWith('data:') || originalSrc.startsWith('blob:')) {
      return originalSrc
    }

    // Add optimization parameters
    const params = new URLSearchParams()
    const formatConfig = OPTIMIZED_IMAGE_FORMATS[format]
    
    params.set('format', format)
    params.set('q', quality.toString())
    params.set('w', width?.toString() || 'auto')
    params.set('h', height?.toString() || 'auto')
    
    // Add network-aware optimizations
    if (networkQuality === 'slow') {
      params.set('dpr', '1') // Force 1x DPR on slow connections
    } else if (networkQuality === 'fast') {
      params.set('dpr', '2') // Allow 2x DPR on fast connections
    }

    return `${originalSrc}?${params.toString()}`
  }, [format, quality, width, height, networkQuality])

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || priority || isInView) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.unobserve(entry.target)
          }
        })
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.1
      }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [lazy, priority, isInView])

  // Load image when in view
  useEffect(() => {
    if (isInView && !imageSrc) {
      const optimizedSrc = getOptimizedSrc(src)
      setImageSrc(optimizedSrc)
    }
  }, [isInView, src, imageSrc, getOptimizedSrc])

  // Image load handler
  const handleLoad = useCallback(() => {
    setIsLoaded(true)
    onLoad?.()
  }, [onLoad])

  // Image error handler
  const handleError = useCallback((event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const error = new Error(`Failed to load image: ${src}`)
    setError(error)
    onError?.(error)
  }, [src, onError])

  // Generate placeholder styles
  const getPlaceholderStyle = () => {
    if (placeholder === 'color' && blurDataURL) {
      return {
        backgroundImage: `url(${blurDataURL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    }
    
    if (placeholder === 'blur' && blurDataURL) {
      return {
        filter: 'blur(20px)',
        transform: 'scale(1.05)'
      }
    }

    return {}
  }

  // Generate responsive sizes
  const getResponsiveSizes = () => {
    if (sizes) return sizes
    if (networkQuality === 'slow') {
      return '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
    }
    return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw'
  }

  // Generate srcSet for different formats and DPR
  const generateSrcSet = () => {
    const formats = [format]
    if (format !== 'webp' && networkQuality === 'fast') {
      formats.unshift('webp') // Prefer webp on fast connections
    }

    return formats.map(fmt => {
      const formatConfig = OPTIMIZED_IMAGE_FORMATS[fmt as keyof typeof OPTIMIZED_IMAGE_FORMATS]
      const dprs = networkQuality === 'slow' ? [1] : [1, 2]
      
      return dprs.map(dpr => {
        const params = new URLSearchParams()
        params.set('format', fmt)
        params.set('q', quality.toString())
        params.set('w', (width ? width * dpr : 800 * dpr).toString())
        if (height) params.set('h', (height * dpr).toString())
        
        return `${src}?${params.toString()} ${dpr}x`
      }).join(', ')
    }).join(', ')
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ 
        width: width ? `${width}px` : 'auto',
        height: height ? `${height}px` : 'auto'
      }}
    >
      {/* Placeholder */}
      {!isLoaded && !error && (
        <div
          className="absolute inset-0 bg-gray-200 animate-pulse"
          style={getPlaceholderStyle()}
        />
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500 text-sm">
          Failed to load image
        </div>
      )}

      {/* Main image */}
      {isInView && (
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          width={width}
          height={height}
          loading={loading || (priority ? 'eager' : 'lazy')}
          decoding={decoding || 'async'}
          sizes={getResponsiveSizes()}
          srcSet={generateSrcSet()}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            objectFit: 'cover',
            width: '100%',
            height: '100%'
          }}
        />
      )}

      {/* Network quality indicator (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
          {networkQuality}
        </div>
      )}
    </div>
  )
}

// Image optimization utility
export class ImageOptimizer {
  private static instance: ImageOptimizer
  private cache = new Map<string, { blob: Blob; timestamp: number }>()
  private maxCacheSize = 50 // Max 50 images in cache

  static getInstance(): ImageOptimizer {
    if (!ImageOptimizer.instance) {
      ImageOptimizer.instance = new ImageOptimizer()
    }
    return ImageOptimizer.instance
  }

  // Optimize image on the fly
  async optimizeImage(
    src: string,
    options: {
      width?: number
      height?: number
      quality?: number
      format?: keyof typeof OPTIMIZED_IMAGE_FORMATS
    } = {}
  ): Promise<string> {
    const cacheKey = `${src}-${JSON.stringify(options)}`
    
    // Check cache first
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 min cache
      return URL.createObjectURL(cached.blob)
    }

    try {
      // For demo purposes, return the original src
      // In a real implementation, this would call an image optimization service
      return src
    } catch (error) {
      console.warn('Image optimization failed:', error)
      return src
    }
  }

  // Preload critical images
  async preloadImages(urls: string[]): Promise<void> {
    const promises = urls.map(url => {
      return new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => resolve()
        img.onerror = () => resolve()
        img.src = url
      })
    })

    await Promise.allSettled(promises)
  }

  // Get image dimensions without loading
  getImageDimensions(src: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.width, height: img.height })
      img.onerror = reject
      img.src = src
    })
  }

  // Clean up cache
  cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > 300000) { // 5 minutes
        this.cache.delete(key)
      }
    }
  }
}

// Image preloader component for critical images
export function ImagePreloader({ urls, children }: { urls: string[]; children: React.ReactNode }) {
  useEffect(() => {
    const optimizer = ImageOptimizer.getInstance()
    optimizer.preloadImages(urls)
  }, [urls])

  return <>{children}</>
}

// Progressive image with blur-up effect
export function ProgressiveImage({
  src,
  placeholder,
  alt,
  className = '',
  ...props
}: {
  src: string
  placeholder: string
  alt: string
  className?: string
} & Omit<OptimizedImageProps, 'src' | 'placeholder' | 'alt' | 'className'>) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className={`relative ${className}`}>
      {/* Placeholder */}
      <img
        src={placeholder}
        alt=""
        className="absolute inset-0 w-full h-full object-cover filter blur-sm scale-105 transition-opacity duration-300"
        style={{ opacity: loaded ? 0 : 1 }}
      />
      
      {/* Main image */}
      <img
        src={src}
        alt={alt}
        className="relative w-full h-full object-cover transition-opacity duration-300"
        style={{ opacity: loaded ? 1 : 0 }}
        onLoad={() => setLoaded(true)}
        {...props}
      />
    </div>
  )
}

export default OptimizedImage