import { getHeader, setHeader } from 'h3'

export default defineEventHandler((event) => {
  const cookie = event.req.headers.cookie
  if (cookie) {
    setHeader(event, 'cookie', cookie)
  }

  const host = event.req.headers.host
  if (host) {
    setHeader(event, 'host', host)
  }

  const xfh = event.req.headers['x-forwarded-host']
  if (xfh) {
    setHeader(event, 'x-forwarded-host', xfh)
  }
})
