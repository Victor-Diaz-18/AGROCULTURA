import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CONFIG } from '../test/fixtures.js'
import { renderApp, callsTo, reply } from '../test/renderApp.jsx'
import { setSimulatedOffline } from '../offline/connectivity.js'
import { cacheSet } from '../offline/store.js'
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

  describe('la voz del portal', () => {
    const withVoice = (api = {}) => renderApp({ api: { '/config': { ...CONFIG, voz_disponible: true }, ...api } })
    let play
    beforeEach(() => {
      play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
      vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    })
    afterEach(() => vi.restoreAllMocks())

    it('plays the audio the server made, and the voice of the device stays quiet', async () => {
      const user = userEvent.setup()
      const { fetchMock } = withVoice({ '/voz/portada': { url: 'https://audio.test/portada.mp3' } })
      await waitFor(() => expect(callsTo(fetchMock, '/config').length).toBeGreaterThan(0))
      await act(async () => {})

      await user.click(screen.getByRole('button', { name: 'Escuchar' }))

      await waitFor(() => expect(callsTo(fetchMock, '/voz/portada')).toHaveLength(1))
      expect(play).toHaveBeenCalled()
      expect(window.speechSynthesis.speak).not.toHaveBeenCalled()
      expect(await screen.findByText(/Leyendo en voz alta/)).toBeInTheDocument()
    })

    it('reads the fixed words of another page with the same voice', async () => {
      const user = userEvent.setup()
      const { fetchMock } = renderApp({
        route: '/proximamente/360',
        api: { '/config': { ...CONFIG, voz_disponible: true }, '/voz/paginas/proximamente-360': { url: 'https://audio.test/360.mp3' } },
      })
      await waitFor(() => expect(callsTo(fetchMock, '/config').length).toBeGreaterThan(0))
      await act(async () => {})

      await user.click(screen.getByRole('button', { name: 'Escuchar' }))

      await waitFor(() => expect(callsTo(fetchMock, '/voz/paginas/proximamente-360')).toHaveLength(1))
      expect(window.speechSynthesis.speak).not.toHaveBeenCalled()
    })

    it('when the service fails, the voice of the device reads instead', async () => {
      const user = userEvent.setup()
      const { fetchMock } = withVoice({ '/voz/portada': () => reply({ detail: 'x' }, 503) })
      await waitFor(() => expect(callsTo(fetchMock, '/config').length).toBeGreaterThan(0))
      await act(async () => {})

      await user.click(screen.getByRole('button', { name: 'Escuchar' }))

      await waitFor(() => expect(window.speechSynthesis.speak).toHaveBeenCalled())
    })

    it('when the phone refuses to play it, the voice of the device reads instead', async () => {
      const user = userEvent.setup()
      const { fetchMock } = withVoice({ '/voz/portada': { url: 'https://audio.test/portada.mp3' } })
      await waitFor(() => expect(callsTo(fetchMock, '/config').length).toBeGreaterThan(0))
      await act(async () => {})
      play.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('blocked'))

      await user.click(screen.getByRole('button', { name: 'Escuchar' }))

      await waitFor(() => expect(window.speechSynthesis.speak).toHaveBeenCalled())
    })

    it('with no signal, it plays what this device kept, without asking the server', async () => {
      const user = userEvent.setup()
      await cacheSet('voz:portada', { url: 'https://audio.test/portada.mp3', bytes: new ArrayBuffer(8), type: 'audio/mpeg' })
      URL.createObjectURL = vi.fn(() => 'blob:guardado')
      const { fetchMock } = withVoice()
      await waitFor(() => expect(callsTo(fetchMock, '/config').length).toBeGreaterThan(0))
      await act(async () => {})
      act(() => setSimulatedOffline(true))

      await user.click(screen.getByRole('button', { name: 'Escuchar' }))

      await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled())
      expect(callsTo(fetchMock, '/voz/portada')).toHaveLength(0)
      expect(window.speechSynthesis.speak).not.toHaveBeenCalled()
    })

    it('with no signal and nothing kept, the voice of the device reads', async () => {
      const user = userEvent.setup()
      const { fetchMock } = withVoice()
      await waitFor(() => expect(callsTo(fetchMock, '/config').length).toBeGreaterThan(0))
      await act(async () => {})
      act(() => setSimulatedOffline(true))

      await user.click(screen.getByRole('button', { name: 'Escuchar' }))

      await waitFor(() => expect(window.speechSynthesis.speak).toHaveBeenCalled())
    })

    it('"Detener" stops the audio', async () => {
      const user = userEvent.setup()
      const { fetchMock } = withVoice({ '/voz/portada': { url: 'https://audio.test/portada.mp3' } })
      await waitFor(() => expect(callsTo(fetchMock, '/config').length).toBeGreaterThan(0))
      await act(async () => {})
      await user.click(screen.getByRole('button', { name: 'Escuchar' }))

      await user.click(await screen.findByRole('button', { name: 'Detener' }))

      expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled()
      expect(screen.queryByText(/Leyendo en voz alta/)).not.toBeInTheDocument()
    })
  })
})
