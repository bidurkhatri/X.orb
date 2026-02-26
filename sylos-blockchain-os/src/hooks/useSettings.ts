/**
 * useSettings — Reactive settings hook for SylOS
 * 
 * Reads from localStorage key 'sylos_settings' (same key used by SettingsApp)
 * and provides reactive values. Also injects CSS custom properties onto <html>
 * so all components automatically pick up changes.
 */
import { useState, useEffect } from 'react'

const PREFS_KEY = 'sylos_settings'

interface SylOSSettings {
    theme: 'dark' | 'midnight' | 'amoled'
    accentColor: string
    fontSize: number
    animations: boolean
    sounds: boolean
    notifications: boolean
    autoLock: number
    transparency: number
    rpcUrl: string
    chainId: string
}

const DEFAULTS: SylOSSettings = {
    theme: 'dark',
    accentColor: '#6366f1',
    fontSize: 14,
    animations: true,
    sounds: false,
    notifications: true,
    autoLock: 5,
    transparency: 82,
    rpcUrl: 'https://polygon-rpc.com',
    chainId: '137',
}

function load(): SylOSSettings {
    try {
        return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }
    } catch {
        return DEFAULTS
    }
}

/** Hex color to rgba helper */
function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Apply CSS custom properties onto <html> element so they cascade everywhere.
 */
function applyCssVars(s: SylOSSettings) {
    const root = document.documentElement
    root.style.setProperty('--sylos-accent', s.accentColor)
    root.style.setProperty('--sylos-accent-10', hexToRgba(s.accentColor, 0.1))
    root.style.setProperty('--sylos-accent-15', hexToRgba(s.accentColor, 0.15))
    root.style.setProperty('--sylos-accent-20', hexToRgba(s.accentColor, 0.2))
    root.style.setProperty('--sylos-accent-30', hexToRgba(s.accentColor, 0.3))
    root.style.setProperty('--sylos-accent-40', hexToRgba(s.accentColor, 0.4))
    root.style.setProperty('--sylos-font-size', `${s.fontSize}px`)
    root.style.setProperty('--sylos-transparency', `${s.transparency / 100}`)

    // Theme background variations
    const bgMap = {
        dark: 'rgba(6, 8, 22, 0.75)',
        midnight: 'rgba(2, 2, 8, 0.85)',
        amoled: 'rgba(0, 0, 0, 0.92)',
    }
    root.style.setProperty('--sylos-taskbar-bg', bgMap[s.theme])
    root.style.setProperty('--sylos-window-bg', s.theme === 'amoled' ? 'rgba(0,0,0,0.98)' : s.theme === 'midnight' ? 'rgba(8,8,18,0.96)' : 'rgba(12,14,30,0.96)')

    // Animation preference
    if (!s.animations) {
        root.style.setProperty('--sylos-transition', 'none')
        root.style.setProperty('--sylos-animation', 'none')
    } else {
        root.style.removeProperty('--sylos-transition')
        root.style.removeProperty('--sylos-animation')
    }
}

export function useSettings(): SylOSSettings {
    const [settings, setSettings] = useState<SylOSSettings>(load)

    // Listen for localStorage writes from SettingsApp or other tabs
    useEffect(() => {
        const poll = setInterval(() => {
            const fresh = load()
            setSettings(prev => {
                // Quick shallow compare to avoid unnecessary re-renders
                if (JSON.stringify(prev) === JSON.stringify(fresh)) return prev
                return fresh
            })
        }, 500) // poll every 500ms — lightweight, catches SettingsApp writes instantly

        // Also listen for cross-tab storage events
        const onStorage = (e: StorageEvent) => {
            if (e.key === PREFS_KEY) setSettings(load())
        }
        window.addEventListener('storage', onStorage)

        return () => {
            clearInterval(poll)
            window.removeEventListener('storage', onStorage)
        }
    }, [])

    // Apply CSS variables whenever settings change
    useEffect(() => {
        applyCssVars(settings)
    }, [settings])

    return settings
}

export type { SylOSSettings }
