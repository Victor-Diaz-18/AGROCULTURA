import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import StoryMedia from './StoryMedia.jsx'

describe('los archivos de una historia', () => {
  it('shows a YouTube video with its player, from the address that sets no cookies, and its caption', () => {
    render(<StoryMedia medios={[{ tipo: 'youtube', url: 'https://www.youtube.com/watch?v=ZnR1xU-DRP8', leyenda: 'Documental de La Oraloteca' }]} />)

    const player = screen.getByTitle('Video: Documental de La Oraloteca')
    expect(player).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/ZnR1xU-DRP8')
    expect(screen.getByText('Documental de La Oraloteca')).toBeInTheDocument()
  })

  it('names an audio by its caption instead of «Audio del narrador», and credits the photos', () => {
    render(
      <StoryMedia
        medios={[
          { tipo: 'audio', url: 'https://s.public.blob.vercel-storage.com/historias/a/canto.mp3', duracion_s: 51, leyenda: 'Canto del atlapetes de Santa Marta' },
          { tipo: 'foto', url: 'https://s.public.blob.vercel-storage.com/historias/a/f.jpg', leyenda: 'Foto: autor, CC BY-SA 4.0' },
        ]}
      />,
    )

    expect(screen.getByText(/^Canto del atlapetes de Santa Marta/)).toBeInTheDocument()
    expect(screen.queryByText(/Audio del narrador/)).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Sobre las fotos' })).toHaveTextContent('Foto 1: Foto: autor, CC BY-SA 4.0')
  })

  it('ignores an address that is not a YouTube video', () => {
    const { container } = render(<StoryMedia medios={[{ tipo: 'youtube', url: 'https://evil.example.com/x' }]} />)

    expect(container.querySelector('iframe')).toBeNull()
  })
})
