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

export type Theme = 'light' | 'dark'

// auto は Figma のテーマに合わせる（Figma 側が「システム」なら、Figma が決めた結果に合わせる）
export type ThemeSetting = Theme | 'auto'

// figma.clientStorage に保存するユーザー設定（language が null のときは OS の言語に合わせる）
export type Settings = {
  language: Language | null
  theme: ThemeSetting
  largeThumbnails: boolean
}

// 一覧を表示できない理由（文言は UI 側で言語に合わせて出す）
export type EmptyReason = 'no-selection' | 'no-variants' | 'load-failed'

// 操作に失敗した理由（文言は UI 側で訳し、notify で Figma に通知してもらう）
export type ErrorReason = 'swap-failed'

// UI → プラグイン本体
export type UiToPluginMessage =
  | { type: 'choose'; id: string; properties: VariantProperties }
  | { type: 'request-thumbnail'; id: string }
  | { type: 'refresh' }
  | { type: 'resize'; width: number; height: number }
  | { type: 'save-settings'; settings: Partial<Settings> }
  | { type: 'notify'; message: string; error: boolean }

// プラグイン本体 → UI
export type PluginToUiMessage =
  | { type: 'settings'; settings: Settings }
  | { type: 'empty'; reason: EmptyReason }
  | { type: 'variants'; title: string; filters: VariantFilter[]; entries: VariantEntry[] }
  | { type: 'thumbnail'; id: string; bytes: Uint8Array }
  | { type: 'thumbnail-error'; id: string }
  | { type: 'selected'; id: string }
  | { type: 'error'; reason: ErrorReason }
