import { describe, expect, it } from 'vitest'

import { LOBBY_ID_LENGTH, normalizeLobbyGameId } from './gameActionHelpers'

describe('normalizeLobbyGameId', () => {
  it('accepts a 4-char alphanumeric id', () => {
    expect(normalizeLobbyGameId(' A3F9 ')).toBe('a3f9')
  })

  it('rejects invalid ids', () => {
    expect(normalizeLobbyGameId('abc')).toBeNull()
    expect(normalizeLobbyGameId('abcde')).toBeNull()
    expect(normalizeLobbyGameId('a3f!')).toBeNull()
    expect(normalizeLobbyGameId('dcc7f8b1-9fa3-4167-a089-494138cc1757')).toBeNull()
  })

  it('documents expected lobby id length', () => {
    expect(LOBBY_ID_LENGTH).toBe(4)
  })
})
