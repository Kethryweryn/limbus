// US-255 : après l'envoi des modifications faites hors ligne, la page se relit sans recharger l'application, jamais
// pendant une saisie ni dans une fenêtre ouverte (R7)
import { describe, expect, it, vi } from 'vitest'
import { DeferredRefresh, isTyping } from '~/utils/pageRefresh'

describe('champ en cours de saisie', () => {
  it('un champ de texte, une zone de texte, une liste ou un contenu modifiable', () => {
    expect(isTyping({ tagName: 'INPUT', type: 'text' })).toBe(true)
    expect(isTyping({ tagName: 'INPUT' })).toBe(true)
    expect(isTyping({ tagName: 'INPUT', type: 'email' })).toBe(true)
    expect(isTyping({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isTyping({ tagName: 'SELECT' })).toBe(true)
    expect(isTyping({ tagName: 'DIV', isContentEditable: true })).toBe(true)
  })

  it('ni un bouton, ni une case, ni un lien, ni rien', () => {
    expect(isTyping({ tagName: 'BUTTON' })).toBe(false)
    expect(isTyping({ tagName: 'INPUT', type: 'checkbox' })).toBe(false)
    expect(isTyping({ tagName: 'INPUT', type: 'submit' })).toBe(false)
    expect(isTyping({ tagName: 'A' })).toBe(false)
    expect(isTyping({ tagName: 'BODY' })).toBe(false)
    expect(isTyping(null)).toBe(false)
  })
})

describe('relecture différée', () => {
  it('rien en cours : la page se relit aussitôt', () => {
    const run = vi.fn()
    const refresh = new DeferredRefresh(() => false, run)
    expect(refresh.request()).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)
    expect(refresh.isPending).toBe(false)
  })

  it('une saisie en cours : la relecture attend qu’elle s’arrête, puis n’a lieu qu’une fois', () => {
    let busy = true
    const run = vi.fn()
    const refresh = new DeferredRefresh(() => busy, run)
    expect(refresh.request()).toBe(false)
    expect(refresh.tick()).toBe(false)
    expect(run).not.toHaveBeenCalled()
    busy = false
    expect(refresh.tick()).toBe(true)
    expect(refresh.tick()).toBe(false)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('un changement de page annule la relecture en attente', () => {
    const run = vi.fn()
    let busy = true
    const refresh = new DeferredRefresh(() => busy, run)
    refresh.request()
    refresh.cancel()
    busy = false
    expect(refresh.tick()).toBe(false)
    expect(run).not.toHaveBeenCalled()
  })
})
