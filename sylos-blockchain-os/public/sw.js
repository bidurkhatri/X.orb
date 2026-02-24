// Service Worker for Performance Optimization
const CACHE_NAME = 'sylos-v1.2.0'
const STATIC_CACHE = 'sylos-static-v1.2.0'
const DYNAMIC_CACHE = 'sylos-dynamic-v1.2.0'
const BLOCKCHAIN_CACHE = 'sylos-blockchain-v1.2.0'

// Cache configuration
const CACHE_CONFIG = {
  // Static assets - cache for 1 year
  static: {
    pattern: /\.(js|css|woff2?|ttf|eot)$/,
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    strategy: 'cache-first'
  },
  
  // Images - cache for 30 days
  images: {
    pattern: /\.(png|jpg|jpeg|webp|avif|gif|svg|ico)$/,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    strategy: 'cache-first'
  },
  
  // API responses - cache for 5 minutes
  api: {
    pattern: /\/api\//,
    maxAge: 5 * 60 * 1000, // 5 minutes
    strategy: 'stale-while-revalidate'
  },
  
  // Blockchain data - cache for 1 minute
  blockchain: {
    pattern: /(\/rpc|\/ethers|\/web3)/,
    maxAge: 1 * 60 * 1000, // 1 minute
    strategy: 'stale-while-revalidate'
  }
}

// Precache critical resources
const PRECACHE_URLS = [
  '/',
  '/static/js/main.js',
  '/static/css/main.css',
  '/manifest.json',
  '/favicon.ico'
]

// Install event - precache critical resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...')
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Precaching critical resources')
        return cache.addAll(PRECACHE_URLS)
      })
      .then(() => {
        // Skip waiting to activate immediately
        return self.skipWaiting()
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...')
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!Object.values({ STATIC_CACHE, DYNAMIC_CACHE, BLOCKCHAIN_CACHE }).includes(cacheName)) {
              console.log('Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      }),
      
      // Take control of all clients
      self.clients.claim()
    ])
  )
})

// Fetch event - handle different cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests
  if (request.method !== 'GET') return
  
  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) return
  
  event.respondWith(handleFetch(request))
})

// Main fetch handler with multiple cache strategies
async function handleFetch(request) {
  const url = new URL(request.url)
  
  // Determine cache strategy based on request type
  const strategy = getCacheStrategy(url.pathname)
  
  switch (strategy) {
    case 'cache-first':
      return cacheFirst(request)
    case 'stale-while-revalidate':
      return staleWhileRevalidate(request)
    case 'network-first':
      return networkFirst(request)
    default:
      return networkOnly(request)
  }
}

// Cache first strategy (static assets)
async function cacheFirst(request) {
  try {
    const cache = await caches.open(STATIC_CACHE)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    const response = await fetch(request)
    
    if (response.ok) {
      cache.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    console.warn('Cache first failed:', error)
    return fetch(request)
  }
}

// Stale while revalidate strategy (API responses)
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE)
  const cachedResponse = await cache.match(request)
  
  // Start fetching in background
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  })
  
  // Return cached response immediately, or wait for network
  return cachedResponse || fetchPromise
}

// Network first strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request)
    
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    const cache = await caches.open(DYNAMIC_CACHE)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return offline fallback
    return new Response('Offline', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    })
  }
}

// Network only strategy
async function networkOnly(request) {
  return fetch(request)
}

// Get cache strategy based on URL
function getCacheStrategy(pathname) {
  for (const [strategy, config] of Object.entries(CACHE_CONFIG)) {
    if (config.pattern.test(pathname)) {
      return config.strategy
    }
  }
  return 'network-first'
}

// Background sync for offline support
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Background sync triggered')
    event.waitUntil(doBackgroundSync())
  }
})

// Background sync implementation
async function doBackgroundSync() {
  try {
    // Sync pending blockchain transactions
    const pendingTransactions = await getPendingTransactions()
    
    for (const tx of pendingTransactions) {
      try {
        await submitTransaction(tx)
        await removePendingTransaction(tx.id)
      } catch (error) {
        console.error('Failed to sync transaction:', tx.id, error)
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error)
  }
}

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return
  
  const data = event.data.json()
  
  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: data.data,
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  const data = event.notification.data
  const action = event.action
  
  event.waitUntil(
    clients.matchAll().then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url === data.url && 'focus' in client) {
          return client.focus()
        }
      }
      
      // Otherwise, open new window
      if (clients.openWindow) {
        return clients.openWindow(data.url)
      }
    })
  )
})

// Message handler for cache management
self.addEventListener('message', (event) => {
  const { type, payload } = event.data
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break
      
    case 'CACHE_URLS':
      cacheUrls(payload.urls)
      break
      
    case 'CLEAR_CACHE':
      clearCache(payload.cacheName)
      break
      
    case 'GET_CACHE_SIZE':
      getCacheSize().then(size => {
        event.ports[0].postMessage({ size })
      })
      break
  }
})

// Cache specific URLs
async function cacheUrls(urls) {
  const cache = await caches.open(STATIC_CACHE)
  
  for (const url of urls) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        await cache.put(url, response)
      }
    } catch (error) {
      console.warn('Failed to cache URL:', url, error)
    }
  }
}

// Clear specific cache
async function clearCache(cacheName) {
  await caches.delete(cacheName)
}

// Get cache size
async function getCacheSize() {
  let totalSize = 0
  
  const cacheNames = await caches.keys()
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName)
    const requests = await cache.keys()
    
    for (const request of requests) {
      const response = await cache.match(request)
      if (response) {
        const blob = await response.blob()
        totalSize += blob.size
      }
    }
  }
  
  return totalSize
}

// Utility functions for blockchain sync
async function getPendingTransactions() {
  // Get from IndexedDB or localStorage
  return []
}

async function submitTransaction(tx) {
  // Submit to blockchain
  return true
}

async function removePendingTransaction(id) {
  // Remove from storage
  return true
}

// Performance monitoring
self.addEventListener('fetch', (event) => {
  const start = Date.now()
  
  event.respondWith(
    handleFetch(event.request).then(response => {
      const duration = Date.now() - start
      
      // Log slow requests
      if (duration > 1000) {
        console.warn(`Slow request: ${event.request.url} took ${duration}ms`)
      }
      
      return response
    })
  )
})

export {}