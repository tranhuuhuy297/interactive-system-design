import { useCallback, useEffect, useRef, useState } from 'react'

const EVENT = 'sdh:storage'

/** localStorage-backed state, synced across every hook instance in the tab. */
export function useLocalStorageState<T>(key: string, initial: T) {
  // Ref, not a dep: callers usually pass a fresh literal every render.
  const initialRef = useRef(initial)
  const read = useCallback((): T => readStored(key, initialRef.current), [key])

  const [value, setValue] = useState<T>(() => readStored(key, initial))

  useEffect(() => {
    const sync = (e: Event) => {
      if ((e as CustomEvent<string>).detail === key) setValue(read())
    }
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [key, read])

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(read()) : next
      try {
        localStorage.setItem(key, JSON.stringify(resolved))
      } catch {
        /* storage full or disabled: keep in-memory only */
      }
      setValue(resolved)
      window.dispatchEvent(new CustomEvent(EVENT, { detail: key }))
    },
    [key, read],
  )

  return [value, set] as const
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}
