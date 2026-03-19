import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react'
import { polygon } from 'wagmi/chains'
import { type ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ''

const metadata = {
  name: 'X.orb',
  description: 'Agent Trust Infrastructure',
  url: 'https://xorb.xyz',
  icons: ['https://xorb.xyz/og-image.png'],
}

const chains = [polygon] as const

const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId: projectId || 'placeholder',
  metadata,
})

if (projectId) {
  createWeb3Modal({
    wagmiConfig,
    projectId,
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#0066FF',
    },
  })
}

const queryClient = new QueryClient()

export function WalletProvider({ children }: { children: ReactNode }) {
  // Always render WagmiProvider so hooks work everywhere.
  // Web3Modal only initializes when projectId is set.
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export { wagmiConfig, projectId }
