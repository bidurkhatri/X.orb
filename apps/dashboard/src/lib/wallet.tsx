import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react'
import { polygon } from 'wagmi/chains'
import { type ReactNode } from 'react'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ''

const metadata = {
  name: 'X.orb',
  description: 'Agent Trust Infrastructure',
  url: 'https://xorb.xyz',
  icons: ['https://xorb.xyz/og-image.png'],
}

const chains = [polygon] as const

// When projectId exists: full WalletConnect with web3modal
// When missing: minimal wagmi config (no WC iframe, no CSP issues)
const wagmiConfig = projectId
  ? defaultWagmiConfig({ chains, projectId, metadata })
  : createConfig({ chains, transports: { [polygon.id]: http() } })

if (projectId) {
  createWeb3Modal({
    wagmiConfig: wagmiConfig as ReturnType<typeof defaultWagmiConfig>,
    projectId,
    themeMode: 'dark',
    themeVariables: { '--w3m-accent': '#0066FF' },
  })
}

const queryClient = new QueryClient()

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export { wagmiConfig }
