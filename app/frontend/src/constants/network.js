/** Origine HTTP de l'API backend (proxy local ou remote selon env). */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

const protocolPrefix = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const host = typeof window !== 'undefined' ? window.location.host : ''
const defaultWsUrl = `${protocolPrefix}//${host}/ws/game`

/** URL du WebSocket de jeu. */
export const WS_URL = import.meta.env.VITE_WS_URL ?? defaultWsUrl
