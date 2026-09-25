import { useEffect, useState } from 'react'

/** Current route id from `#/chapter-id`; empty string = home. */
export function useHashRoute(): string {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('?')[0]
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(id: string) {
  window.location.hash = id ? `/${id}` : '/'
}
