import type { Language } from '../shared/messages'

const ja = {
  checkingSelection: '選択を確認中…',
  selectInstance: 'インスタンスを選択',
  noSelection: 'バリアントを持つインスタンスを1つ選択してください',
  noVariants: 'バリアントを持つインスタンスを選択してください',
  thumbnailSize: 'サムネイルサイズ',
  showNormal: '標準サイズで表示',
  showLarge: '大きいサイズで表示',
  reload: 'バリアントを再読み込み',
  language: '言語',
  resizeWindow: 'ウインドウサイズを変更',
  filters: 'フィルター',
  all: 'すべて',
  clear: 'クリア',
  clearFilter: '{name}をすべてに戻す',
  variantCount: '{count} 件',
  variantCountFiltered: '{visible} / {count} 件',
}

export type MessageKey = keyof typeof ja
type Params = Record<string, string | number>

const en: Record<MessageKey, string> = {
  checkingSelection: 'Checking selection…',
  selectInstance: 'Select an instance',
  noSelection: 'Select one instance that has variants.',
  noVariants: 'Select an instance that has variants.',
  thumbnailSize: 'Thumbnail size',
  showNormal: 'Standard thumbnails',
  showLarge: 'Large thumbnails',
  reload: 'Reload variants',
  language: 'Language',
  resizeWindow: 'Resize window',
  filters: 'Filters',
  all: 'All',
  clear: 'Clear',
  clearFilter: 'Reset {name} to All',
  variantCount: '{count} variants',
  variantCountFiltered: '{visible} / {count} variants',
}

const dictionaries: Record<Language, Record<MessageKey, string>> = { ja, en }
let current: Language = detectLanguage()

// 保存された設定がないときは OS（ブラウザ）の言語で決める
export function detectLanguage(): Language {
  return navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}

export function getLanguage(): Language {
  return current
}

export function t(key: MessageKey, params: Params = {}): string {
  return dictionaries[current][key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''))
}

// 言語を切り替えたときに訳し直せるよう、キーを要素に覚えさせてから文言を入れる
export function setText(element: HTMLElement, key: MessageKey, params?: Params): void {
  element.dataset.i18n = key
  setParams(element, params)
  element.textContent = t(key, params)
}

export function setTooltip(element: HTMLElement, key: MessageKey, params?: Params): void {
  element.dataset.i18nTooltip = key
  setParams(element, params)
  element.dataset.tooltip = t(key, params)
}

function setParams(element: HTMLElement, params?: Params): void {
  if (params) element.dataset.i18nParams = JSON.stringify(params)
  else delete element.dataset.i18nParams
}

// data-i18n（文言）・data-i18n-tooltip（ツールチップ）・data-i18n-label（aria-label）を今の言語で入れ直す
export function setLanguage(language: Language): void {
  current = language
  document.documentElement.lang = language
  document.querySelectorAll<HTMLElement>('[data-i18n], [data-i18n-tooltip], [data-i18n-label]').forEach((element) => {
    const params: Params = element.dataset.i18nParams ? JSON.parse(element.dataset.i18nParams) : {}
    if (element.dataset.i18n) element.textContent = t(element.dataset.i18n as MessageKey, params)
    if (element.dataset.i18nTooltip) element.dataset.tooltip = t(element.dataset.i18nTooltip as MessageKey, params)
    if (element.dataset.i18nLabel) element.setAttribute('aria-label', t(element.dataset.i18nLabel as MessageKey, params))
  })
}
