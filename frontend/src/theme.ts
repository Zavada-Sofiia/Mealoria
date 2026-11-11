export type Theme = 'light' | 'dark'

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0e171b' : '#056c79')
  try {
    localStorage.setItem('theme', theme)
  } catch {
    // private mode: the choice just lasts until the page is closed
  }
}
