import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AudioPlayer from './AudioPlayer.jsx'

afterEach(() => vi.restoreAllMocks())

const URL_OK = 'https://s.public.blob.vercel-storage.com/historias/u/a.webm'

describe('AudioPlayer (F5)', () => {
  it('plays and pauses', async () => {
    const user = userEvent.setup()
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () {
      fireEvent.play(this)
      return Promise.resolve()
    })
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function () {
      fireEvent.pause(this)
    })
    render(<AudioPlayer url={URL_OK} seconds={204} />)

    await user.click(screen.getByRole('button', { name: 'Escuchar el audio' }))
    expect(play).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Pausar' }))

    expect(pause).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Escuchar el audio' })).toBeInTheDocument()
  })

  it('shows the time that passed and the length of the story, and fills the bar', () => {
    const { container } = render(<AudioPlayer url={URL_OK} seconds={200} />)
    const audio = container.querySelector('audio')

    expect(screen.getByText('3:20')).toBeInTheDocument()
    Object.defineProperty(audio, 'currentTime', { value: 50, configurable: true })
    fireEvent.timeUpdate(audio)

    expect(screen.getByText('0:50')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Avance del audio' })).toHaveAttribute('aria-valuenow', '25')
  })

  it('goes back to the start when it ends', () => {
    const { container } = render(<AudioPlayer url={URL_OK} seconds={100} />)
    const audio = container.querySelector('audio')
    Object.defineProperty(audio, 'currentTime', { value: 100, configurable: true })
    fireEvent.timeUpdate(audio)

    fireEvent.ended(audio)

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('uses the length of the file when the story does not say it', () => {
    const { container } = render(<AudioPlayer url={URL_OK} />)
    const audio = container.querySelector('audio')

    Object.defineProperty(audio, 'duration', { value: 75, configurable: true })
    fireEvent.loadedMetadata(audio)

    expect(screen.getByText('1:15')).toBeInTheDocument()
  })

  it('does not trust a length of "infinity" (recordings made in the browser)', () => {
    const { container } = render(<AudioPlayer url={URL_OK} />)
    const audio = container.querySelector('audio')

    Object.defineProperty(audio, 'duration', { value: Infinity, configurable: true })
    fireEvent.loadedMetadata(audio)

    expect(screen.getAllByText('0:00')).toHaveLength(2)
  })

  it('an example story has no file: the button is off and says why', () => {
    render(<AudioPlayer seconds={188} />)

    expect(screen.getByRole('button', { name: 'Escuchar el audio' })).toBeDisabled()
    expect(screen.getByText('Historia de ejemplo: no tiene archivo de audio.')).toBeInTheDocument()
    expect(screen.getByText('3:08')).toBeInTheDocument()
  })

  it('says so when the audio cannot be played', async () => {
    const user = userEvent.setup()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('blocked'))
    render(<AudioPlayer url={URL_OK} seconds={10} />)

    await user.click(screen.getByRole('button', { name: 'Escuchar el audio' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos reproducir este audio.')
  })
})
