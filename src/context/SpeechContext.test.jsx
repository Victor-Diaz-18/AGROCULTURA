import { describe, expect, it } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/renderApp.jsx'
import { prepareForSpeech, spanishVoices, splitForSpeech } from './SpeechContext.jsx'

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

    await user.click(screen.getByRole('link', { name: /Recorridos 360°/ }))

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

  it('never picks a machine voice just because it comes first in the list of the device', async () => {
    const user = userEvent.setup()
    window.speechSynthesis.getVoices.mockReturnValue([
      { lang: 'es-MX', name: 'Eddy (Español (México))' },
      { lang: 'es-MX', name: 'Grandma (Español (México))' },
      { lang: 'es-ES', name: 'Mónica' },
      { lang: 'es-MX', name: 'Paulina' },
    ])
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Escuchar' }))

    expect(window.speechSynthesis.speak.mock.calls[0][0].voice.name).toBe('Paulina')
    expect(within(screen.getByLabelText('Voz')).queryByRole('option', { name: /Grandma/ })).not.toBeInTheDocument()
  })

  it('puts the neural voices first, whatever the country', () => {
    const names = spanishVoices([
      { lang: 'es-CO', name: 'Local Colombia' },
      { lang: 'es-MX', name: 'Paulina' },
      { lang: 'es-US', name: 'Google español de Estados Unidos' },
      { lang: 'es-CO', name: 'Microsoft Salome Online (Natural) - Spanish (Colombia)' },
      { lang: 'en-US', name: 'Samantha' },
    ]).map((voice) => voice.name)

    expect(names).toEqual(['Microsoft Salome Online (Natural) - Spanish (Colombia)', 'Google español de Estados Unidos', 'Paulina', 'Local Colombia'])
  })

  it('lets the person choose another voice: it starts over with it, and remembers it', async () => {
    const user = userEvent.setup()
    window.speechSynthesis.getVoices.mockReturnValue([
      { lang: 'es-MX', name: 'Paulina' },
      { lang: 'es-ES', name: 'Mónica' },
    ])
    const { unmount } = renderApp()
    await user.click(screen.getByRole('button', { name: 'Escuchar' }))
    window.speechSynthesis.speak.mockClear()

    await user.selectOptions(screen.getByLabelText('Voz'), 'Mónica')

    expect(window.speechSynthesis.speak.mock.calls[0][0].voice.name).toBe('Mónica')
    unmount()
    window.speechSynthesis.speak.mockClear()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Escuchar' }))
    expect(window.speechSynthesis.speak.mock.calls[0][0].voice.name).toBe('Mónica')
    localStorage.removeItem('agrocultura.voz')
  })

  it('says numbers and units in words a voice can read', () => {
    expect(prepareForSpeech('5.775 m de altura, a unos 14 km · 100.000 cafetos «#café»')).toBe('5775 metros de altura, a unos 14 kilómetros, 100000 cafetos café')
  })

  it('tells the person when the device cannot read aloud', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true, writable: true })
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Escuchar' }))

    expect(await screen.findByText('Este dispositivo no puede leer en voz alta.')).toBeInTheDocument()
  })

  it('tells the person when the device has no voice that can read', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Escuchar' }))

    const utterance = window.speechSynthesis.speak.mock.calls[0][0]
    act(() => utterance.onerror({ error: 'synthesis-failed' }))

    expect(await screen.findByText('No se pudo leer en voz alta en este dispositivo.')).toBeInTheDocument()
    expect(screen.queryByText(/Leyendo en voz alta/)).not.toBeInTheDocument()
  })

  it('does not warn when the reading is stopped on purpose', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Escuchar' }))

    const utterance = window.speechSynthesis.speak.mock.calls[0][0]
    act(() => utterance.onerror({ error: 'interrupted' }))

    expect(screen.queryByText('No se pudo leer en voz alta en este dispositivo.')).not.toBeInTheDocument()
  })

  it('splits long text into short pieces on sentence ends', () => {
    const sentence = 'Esta es una frase de prueba que ocupa bastante espacio.'
    const chunks = splitForSpeech(Array(12).fill(sentence).join(' '))

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= 160)).toBe(true)
    expect(chunks.join(' ')).toBe(Array(12).fill(sentence).join(' '))
  })
})
