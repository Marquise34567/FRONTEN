// ESM image generation script using sharp.
// Run locally:
//   cd frontend
//   npm install sharp
//   npm run generate:images
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const publicDir = path.join(__dirname, '..', 'public')
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true })

// Prefer a dedicated favicon source if present, otherwise fall back to og-preview.svg
const svgPath = fs.existsSync(path.join(publicDir, 'favicon-source.svg'))
  ? path.join(publicDir, 'favicon-source.svg')
  : path.join(publicDir, 'og-preview.svg')
const pngPath = path.join(publicDir, 'og-preview.png')
const favicon32 = path.join(publicDir, 'favicon-32x32.png')
const apple = path.join(publicDir, 'apple-touch-icon.png')
const favicon16 = path.join(publicDir, 'favicon-16x16.png')
const manifestPath = path.join(publicDir, 'site.webmanifest')

async function generate() {
  if (!fs.existsSync(svgPath)) {
    console.error('Missing', svgPath)
    process.exit(1)
  }
  // Generate OG PNG 1200x630 at quality 80
  await sharp(svgPath).resize(1200, 630).png({ quality: 80, compressionLevel: 9, adaptiveFiltering: true }).toFile(pngPath)
  console.log('Wrote', pngPath)

  // Generate favicon 32x32
  await sharp(svgPath).resize(32, 32).png({ quality: 90 }).toFile(favicon32)
  console.log('Wrote', favicon32)

  // Apple touch icon 180x180
  await sharp(svgPath).resize(180, 180).png({ quality: 90 }).toFile(apple)
  console.log('Wrote', apple)

  // Small favicon 16x16
  await sharp(svgPath).resize(16, 16).png({ quality: 90 }).toFile(favicon16)
  console.log('Wrote', favicon16)

  // Simple web manifest
  const manifest = {
    name: 'AutoEditor',
    short_name: 'AutoEditor',
    icons: [
      { src: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { src: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
    start_url: '/',
    display: 'standalone',
    theme_color: '#0b1220',
    background_color: '#0b1220'
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log('Wrote', manifestPath)
}

generate().catch((err) => { console.error(err); process.exit(1) })
