// Edge Function: Wallet Operations API
// SylOS Blockchain Operating System

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'false'
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

    // Mock blockchain interactions - In production, this would interact with actual blockchain
    const MOCK_BALANCES = {
      '0x742d35Cc6434C0532925a3b8D5aAd6312a09bF2A': {
        ETH: '2.5',
        SYLOS: '1000.0',
        USDC: '5000.0'
      }
    }

    switch (action) {
      case 'balance':
        // Get wallet balance
        const balance = MOCK_BALANCES[walletData.wallet_address] || {
          ETH: '0.0',
          SYLOS: '0.0',
          USDC: '0.0'
        }

        return new Response(
          JSON.stringify({ data: { balance, wallet_address: walletData.wallet_address } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'transactions':
        // Get transaction history
        const { data: transactions, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('from_address', walletData.wallet_address)
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

      case 'send':
        // Send transaction (mock)
        const { data: newTransaction, error: sendError } = await supabase
          .from('transactions')
          .insert([{
            user_id: null, // Will be linked to user in real implementation
            transaction_hash: `0x${Math.random().toString(16).substr(2, 64)}`,
            from_address: walletData.wallet_address,
            to_address: walletData.target_address,
            contract_address: walletData.token_address,
            transaction_type: 'transfer',
            amount: walletData.amount,
            token_symbol: 'SYLOS',
            blockchain_network: 'ethereum',
            status: 'pending'
          }])
          .select()

        if (sendError) {
          return new Response(
            JSON.stringify({ error: sendError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ 
            data: newTransaction, 
            message: 'Transaction initiated successfully',
            tx_hash: newTransaction[0].transaction_hash
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'stake':
        // Stake tokens (mock)
        const { data: stakingRecord, error: stakeError } = await supabase
          .from('user_staking')
          .insert([{
            user_id: null, // Will be linked to user
            pool_id: 'default-pool',
            staked_amount: walletData.amount,
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

      case 'unstake':
        // Unstake tokens (mock)
        const { data: unstakeRecord, error: unstakeError } = await supabase
          .from('user_staking')
          .update({ is_active: false })
          .eq('user_id', null) // Will be linked to user
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

      case 'governance_vote':
        // Cast governance vote
        const { data: voteRecord, error: voteError } = await supabase
          .from('governance_votes')
          .insert([{
            user_id: null, // Will be linked to user
            proposal_id: walletData.proposal_id,
            vote_type: walletData.vote_type,
            voting_power: 100, // Mock voting power
            transaction_hash: `0x${Math.random().toString(16).substr(2, 64)}`
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
            message: 'Vote cast successfully' 
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'nft_list':
        // List NFTs for sale
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

      case 'nft_purchase':
        // Purchase NFT (mock)
        const { data: nftPurchase, error: purchaseError } = await supabase
          .from('nft_items')
          .update({ 
            is_for_sale: false,
            // buyer_address: walletData.wallet_address
          })
          .eq('id', walletData.nft_id)
          .select()

        if (purchaseError) {
          return new Response(
            JSON.stringify({ error: purchaseError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ 
            data: nftPurchase, 
            message: 'NFT purchase completed successfully' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

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
