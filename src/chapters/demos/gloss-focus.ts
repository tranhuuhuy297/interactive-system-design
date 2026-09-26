import { navigate } from '../../lib/use-hash-route'

/** sessionStorage key the command palette sets before navigating to the glossary. */
export const GLOSSARY_FOCUS_KEY = 'sdh:glossary-focus'
/** Window event fired when a term is requested while the glossary is already open. */
export const GLOSSARY_FOCUS_EVENT = 'sdh:glossary-focus'

/** Open the glossary scrolled to `term`, whether or not it is already the current page. */
export function requestGlossaryFocus(term: string) {
  try { sessionStorage.setItem(GLOSSARY_FOCUS_KEY, term) } catch { /* storage disabled: event path still works */ }
  if (window.location.hash.replace(/^#\/?/, '').split('?')[0] === 'glossary') {
    window.dispatchEvent(new CustomEvent(GLOSSARY_FOCUS_EVENT, { detail: term }))
  } else {
    navigate('glossary')
  }
}
