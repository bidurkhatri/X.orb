import { WagmiProvider, http } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
    RainbowKitProvider,
    darkTheme,
    getDefaultConfig,
} from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { ReactNode } from 'react'

const config = getDefaultConfig({
    appName: 'SylOS',
    projectId: import.meta.env['VITE_WALLETCONNECT_PROJECT_ID'] || '', // Get from cloud.reown.com
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
