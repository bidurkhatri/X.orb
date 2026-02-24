/**
 * Centralized SylOS Contract Configuration
 * 
 * All contract addresses sourced from environment variables.
 * Never hardcode addresses in components — import from here.
 */

const _WSYLOS = (import.meta.env['VITE_WSYLOS_TOKEN'] as string) || '0xcec20aec201a6e77d5802C9B5dbF1220f3b01728'
const _RPC = (import.meta.env['VITE_POLYGON_RPC'] as string) || 'https://polygon-rpc.com'

export const CONTRACTS = {
    SYLOS_TOKEN: (import.meta.env['VITE_SYLOS_TOKEN'] as string) || '0xF20102429bC6AAFd4eBfD74187E01b4125168DE3',
    WSYLOS_TOKEN: _WSYLOS,
    WRAPPED_SYLOS: _WSYLOS,  // Alias for agent system
    POP_TRACKER: (import.meta.env['VITE_POP_TRACKER'] as string) || '0x67ebac5f352Cda62De2f126d02063002dc8B6510',
    GOVERNANCE: (import.meta.env['VITE_GOVERNANCE'] as string) || '0xcc85bc66C7c2c05505A4d62513e4eBA4a3B7Ff76',
    PAYMASTER: (import.meta.env['VITE_PAYMASTER'] as string) || '0xAe1418F0a941a13DA8bC689Df7B3b4f7b4E21583',
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
