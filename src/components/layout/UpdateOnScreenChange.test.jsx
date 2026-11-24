import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { screenChanged } from '../../offline/updates.js'
import UpdateOnScreenChange from './UpdateOnScreenChange.jsx'

vi.mock('../../offline/updates.js', () => ({ screenChanged: vi.fn() }))

function Screens() {
  const navigate = useNavigate()
  return (
    <>
      <button type="button" onClick={() => navigate('/otra')}>Ir a otra</button>
      <button type="button" onClick={() => navigate('/otra')}>Quedarse en la misma</button>
    </>
  )
}

const open = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <UpdateOnScreenChange />
      <Routes>
        <Route path="*" element={<Screens />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => screenChanged.mockClear())

describe('new versions come in as the person moves between screens', () => {
  it('opening the app is not a change of screen', () => {
    open()

    expect(screenChanged).not.toHaveBeenCalled()
  })

  it('tells the updates each time the screen changes, and only then', async () => {
    const user = userEvent.setup()
    open()

    await user.click(screen.getByRole('button', { name: 'Ir a otra' }))
    expect(screenChanged).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Quedarse en la misma' }))
    expect(screenChanged).toHaveBeenCalledTimes(1)
  })

  it('shows nothing: nobody is asked to update', () => {
    const { container } = open()

    expect(screen.queryByText(/versión nueva/i)).not.toBeInTheDocument()
    expect(container.querySelector('[role=status]')).toBeNull()
  })
})
