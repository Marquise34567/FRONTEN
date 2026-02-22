"use client"
import React from 'react'
import axios from 'axios'
import supabase from '../../lib/supabaseClient'

export default function BillingPage() {
  const [user, setUser] = React.useState<any>(null)

  React.useEffect(() => {
    const s = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null))
    supabase.auth.getSession().then((r) => setUser(r.data.session?.user ?? null))
    return () => s.subscription.unsubscribe()
  }, [])

  async function createCheckout() {
    const token = (await supabase.auth.getSession()).data.session?.access_token
    const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/billing/create-checkout-session`, {}, { headers: { Authorization: `Bearer ${token}` } })
    if (res.data?.url) window.location.href = res.data.url
  }

  async function portal() {
    const token = (await supabase.auth.getSession()).data.session?.access_token
    const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/billing/create-portal-session`, {}, { headers: { Authorization: `Bearer ${token}` } })
    if (res.data?.url) window.location.href = res.data.url
  }

  return (
    <div>
      <h1>Billing</h1>
      {!user ? <div>Sign in to manage billing</div> : (
        <div>
          <button onClick={createCheckout}>Upgrade to Premium</button>
          <button style={{ marginLeft: 8 }} onClick={portal}>Manage subscription</button>
        </div>
      )}
    </div>
  )
}
"use client"
import React, { useEffect, useState } from 'react'
import supabase from '../../lib/supabaseClient'
import axios from 'axios'

export default function BillingPage() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const s = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    supabase.auth.getSession().then((r) => setUser(r.data.session?.user ?? null))
    return () => s.subscription.unsubscribe()
  }, [])

  async function upgrade() {
    if (!user) return alert('Sign in')
    const token = (await supabase.auth.getSession()).data.session?.access_token
    const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/billing/create-checkout-session`, {}, { headers: { Authorization: `Bearer ${token}` } })
    if (res.data.url) window.location.href = res.data.url
  }

  async function manage() {
    if (!user) return alert('Sign in')
    const token = (await supabase.auth.getSession()).data.session?.access_token
    const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/billing/create-portal-session`, {}, { headers: { Authorization: `Bearer ${token}` } })
    if (res.data.url) window.location.href = res.data.url
  }

  return (
    <div>
      <h1>Billing</h1>
      <div>
        <button onClick={upgrade}>Upgrade to Premium</button>
        <button onClick={manage}>Manage subscription</button>
      </div>
    </div>
  )
}
