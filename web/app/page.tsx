"use client"
import React, { useEffect, useState } from 'react'
import supabase from '../lib/supabaseClient'
import axios from 'axios'

export default function Page() {
  const [user, setUser] = useState<any>(null)
  const [file, setFile] = useState<File | null>(null)
  const [jobs, setJobs] = useState<any[]>([])

  useEffect(() => {
    const s = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    supabase.auth.getSession().then((r) => setUser(r.data.session?.user ?? null))
    return () => s.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let t: any
    if (user) {
      fetchJobs()
      t = setInterval(fetchJobs, 2000)
    }
    return () => clearInterval(t)
  }, [user])

  async function signIn() {
    const email = prompt('Email for sign in')
    if (!email) return
    await supabase.auth.signInWithOtp({ email })
    alert('Check your email (magic link)')
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  async function createJob() {
    if (!user) return alert('Sign in')
    const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/jobs`, { inputPath: 'pending' }, { headers: { Authorization: `Bearer ${await getAccessToken()}` } })
    const job = res.data
    setJobs((j) => [job, ...j])
    return job
  }

  async function upload(job: any) {
    if (!file) return alert('Choose file')
    const uploadsBucket = process.env.NEXT_PUBLIC_SUPABASE_UPLOADS || 'uploads'
    const path = `${job.id}/${file.name}`
    // upload via server-side proxy (replaces Supabase storage upload)
    const token = await getAccessToken()
    const proxyResp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/uploads/proxy?jobId=${job.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    })
    if (!proxyResp.ok) {
      const text = await proxyResp.text()
      return alert('Upload failed: ' + text)
    }
    const body = await proxyResp.json().catch(() => ({}))
    // proxy updates job and enqueues processing; show success
    alert('Upload complete — processing started')
  }

  async function fetchJobs() {
    if (!user) return
    const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/jobs`, { headers: { Authorization: `Bearer ${await getAccessToken()}` } })
    setJobs(res.data)
  }

  async function download(job: any) {
    const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/jobs/${job.id}/output-url`, { headers: { Authorization: `Bearer ${await getAccessToken()}` } })
    window.open(res.data.url, '_blank')
  }

  async function getAccessToken() {
    const s = await supabase.auth.getSession()
    return s.data.session?.access_token
  }

  return (
    <div>
      <h1>AutoEditor Pro - Dashboard</h1>
      {!user ? (
        <button onClick={signIn}>Sign in / Sign up</button>
      ) : (
        <div>
          <div>Signed in: {user.email} <button onClick={signOut}>Sign out</button></div>
          <div style={{ marginTop: 12 }}>
            <button onClick={async () => { const job = await createJob(); if (job) alert('Created job: ' + job.id) }}>Create Job</button>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button onClick={async () => { if (jobs[0]) await upload(jobs[0]) }}>Upload & Process (use latest job)</button>
          </div>
        </div>
      )}

      <h2>Recent Jobs</h2>
      <div>
        {jobs.map((job) => (
          <div key={job.id} className="job">
            <div><strong>{job.id}</strong> - {job.status} - {job.progress}%</div>
            {job.status === 'complete' && <button onClick={() => download(job)}>Download</button>}
          </div>
        ))}
      </div>
    </div>
  )
}
