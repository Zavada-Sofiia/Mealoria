import { t } from './i18n'

export const MIN_PASSWORD_LENGTH = 10

const COMMON = new Set([
  '123456', '1234567', '12345678', '123456789', '1234567890', '123123', '111111', '000000',
  '654321', '121212', '112233', '159753', '987654321', 'qwerty', 'qwertyuiop', 'qwerty123',
  'qazwsx', 'asdfgh', 'asdfghjkl', 'zxcvbn', 'zxcvbnm', '1q2w3e', '1q2w3e4r', '1qaz2wsx',
  'password', 'passw0rd', 'pass', 'admin', 'administrator', 'welcome', 'letmein', 'login',
  'iloveyou', 'monkey', 'dragon', 'football', 'master', 'sunshine', 'princess', 'abc123',
  'mealoria', 'пароль', 'йцукен', 'йцукенгшщзх', 'привіт', 'україна', 'слава україні',
])

const SEQUENCES = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiopasdfghjklzxcvbnm', 'йцукенгшщзхїфівапролджєячсмитьбю']

function isSequence(s: string): boolean {
  return s.length >= 4 && SEQUENCES.some((seq) => seq.includes(s) || [...seq].reverse().join('').includes(s))
}

/** What is wrong with a new password; an empty list means it is good enough. */
export function passwordProblems(password: string, email: string): string[] {
  const problems: string[] = []
  const lower = password.toLowerCase()
  if (password.length < MIN_PASSWORD_LENGTH) problems.push(t('Щонайменше {n} символів', { n: MIN_PASSWORD_LENGTH }))
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) problems.push(t('Мають бути і літери, і цифри'))
  const base = lower.replace(/[\d\W_]+$/u, '')
  if (COMMON.has(lower) || COMMON.has(base)) problems.push(t('Занадто поширений пароль'))
  else if (new Set(lower).size <= 2 || isSequence(lower) || isSequence(base))
    problems.push(t('Без повторів і послідовностей на кшталт 123123 чи qwerty'))
  const name = email.split('@')[0].toLowerCase()
  if (name.length >= 4 && lower.includes(name)) problems.push(t('Не використовуйте свою пошту в паролі'))
  return problems
}
