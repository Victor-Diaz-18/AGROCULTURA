import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/renderApp.jsx'
import { splitForSpeech } from './SpeechContext.jsx'

describe('voice guide (F9)', () => {
  it('reads the page aloud and shows what is being read', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Escuchar' }))

    expect(window.speechSynthesis.speak).toHaveBeenCalled()
    const spoken = window.speechSynthesis.speak.mock.calls.map(([utterance]) => utterance.text).join(' ')
    expect(spoken).toContain('Mapa de historias')
    expect(screen.getByText('Mapa de historias', { selector: 'b' })).toBeInTheDocument()
    expect(screen.getByText(/Leyendo en voz alta/)).toBeInTheDocument()
  })

  it('stops reading with "Detener"', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Escuchar' }))

    await user.click(screen.getByRole('button', { name: 'Detener' }))

    expect(window.speechSynthesis.cancel).toHaveBeenCalled()
    expect(screen.queryByText(/Leyendo en voz alta/)).not.toBeInTheDocument()
  })

  it('stops reading when the person goes to another page', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Escuchar' }))

    await user.click(screen.getByRole('link', { name: /Mis historias/ }))

    expect(screen.queryByText(/Leyendo en voz alta/)).not.toBeInTheDocument()
  })

  it('reads in Spanish and prefers the Colombian voice', async () => {
    const user = userEvent.setup()
    window.speechSynthesis.getVoices.mockReturnValue([
      { lang: 'en-US', name: 'English' },
      { lang: 'es-ES', name: 'España' },
      { lang: 'es-CO', name: 'Colombia' },
    ])
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Escuchar' }))

    const utterance = window.speechSynthesis.speak.mock.calls[0][0]
    expect(utterance.voice.name).toBe('Colombia')
    expect(utterance.lang).toBe('es-CO')
  })

  it('tells the person when the device cannot read aloud', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true, writable: true })
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Escuchar' }))

    expect(await screen.findByText('Este dispositivo no puede leer en voz alta.')).toBeInTheDocument()
  })

  it('splits long text into short pieces on sentence ends', () => {
    const sentence = 'Esta es una frase de prueba que ocupa bastante espacio.'
    const chunks = splitForSpeech(Array(12).fill(sentence).join(' '))

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= 220)).toBe(true)
    expect(chunks.join(' ')).toBe(Array(12).fill(sentence).join(' '))
  })
})
