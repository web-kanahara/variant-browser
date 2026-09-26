export type VariantProperties = Record<string, string>

export type VariantEntry = {
  id: string
  label: string
  properties: VariantProperties
  selected: boolean
}

export type VariantFilter = {
  name: string
  values: string[]
}

export type Language = 'ja' | 'en'

// figma.clientStorage に保存するユーザー設定（language が null のときは UI が OS の言語から決める）
export type Settings = {
  language: Language | null
  largeThumbnails: boolean
}

// 一覧を表示できない理由（文言は UI 側で言語に合わせて出す）
export type EmptyReason = 'no-selection' | 'no-variants'

// UI → プラグイン本体
export type UiToPluginMessage =
  | { type: 'choose'; id: string; properties: VariantProperties }
  | { type: 'request-thumbnail'; id: string }
  | { type: 'refresh' }
  | { type: 'resize'; width: number; height: number }
  | { type: 'save-settings'; settings: Partial<Settings> }

// プラグイン本体 → UI
export type PluginToUiMessage =
  | { type: 'settings'; settings: Settings }
  | { type: 'empty'; reason: EmptyReason }
  | { type: 'variants'; title: string; filters: VariantFilter[]; entries: VariantEntry[] }
  | { type: 'thumbnail'; id: string; bytes: Uint8Array }
  | { type: 'thumbnail-error'; id: string }
  | { type: 'selected'; id: string }
