import './globals.css'
import React from 'react'
import Navbar from '../components/Navbar'

export const metadata = {
  title: 'AutoEditor Pro'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: 20 }}>
          <Navbar />
          <main>{children}</main>
        </div>
      </body>
    </html>
  )
}
