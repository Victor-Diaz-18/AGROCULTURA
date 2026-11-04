import { vi } from 'vitest'

/**
 * A fake microphone and MediaRecorder for tests (jsdom has neither).
 * `denied`: the error name getUserMedia rejects with, e.g. "NotAllowedError".
 */
export function installFakeRecording({ denied = null, mimeTypes = ['audio/webm;codecs=opus'] } = {}) {
  const tracksStop = vi.fn()
  const stream = { getTracks: () => [{ stop: tracksStop }] }
  const getUserMedia = denied
    ? vi.fn().mockRejectedValue(Object.assign(new Error('blocked'), { name: denied }))
    : vi.fn().mockResolvedValue(stream)
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true, writable: true })

  class FakeMediaRecorder {
    static instances = []
    static isTypeSupported(type) {
      return mimeTypes.includes(type)
    }

    constructor(media, options) {
      this.options = options
      this.mimeType = options?.mimeType ?? ''
      this.state = 'inactive'
      FakeMediaRecorder.instances.push(this)
    }

    start() {
      this.state = 'recording'
    }

    stop() {
      this.state = 'inactive'
      this.ondataavailable?.({ data: new Blob(['fake-audio-bytes'], { type: this.mimeType }) })
      this.onstop?.()
    }
  }
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  return { getUserMedia, tracksStop, FakeMediaRecorder }
}
