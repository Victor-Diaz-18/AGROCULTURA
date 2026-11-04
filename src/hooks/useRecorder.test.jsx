import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { installFakeRecording } from '../test/fakeMedia.js'
import useRecorder, { MESSAGES, pickMimeType } from './useRecorder.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

async function startRecording(hook) {
  await act(async () => {
    await hook.result.current.start()
  })
}

describe('useRecorder (F5)', () => {
  it('records, counts the seconds and hands over the audio when stopped', async () => {
    const { tracksStop } = installFakeRecording()
    const onRecorded = vi.fn()
    const hook = renderHook(() => useRecorder({ onRecorded }))

    await startRecording(hook)
    expect(hook.result.current.status).toBe('recording')
    act(() => vi.advanceTimersByTime(12_000))
    expect(hook.result.current.seconds).toBe(12)
    act(() => hook.result.current.stop())

    expect(hook.result.current.status).toBe('idle')
    expect(onRecorded).toHaveBeenCalledTimes(1)
    const { blob, seconds, mime } = onRecorded.mock.calls[0][0]
    expect(seconds).toBe(12)
    expect(mime).toBe('audio/webm;codecs=opus')
    expect(blob.size).toBeGreaterThan(0)
    expect(tracksStop).toHaveBeenCalled() // the microphone is released
  })

  it('asks for a mono, low-bitrate recording', async () => {
    const { getUserMedia, FakeMediaRecorder } = installFakeRecording()
    const hook = renderHook(() => useRecorder({ onRecorded: vi.fn() }))

    await startRecording(hook)

    expect(getUserMedia.mock.calls[0][0].audio.channelCount).toBe(1)
    expect(FakeMediaRecorder.instances[0].options.audioBitsPerSecond).toBe(24_000)
  })

  it('falls back to mp4 where webm is not available (iPhone)', async () => {
    installFakeRecording({ mimeTypes: ['audio/mp4;codecs=mp4a.40.2'] })
    const onRecorded = vi.fn()
    const hook = renderHook(() => useRecorder({ onRecorded }))

    expect(pickMimeType()).toBe('audio/mp4;codecs=mp4a.40.2')
    await startRecording(hook)
    act(() => hook.result.current.stop())

    expect(onRecorded.mock.calls[0][0].mime).toBe('audio/mp4;codecs=mp4a.40.2')
  })

  it('explains it when the microphone is not allowed', async () => {
    installFakeRecording({ denied: 'NotAllowedError' })
    const onRecorded = vi.fn()
    const hook = renderHook(() => useRecorder({ onRecorded }))

    await startRecording(hook)

    expect(hook.result.current.status).toBe('idle')
    expect(hook.result.current.error).toBe(MESSAGES.denied)
    expect(onRecorded).not.toHaveBeenCalled()
  })

  it('explains it when there is no microphone', async () => {
    installFakeRecording({ denied: 'NotFoundError' })
    const hook = renderHook(() => useRecorder({ onRecorded: vi.fn() }))

    await startRecording(hook)

    expect(hook.result.current.error).toBe(MESSAGES.noMicrophone)
  })

  it('says so when the device cannot record at all', async () => {
    const hook = renderHook(() => useRecorder({ onRecorded: vi.fn() }))

    await startRecording(hook)

    expect(hook.result.current.supported).toBe(false)
    expect(hook.result.current.error).toBe(MESSAGES.unsupported)
  })

  it('stops by itself at the time limit and says so', async () => {
    installFakeRecording()
    const onRecorded = vi.fn()
    const hook = renderHook(() => useRecorder({ onRecorded, maxSeconds: 5 }))

    await startRecording(hook)
    act(() => vi.advanceTimersByTime(6_000))

    expect(hook.result.current.status).toBe('idle')
    expect(hook.result.current.notice).toBe(MESSAGES.limit)
    expect(onRecorded).toHaveBeenCalledTimes(1)
    expect(onRecorded.mock.calls[0][0].seconds).toBeLessThanOrEqual(5)
  })

  it('discards the recording and frees the microphone when the person leaves the page', async () => {
    const { tracksStop } = installFakeRecording()
    const onRecorded = vi.fn()
    const hook = renderHook(() => useRecorder({ onRecorded }))
    await startRecording(hook)

    hook.unmount()

    expect(tracksStop).toHaveBeenCalled()
    expect(onRecorded).not.toHaveBeenCalled()
  })
})
