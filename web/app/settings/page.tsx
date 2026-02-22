"use client"
import React, { useEffect, useState } from 'react'
import supabase from '../../lib/supabaseClient'
import axios from 'axios'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)

  useEffect(() => {
    const s = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    supabase.auth.getSession().then((r) => setUser(r.data.session?.user ?? null))
    return () => s.subscription.unsubscribe()
  }, [])

  async function save() {
    if (!user) return alert('Sign in')
    const token = (await supabase.auth.getSession()).data.session?.access_token
    await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/settings`, settings, { headers: { Authorization: `Bearer ${token}` } })
    alert('Settings saved')
  }

  async function load() {
    if (!user) return
    const token = (await supabase.auth.getSession()).data.session?.access_token
    const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/settings`, { headers: { Authorization: `Bearer ${token}` } })
    setSettings(res.data ?? { watermark: true, quality: 'medium' })
  }

  React.useEffect(() => { if (user) load() }, [user])

  return (
    <div>
      <h1>Settings</h1>
      {!user ? <div>Sign in to edit settings</div> : (
        <div>
          <div>
            <label>Watermark: </label>
            <input type="checkbox" checked={settings?.watermark ?? true} onChange={(e) => setSettings({ ...settings, watermark: e.target.checked })} />
          </div>
          <div>
            <label>Export quality: </label>
            <select value={settings?.quality || 'medium'} onChange={(e) => setSettings({ ...settings, quality: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <button onClick={save}>Save</button>
        </div>
      )}
    </div>
  )
}
