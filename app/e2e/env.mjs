// Shared settings for the browser scripts. Override with environment variables.
import fs from 'node:fs'
export const APP = process.env.APP_URL || 'http://localhost:5173/'
export const RELAY = process.env.RELAY_URL || 'http://localhost:8787'
export const SHOTS = process.env.SHOTS || new URL('./shots/', import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
fs.mkdirSync(new URL('./reports/', import.meta.url).pathname, { recursive: true })
