import type { PluginToUiMessage, Settings, UiToPluginMessage, VariantEntry, VariantProperties } from './shared/messages'

const SETTINGS_KEY = 'settings'
const thumbnailCache = new Map<string, Uint8Array>()
const visibleComponents = new Map<string, ComponentNode>()
let refreshToken = 0
let settings: Settings = { language: null, largeThumbnails: false }

function post(message: PluginToUiMessage): void {
  figma.ui.postMessage(message)
}

async function loadSettings(): Promise<Settings> {
  const stored: unknown = await figma.clientStorage.getAsync(SETTINGS_KEY)
  const value = (stored && typeof stored === 'object' ? stored : {}) as Partial<Settings>
  return {
    language: value.language === 'ja' || value.language === 'en' ? value.language : null,
    largeThumbnails: value.largeThumbnails === true,
  }
}

async function saveSettings(changes: Partial<Settings>): Promise<void> {
  settings = { ...settings, ...changes }
  try {
    await figma.clientStorage.setAsync(SETTINGS_KEY, settings)
  } catch {
    // 保存できなくても今回の表示には影響しないので無視する
  }
}

function parseVariantName(name: string): VariantProperties {
  const properties: VariantProperties = {}
  for (const part of name.split(',')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (key && value) properties[key] = value
  }
  return properties
}

function entryLabel(component: ComponentNode, properties: VariantProperties): string {
  const preferred = Object.entries(properties).find(([name]) =>
    ['name', 'label', 'type', 'state'].includes(name.toLowerCase()),
  )
  return preferred?.[1] ?? component.name
}

async function sendThumbnail(id: string): Promise<void> {
  const component = visibleComponents.get(id)
  if (!component) return
  try {
    let bytes = thumbnailCache.get(id)
    if (!bytes) {
      const isWide = component.width >= component.height
      bytes = await component.exportAsync({
        format: 'PNG',
        constraint: { type: isWide ? 'WIDTH' : 'HEIGHT', value: isWide ? 240 : 180 },
      })
      thumbnailCache.set(id, bytes)
    }
    if (visibleComponents.has(id)) post({ type: 'thumbnail', id, bytes })
  } catch {
    if (visibleComponents.has(id)) post({ type: 'thumbnail-error', id })
  }
}

async function refresh(): Promise<void> {
  const token = ++refreshToken
  visibleComponents.clear()
  try {
    await loadVariants(token)
  } catch {
    // 壊れたコンポーネントセットなどで読み込めないときも、画面を止めずに理由を出す
    if (token !== refreshToken) return
    visibleComponents.clear()
    post({ type: 'empty', reason: 'load-failed' })
  }
}

async function loadVariants(token: number): Promise<void> {
  const selection = figma.currentPage.selection
  if (selection.length !== 1 || selection[0].type !== 'INSTANCE') {
    post({ type: 'empty', reason: 'no-selection' })
    return
  }

  const instance = selection[0]
  const main = await instance.getMainComponentAsync()
  if (token !== refreshToken) return
  if (!main || !main.parent || main.parent.type !== 'COMPONENT_SET') {
    post({ type: 'empty', reason: 'no-variants' })
    return
  }

  const set = main.parent
  const currentProperties: VariantProperties = {}
  for (const [name, property] of Object.entries(instance.componentProperties)) {
    if (property.type === 'VARIANT') currentProperties[name] = String(property.value)
  }

  const components = set.children.filter((child): child is ComponentNode => child.type === 'COMPONENT')
  const entries: VariantEntry[] = components.map((component) => {
    const properties = parseVariantName(component.name)
    visibleComponents.set(component.id, component)
    return {
      id: component.id,
      label: entryLabel(component, properties),
      properties,
      selected: Object.entries(currentProperties).every(([name, value]) => properties[name] === value),
    }
  })

  const filters = Object.entries(set.componentPropertyDefinitions)
    .filter(([, definition]) => definition.type === 'VARIANT')
    .map(([name, definition]) => {
      const derived = entries.map((entry) => entry.properties[name]).filter(Boolean)
      const values = [...new Set([...(definition.variantOptions ?? []), ...derived])]
      return { name, values }
    })
    .filter((filter) => filter.values.length > 0)

  post({ type: 'variants', title: set.name, filters, entries })
}

async function chooseVariant(id: string, properties: VariantProperties): Promise<void> {
  const selection = figma.currentPage.selection
  if (selection.length !== 1 || selection[0].type !== 'INSTANCE') return
  try {
    selection[0].setProperties(properties)
    post({ type: 'selected', id })
  } catch {
    post({ type: 'error', reason: 'swap-failed' })
  }
}

figma.showUI(__html__, { width: 360, height: 520, themeColors: true })
figma.on('selectionchange', () => { void refresh() })
figma.ui.onmessage = (message: UiToPluginMessage) => {
  if (message.type === 'choose') void chooseVariant(message.id, message.properties)
  if (message.type === 'request-thumbnail') void sendThumbnail(message.id)
  if (message.type === 'refresh') void refresh()
  if (message.type === 'save-settings') void saveSettings(message.settings)
  if (message.type === 'notify') figma.notify(message.message, { error: message.error })
  if (message.type === 'resize') {
    const width = Math.max(280, Math.min(900, Math.round(message.width)))
    const height = Math.max(320, Math.min(900, Math.round(message.height)))
    figma.ui.resize(width, height)
  }
}

async function start(): Promise<void> {
  try {
    settings = await loadSettings()
  } catch {
    // 読み込めなくても初期値のまま続ける
  }
  post({ type: 'settings', settings })
  await refresh()
}
void start()
