import { createContext, useContext } from 'react'
import { getLang, type Lang } from '.'

export const LangContext = createContext<{ lang: Lang; changeLang: (l: Lang) => void }>({
  lang: getLang(),
  changeLang: () => {},
})

export const useLang = () => useContext(LangContext)
