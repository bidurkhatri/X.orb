import { WagmiProvider, createConfig, http } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
    RainbowKitProvider,
    darkTheme,
    getDefaultConfig,
} from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { ReactNode } from 'react'

const projectId = import.meta.env['VITE_WALLETCONNECT_PROJECT_ID'] || ''
const hasProjectId = !!projectId

if (!hasProjectId) {
    console.warn('[SylOS] VITE_WALLETCONNECT_PROJECT_ID is not set — wallet connect features disabled. Get one at https://cloud.reown.com')
}

// Always create a wagmi config so hooks like useAccount work throughout the app.
// If no projectId, create a minimal config without WalletConnect connectors.
const config = hasProjectId
    ? getDefaultConfig({
        appName: 'SylOS',
        projectId,
        chains: [polygon],
        transports: {
            [polygon.id]: http(import.meta.env['VITE_POLYGON_RPC'] || 'https://polygon-rpc.com'),
        },
    })
    : createConfig({
        chains: [polygon],
        transports: {
            [polygon.id]: http(import.meta.env['VITE_POLYGON_RPC'] || 'https://polygon-rpc.com'),
        },
    })

const queryClient = new QueryClient()

export function Web3Provider({ children }: { children: ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: '#6366f1',
                        accentColorForeground: 'white',
                        borderRadius: 'large',
                        fontStack: 'system',
                    })}
                    modalSize="compact"
                >
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}
