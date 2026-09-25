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

// UI → プラグイン本体
export type UiToPluginMessage =
  | { type: 'choose'; id: string; properties: VariantProperties }
  | { type: 'request-thumbnail'; id: string }
  | { type: 'refresh' }
  | { type: 'resize'; width: number; height: number }

// プラグイン本体 → UI
export type PluginToUiMessage =
  | { type: 'empty'; message: string }
  | { type: 'variants'; title: string; filters: VariantFilter[]; entries: VariantEntry[] }
  | { type: 'thumbnail'; id: string; bytes: Uint8Array }
  | { type: 'thumbnail-error'; id: string }
  | { type: 'selected'; id: string }
