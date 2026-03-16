// Edge Function: Wallet Operations API
// Xorb Blockchain Operating System — Real blockchain RPC integration

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'false'
}

const RPC_URL = Deno.env.get('POLYGON_RPC_URL') || 'https://polygon-rpc.com'

// ERC-20 token addresses on Polygon PoS
const TOKEN_CONTRACTS: Record<string, { address: string; decimals: number }> = {
  XORB: { address: '0x29d7FC41bD4B491456af1348F1CCb4F8d2a8e03e', decimals: 18 },
  USDC: { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
  USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
}

interface WalletRequest {
  action: 'balance' | 'transactions' | 'send' | 'stake' | 'unstake' | 'governance_vote' | 'nft_list' | 'nft_purchase'
  wallet_address: string
  token_address?: string
  amount?: number
  target_address?: string
  proposal_id?: number
  vote_type?: 'for' | 'against' | 'abstain'
  nft_id?: string
  price?: number
  signed_tx?: string
}

// ── JSON-RPC helper ──

async function rpcCall(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message || 'RPC error')
  return json.result
}

async function getERC20Balance(tokenAddress: string, walletAddress: string): Promise<bigint> {
  const balanceOfSelector = '0x70a08231'
  const paddedAddress = walletAddress.slice(2).toLowerCase().padStart(64, '0')
  const result = await rpcCall('eth_call', [
    { to: tokenAddress, data: balanceOfSelector + paddedAddress },
    'latest',
  ])
  return BigInt(result)
}

function formatBalance(raw: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals)
  const whole = raw / divisor
  const frac = raw % divisor
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '') || '0'
  return `${whole}.${fracStr}`
}

// ── Address validation ──

function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, ...walletData }: WalletRequest = await req.json()

    if (walletData.wallet_address && !isValidAddress(walletData.wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    switch (action) {
      case 'balance': {
        // Get real balances from Polygon RPC
        const balances: Record<string, string> = {}

        // Native MATIC balance
        const maticHex = await rpcCall('eth_getBalance', [walletData.wallet_address, 'latest'])
        balances['MATIC'] = formatBalance(BigInt(maticHex), 18)

        // ERC-20 token balances
        for (const [symbol, token] of Object.entries(TOKEN_CONTRACTS)) {
          try {
            const raw = await getERC20Balance(token.address, walletData.wallet_address)
            balances[symbol] = formatBalance(raw, token.decimals)
          } catch (err) {
            console.warn(`Failed to fetch ${symbol} balance:`, err)
            balances[symbol] = '0.0'
          }
        }

        return new Response(
          JSON.stringify({ data: { balance: balances, wallet_address: walletData.wallet_address } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'transactions': {
        // Get transaction history from Supabase (indexed from on-chain events)
        const { data: transactions, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .or(`from_address.eq.${walletData.wallet_address},to_address.eq.${walletData.wallet_address}`)
          .order('created_at', { ascending: false })
          .limit(50)

        if (txError) {
          return new Response(
            JSON.stringify({ error: txError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ data: transactions }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'send': {
        if (!walletData.target_address || !isValidAddress(walletData.target_address)) {
          return new Response(
            JSON.stringify({ error: 'Invalid target address' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (!walletData.signed_tx) {
          // Return unsigned transaction details for client-side signing
          const nonce = await rpcCall('eth_getTransactionCount', [walletData.wallet_address, 'latest'])
          const gasPrice = await rpcCall('eth_gasPrice', [])
          const gasEstimate = await rpcCall('eth_estimateGas', [{
            from: walletData.wallet_address,
            to: walletData.target_address,
            value: '0x' + BigInt(Math.floor((walletData.amount || 0) * 1e18)).toString(16),
          }])

          return new Response(
            JSON.stringify({
              data: { nonce, gasPrice, gasEstimate },
              message: 'Sign this transaction client-side and resubmit with signed_tx',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Submit signed transaction to the network
        const txHash = await rpcCall('eth_sendRawTransaction', [walletData.signed_tx])

        // Record in Supabase
        const { data: newTransaction, error: sendError } = await supabase
          .from('transactions')
          .insert([{
            transaction_hash: txHash,
            from_address: walletData.wallet_address,
            to_address: walletData.target_address,
            contract_address: walletData.token_address || null,
            transaction_type: 'transfer',
            amount: walletData.amount,
            token_symbol: walletData.token_address ? 'TOKEN' : 'MATIC',
            blockchain_network: 'polygon',
            status: 'pending'
          }])
          .select()

        if (sendError) {
          return new Response(
            JSON.stringify({ error: sendError.message, tx_hash: txHash }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({
            data: newTransaction,
            message: 'Transaction submitted to network',
            tx_hash: txHash
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'stake': {
        const { data: stakingRecord, error: stakeError } = await supabase
          .from('user_staking')
          .insert([{
            pool_id: 'default-pool',
            staked_amount: walletData.amount,
            wallet_address: walletData.wallet_address,
            staking_start_date: new Date().toISOString()
          }])
          .select()

        if (stakeError) {
          return new Response(
            JSON.stringify({ error: stakeError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({
            data: stakingRecord,
            message: 'Tokens staked successfully'
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'unstake': {
        const { data: unstakeRecord, error: unstakeError } = await supabase
          .from('user_staking')
          .update({ is_active: false })
          .eq('wallet_address', walletData.wallet_address)
          .eq('is_active', true)
          .select()

        if (unstakeError) {
          return new Response(
            JSON.stringify({ error: unstakeError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({
            data: unstakeRecord,
            message: 'Unstake initiated successfully'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'governance_vote': {
        // Look up real voting power from staking balance
        let votingPower = 0
        try {
          const xorbContract = TOKEN_CONTRACTS['XORB']
          if (xorbContract) {
            const raw = await getERC20Balance(xorbContract.address, walletData.wallet_address)
            votingPower = Number(raw / BigInt(10 ** xorbContract.decimals))
          }
        } catch {
          console.warn('Failed to fetch voting power, defaulting to 0')
        }

        if (votingPower === 0) {
          return new Response(
            JSON.stringify({ error: 'No XORB tokens held — cannot vote' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: voteRecord, error: voteError } = await supabase
          .from('governance_votes')
          .insert([{
            proposal_id: walletData.proposal_id,
            vote_type: walletData.vote_type,
            voting_power: votingPower,
            wallet_address: walletData.wallet_address,
          }])
          .select()

        if (voteError) {
          return new Response(
            JSON.stringify({ error: voteError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({
            data: voteRecord,
            message: `Vote cast with ${votingPower} XORB voting power`
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'nft_list': {
        const { data: nftList, error: nftError } = await supabase
          .from('nft_items')
          .select('*')
          .eq('is_for_sale', true)
          .order('created_at', { ascending: false })
          .limit(50)

        if (nftError) {
          return new Response(
            JSON.stringify({ error: nftError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ data: nftList }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'nft_purchase': {
        const { data: nftPurchase, error: purchaseError } = await supabase
          .from('nft_items')
          .update({
            is_for_sale: false,
            owner_address: walletData.wallet_address,
          })
          .eq('id', walletData.nft_id)
          .eq('is_for_sale', true)
          .select()

        if (purchaseError) {
          return new Response(
            JSON.stringify({ error: purchaseError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (!nftPurchase || nftPurchase.length === 0) {
          return new Response(
            JSON.stringify({ error: 'NFT not available for purchase' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({
            data: nftPurchase,
            message: 'NFT purchase completed successfully'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
