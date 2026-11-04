import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetConnectivityForTests } from '../offline/connectivity.js'

// Browser speech synthesis does not exist in jsdom: a controllable fake.
class FakeUtterance {
  constructor(text) {
    this.text = text
    this.lang = ''
    this.voice = null
    this.rate = 1
  }
}
globalThis.SpeechSynthesisUtterance = FakeUtterance
const speechSynthesisMock = { speak: vi.fn(), cancel: vi.fn(), getVoices: vi.fn(() => []) }
function installSpeech() {
  Object.defineProperty(window, 'speechSynthesis', { value: speechSynthesisMock, configurable: true, writable: true })
}
installSpeech()

beforeEach(() => {
  installSpeech()
  speechSynthesisMock.speak.mockClear()
  speechSynthesisMock.cancel.mockClear()
  speechSynthesisMock.getVoices.mockReset().mockReturnValue([])
})

// Each test starts from a clean DOM, clean browser storage and a working connection.
afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  resetConnectivityForTests()
  vi.unstubAllGlobals()
  delete navigator.mediaDevices // set by tests that fake a microphone
})
