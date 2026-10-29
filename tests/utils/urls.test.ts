import { describe, expect, it } from 'vitest'
import { isHttpUrl, isUploadUrl, PHOTO_UPLOAD_PREFIX, youtubeEmbedUrl, youtubeVideoId } from '~/utils/urls'

describe('isHttpUrl', () => {
  it.each(['https://example.com/doc', 'http://example.com', 'HTTPS://EXAMPLE.COM/a?b=c'])('accepte %s', (url) => {
    expect(isHttpUrl(url)).toBe(true)
  })

  it.each([
    'javascript:alert(1)',
    ' javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox',
    '//example.com',
    '/api/uploads/x.png',
    'https://',
    'ftp://example.com'
  ])('refuse %s', (url) => {
    expect(isHttpUrl(url)).toBe(false)
  })
})

describe('isUploadUrl', () => {
  it('accepte un fichier téléversé', () => {
    expect(isUploadUrl(`${PHOTO_UPLOAD_PREFIX}c3027e5d-2f9b-4619-8603-f8749c135cc3.jpg`, PHOTO_UPLOAD_PREFIX)).toBe(true)
  })

  it.each(['../../.env', 'sous/dossier.png', 'x.png?y', 'x', ''])('refuse %s', (name) => {
    expect(isUploadUrl(`${PHOTO_UPLOAD_PREFIX}${name}`, PHOTO_UPLOAD_PREFIX)).toBe(false)
  })
})

describe('youtubeEmbedUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ']
  ])('intègre %s', (url, embed) => {
    expect(youtubeEmbedUrl(url)).toBe(embed)
  })

  it.each([
    'javascript:alert(1)//youtu.be/abcdefgh',
    'https://evil.example/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://vimeo.com/123456',
    null
  ])('n’intègre pas %s', (url) => {
    expect(youtubeEmbedUrl(url)).toBeNull()
  })
})

describe('youtubeVideoId (US-046)', () => {
  it('rend l’identifiant vérifié d’une vidéo, sinon null', () => {
    expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeVideoId('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(youtubeVideoId('https://www.youtube.com/watch?v=../../x')).toBeNull()
  })
})

