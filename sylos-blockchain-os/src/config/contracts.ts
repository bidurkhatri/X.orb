/**
 * Centralized Xorb Contract Configuration
 * 
 * All contract addresses sourced from environment variables.
 * Never hardcode addresses in components — import from here.
 */

const _WXORB = (import.meta.env['VITE_WXORB_TOKEN'] as string) || '0xcec20aec201a6e77d5802C9B5dbF1220f3b01728'
const _RPC = (import.meta.env['VITE_POLYGON_RPC'] as string) || 'https://polygon-rpc.com'

export const CONTRACTS = {
    XORB_TOKEN: (import.meta.env['VITE_XORB_TOKEN'] as string) || '0xF20102429bC6AAFd4eBfD74187E01b4125168DE3',
    WXORB_TOKEN: _WXORB,
    WRAPPED_XORB: _WXORB,  // Alias for agent system
    POP_TRACKER: (import.meta.env['VITE_POP_TRACKER'] as string) || '0x67ebac5f352Cda62De2f126d02063002dc8B6510',
    GOVERNANCE: (import.meta.env['VITE_GOVERNANCE'] as string) || '0xcc854CFc60a7eEab557CA7CC4906C6B38BafFf76',
    PAYMASTER: (import.meta.env['VITE_PAYMASTER'] as string) || '0xAe144749668b3778bBAb721558B00C655ACD1583',
    // Agent Network Contracts (deployed addresses TBD)
    AGENT_REGISTRY: (import.meta.env['VITE_AGENT_REGISTRY'] as string) || '',
    REPUTATION_SCORE: (import.meta.env['VITE_REPUTATION_SCORE'] as string) || '',
    SLASHING_ENGINE: (import.meta.env['VITE_SLASHING_ENGINE'] as string) || '',
    // Economy Contracts
    PAYMENT_STREAMING: (import.meta.env['VITE_PAYMENT_STREAMING'] as string) || '',
    AGENT_MARKETPLACE: (import.meta.env['VITE_AGENT_MARKETPLACE'] as string) || '',
} as const

export const CHAIN = {
    ID: 137,
    NAME: 'Polygon PoS',
    RPC: _RPC,
    rpcUrl: _RPC,  // Alias for agent system
    EXPLORER: 'https://polygonscan.com',
    POLYGONSCAN_API_KEY: (import.meta.env['VITE_POLYGONSCAN_API_KEY'] as string) || '',
} as const

/** Typed address helper */
export type Address = `0x${string}`
export const addr = (s: string): Address => s as Address
