"use client"
import React from 'react'
import Link from 'next/link'
import supabase from '../lib/supabaseClient'

export default function Navbar() {
  const [user, setUser] = React.useState<any>(null)
  React.useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    supabase.auth.getSession().then((r) => setUser(r.data.session?.user ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <nav style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
      <Link href="/">Dashboard</Link>
      <Link href="/settings">Settings</Link>
      <Link href="/billing">Billing</Link>
      <div style={{ marginLeft: 'auto' }}>
        {user ? (
          <>
            <span style={{ marginRight: 8 }}>{user.email}</span>
            <button onClick={signOut}>Sign out</button>
          </>
        ) : (
          <Link href="#" onClick={(e) => { e.preventDefault(); supabase.auth.signInWithOtp({ email: prompt('Email') || '' }) }}>Sign in</Link>
        )}
      </div>
    </nav>
  )
}
