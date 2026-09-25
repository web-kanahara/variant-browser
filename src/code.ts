type VariantProperties = Record<string, string>

type UiMessage =
  | { type: 'choose'; id: string; properties: VariantProperties }
  | { type: 'request-thumbnail'; id: string }
  | { type: 'refresh' }
  | { type: 'resize'; width: number; height: number }

type VariantEntry = {
  id: string
  label: string
  properties: VariantProperties
  selected: boolean
}

const TOOL_ID = 'c0f24597-6cf3-431b-83aa-73cf004a524f'
const DISPLAY_NAME = 'Variant picker'
const thumbnailCache = new Map<string, Uint8Array>()
const visibleComponents = new Map<string, ComponentNode>()
let refreshToken = 0

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
    if (visibleComponents.has(id)) figma.ui.postMessage({ type: 'thumbnail', id, bytes })
  } catch {
    if (visibleComponents.has(id)) figma.ui.postMessage({ type: 'thumbnail-error', id })
  }
}

async function refresh(): Promise<void> {
  const token = ++refreshToken
  visibleComponents.clear()
  const selection = figma.currentPage.selection
  if (selection.length !== 1 || selection[0].type !== 'INSTANCE') {
    figma.ui.postMessage({ type: 'empty', message: 'バリアントを持つインスタンスを1つ選択してください' })
    return
  }

  const instance = selection[0]
  const main = await instance.getMainComponentAsync()
  if (token !== refreshToken) return
  if (!main || !main.parent || main.parent.type !== 'COMPONENT_SET') {
    figma.ui.postMessage({ type: 'empty', message: 'バリアントを持つインスタンスを選択してください' })
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

  figma.ui.postMessage({ type: 'variants', title: set.name, filters, entries, currentProperties })
}

async function chooseVariant(id: string, properties: VariantProperties): Promise<void> {
  const selection = figma.currentPage.selection
  if (selection.length !== 1 || selection[0].type !== 'INSTANCE') return
  try {
    selection[0].setProperties(properties)
    selection[0].setRelaunchData({ [TOOL_ID]: DISPLAY_NAME })
    figma.ui.postMessage({ type: 'selected', id })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    figma.notify(message, { error: true })
  }
}

figma.showUI(__html__, { width: 360, height: 520, themeColors: true })
figma.on('selectionchange', () => { void refresh() })
figma.ui.onmessage = (message: UiMessage) => {
  if (message.type === 'choose') void chooseVariant(message.id, message.properties)
  if (message.type === 'request-thumbnail') void sendThumbnail(message.id)
  if (message.type === 'refresh') void refresh()
  if (message.type === 'resize') {
    const width = Math.max(280, Math.min(900, Math.round(message.width)))
    const height = Math.max(320, Math.min(900, Math.round(message.height)))
    figma.ui.resize(width, height)
  }
}
void refresh()
