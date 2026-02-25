import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const POLYGONSCAN_API_KEY = Deno.env.get('POLYGONSCAN_API_KEY') || ''
const PINATA_JWT = Deno.env.get('PINATA_JWT') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    if (action === 'tx-history') {
      const address = url.searchParams.get('address')
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return new Response(JSON.stringify({ error: 'Invalid address' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const page = url.searchParams.get('page') || '1'
      const offset = url.searchParams.get('offset') || '15'
      const apiUrl = `https://api.polygonscan.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=${offset}&sort=desc&apikey=${POLYGONSCAN_API_KEY}`
      const res = await fetch(apiUrl)
      const data = await res.json()
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'pin-to-ipfs') {
      if (!PINATA_JWT) {
        return new Response(JSON.stringify({ error: 'IPFS pinning not configured' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      // Forward the multipart form data to Pinata
      const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: { Authorization: `Bearer ${PINATA_JWT}` },
        body: req.body,
      })
      const data = await res.json()
      return new Response(JSON.stringify(data), { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
