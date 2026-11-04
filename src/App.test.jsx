import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App.jsx'

describe('App', () => {
  it('renders the project name', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'AGROCULTURA' })).toBeInTheDocument()
  })
})
