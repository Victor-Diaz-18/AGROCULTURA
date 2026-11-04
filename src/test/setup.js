import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Each test starts from a clean DOM and clean browser storage.
afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})
