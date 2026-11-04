import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MESSAGES } from '../../hooks/useRecorder.js'
import AudioRecorder from './AudioRecorder.jsx'

const idle = { status: 'idle', seconds: 0, audio: null, error: '', notice: '', supported: true }
const handlers = () => ({ onStart: vi.fn(), onStop: vi.fn(), onRemove: vi.fn() })

afterEach(() => vi.restoreAllMocks())

describe('AudioRecorder (F5)', () => {
  it('invites to record and starts when tapped', async () => {
    const user = userEvent.setup()
    const actions = handlers()
    render(<AudioRecorder {...idle} {...actions} />)

    expect(screen.getByText('Toca para grabar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Grabar tu historia' }))

    expect(actions.onStart).toHaveBeenCalledTimes(1)
  })

  it('shows the time while recording and stops when tapped', async () => {
    const user = userEvent.setup()
    const actions = handlers()
    render(<AudioRecorder {...idle} {...actions} status="recording" seconds={75} />)

    expect(screen.getByText('Grabando… 1:15')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Terminar de grabar' }))

    expect(actions.onStop).toHaveBeenCalledTimes(1)
  })

  it('shows the finished audio with its length and lets the person record again or remove it', async () => {
    const user = userEvent.setup()
    const actions = handlers()
    render(<AudioRecorder {...idle} {...actions} audio={{ blob: new Blob(['x']), seconds: 95 }} />)

    expect(screen.getByText('Audio grabado · 1:35')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Grabar de nuevo' }))
    await user.click(screen.getByRole('button', { name: 'Quitar' }))

    expect(actions.onStart).toHaveBeenCalledTimes(1)
    expect(actions.onRemove).toHaveBeenCalledTimes(1)
  })

  it('lets the person listen to the recording before sending it', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:grabacion'), revokeObjectURL: vi.fn() }))
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    render(<AudioRecorder {...idle} {...handlers()} audio={{ blob: new Blob(['x']), seconds: 5 }} />)

    await user.click(screen.getByRole('button', { name: 'Oír mi audio' }))
    expect(play).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Parar' }))
    expect(pause).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Oír mi audio' })).toBeInTheDocument()
  })

  it('tells the person to write when the device cannot record, and does not offer a dead button', () => {
    render(<AudioRecorder {...idle} {...handlers()} supported={false} />)

    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGES.unsupported)
    expect(screen.getByRole('button', { name: 'Grabar tu historia' })).toBeDisabled()
  })

  it('shows why a recording failed', () => {
    render(<AudioRecorder {...idle} {...handlers()} error={MESSAGES.denied} />)

    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGES.denied)
  })
})
