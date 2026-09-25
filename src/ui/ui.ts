import './ui.css'
import type { PluginToUiMessage, UiToPluginMessage, VariantEntry, VariantFilter } from '../shared/messages'

// Figmaのプラグイン画面ではlocalStorageが使えない場合があるため、メモリ上の代替に差し替える
try { window.localStorage.getItem('x') } catch {
  const store = new Map<string, string>()
  const memoryStorage: Storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => { store.set(key, String(value)) },
    removeItem: (key) => { store.delete(key) },
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size },
  }
  Object.defineProperty(window, 'localStorage', { value: memoryStorage, configurable: true })
}

// Material Symbols Rounded: expand_more
const ICON_EXPAND_MORE = '<svg viewBox="0 -960 960 960" aria-hidden="true"><path fill="currentColor" d="M480-362q-8 0-15-2.5t-13-8.5L268-557q-11-11-11-28t11-28q11-11 28-11t28 11l156 156 156-156q11-11 28-11t28 11q11 11 11 28t-11 28L508-373q-6 6-13 8.5t-15 2.5Z"/></svg>'

function createIcon(svg: string, className: string): SVGElement {
  const template = document.createElement('template')
  template.innerHTML = svg
  const icon = template.content.firstElementChild as SVGElement
  icon.setAttribute('class', className)
  return icon
}

const grid = document.getElementById('grid') as HTMLDivElement
const content = document.getElementById('content') as HTMLElement
const filtersElement = document.getElementById('filters') as HTMLElement
const empty = document.getElementById('empty') as HTMLDivElement
const title = document.getElementById('title') as HTMLHeadingElement
const meta = document.getElementById('meta') as HTMLDivElement
const imageUrls = new Map<string, string>()
const elementsById = new Map<string, HTMLButtonElement>()
const entriesById = new Map<string, VariantEntry>()
const selectedFilters = new Map<string, string>()
let entries: VariantEntry[] = []
let filters: VariantFilter[] = []

function post(message: UiToPluginMessage): void { parent.postMessage({ pluginMessage: message }, '*') }
function clearImages(): void { imageUrls.forEach((url) => URL.revokeObjectURL(url)); imageUrls.clear() }
function selectId(id: string): void { elementsById.forEach((element, key) => element.classList.toggle('selected', key === id)) }

const observer = new IntersectionObserver((observed) => {
  for (const item of observed) {
    const target = item.target as HTMLElement
    if (!item.isIntersecting || target.dataset.loaded === 'true') continue
    target.dataset.loaded = 'true'
    post({ type: 'request-thumbnail', id: target.dataset.id ?? '' })
  }
}, { root: content, rootMargin: '120px' })

function applyFilters(): void {
  let visibleCount = 0
  for (const entry of entries) {
    const visible = filters.every((filter) => {
      const selected = selectedFilters.get(filter.name)
      return !selected || entry.properties[filter.name] === selected
    })
    const element = elementsById.get(entry.id)
    if (!element) continue
    element.hidden = !visible
    if (visible) { visibleCount += 1; observer.observe(element) } else observer.unobserve(element)
  }
  meta.textContent = visibleCount === entries.length ? entries.length + ' variants' : visibleCount + ' / ' + entries.length + ' variants'
}

function renderFilters(): void {
  filtersElement.replaceChildren()
  filtersElement.style.display = filters.length ? 'block' : 'none'
  if (!filters.length) return
  filtersElement.dataset.open = 'false'
  const heading = document.createElement('div'); heading.className = 'filter-heading'
  const toggle = document.createElement('button'); toggle.className = 'filter-toggle'; toggle.setAttribute('aria-expanded', 'false')
  const headingText = document.createElement('span'); headingText.textContent = 'フィルター'
  toggle.append(headingText, createIcon(ICON_EXPAND_MORE, 'filter-toggle-icon'))
  toggle.addEventListener('click', () => { const open = filtersElement.dataset.open !== 'true'; filtersElement.dataset.open = String(open); toggle.setAttribute('aria-expanded', String(open)) })
  heading.appendChild(toggle)
  const fields = document.createElement('div'); fields.className = 'filter-fields'
  filtersElement.append(heading, fields)

  for (const filter of filters) {
    const row = document.createElement('div'); row.className = 'filter-row'
    const name = document.createElement('div'); name.className = 'filter-name'; name.textContent = filter.name; name.dataset.tooltip = filter.name
    const select = document.createElement('select'); select.className = 'filter-select'; select.setAttribute('aria-label', filter.name)
    const all = document.createElement('option'); all.value = ''; all.textContent = 'すべて'; select.appendChild(all)
    for (const value of filter.values) {
      const option = document.createElement('option'); option.value = value; option.textContent = value; select.appendChild(option)
    }
    const selectWrap = document.createElement('div'); selectWrap.className = 'select-wrap'; selectWrap.append(select, createIcon(ICON_EXPAND_MORE, 'select-icon'))
    const clear = document.createElement('button'); clear.className = 'row-clear'; clear.textContent = 'クリア'; clear.dataset.tooltip = filter.name + 'をすべてに戻す'
    clear.hidden = !select.value
    select.addEventListener('change', () => { if (select.value) selectedFilters.set(filter.name, select.value); else selectedFilters.delete(filter.name); clear.hidden = !select.value; applyFilters(); scrollSelectedToTop() })
    clear.addEventListener('click', () => { select.value = ''; selectedFilters.delete(filter.name); clear.hidden = true; applyFilters(); scrollSelectedToTop(); select.focus() })
    row.append(name, selectWrap, clear)
    fields.appendChild(row)
  }
}

function renderVariants(message: Extract<PluginToUiMessage, { type: 'variants' }>): void {
  hideTooltip(); clearImages(); observer.disconnect(); grid.replaceChildren(); elementsById.clear(); entriesById.clear(); selectedFilters.clear()
  entries = message.entries; filters = message.filters
  title.textContent = message.title; empty.style.display = 'none'; grid.style.display = 'grid'
  renderFilters()
  for (const entry of entries) {
    entriesById.set(entry.id, entry)
    const button = document.createElement('button'); button.className = 'item' + (entry.selected ? ' selected' : '')
    button.dataset.id = entry.id; button.dataset.tooltip = Object.entries(entry.properties).map(([key, value]) => key + ': ' + value).join('\n')
    const thumb = document.createElement('div'); thumb.className = 'thumb'; const loader = document.createElement('div'); loader.className = 'placeholder'; thumb.appendChild(loader)
    const label = document.createElement('div'); label.className = 'label'; label.textContent = entry.label
    button.append(thumb, label); button.addEventListener('click', () => { selectId(entry.id); post({ type: 'choose', id: entry.id, properties: entry.properties }) })
    grid.appendChild(button); elementsById.set(entry.id, button)
  }
  applyFilters()
  scrollSelectedToTop()
}

// 今のバリアントが一覧の一行目に来るようにスクロールする（表示されていなければ先頭へ）
function scrollSelectedToTop(): void {
  const selected = grid.querySelector<HTMLElement>('.item.selected')
  if (!selected || selected.hidden) { content.scrollTop = 0; return }
  const paddingTop = Number.parseFloat(getComputedStyle(content).paddingTop) || 0
  content.scrollTop += selected.getBoundingClientRect().top - content.getBoundingClientRect().top - paddingTop
}

const tooltip = document.getElementById('tooltip') as HTMLDivElement
let tooltipTarget: HTMLElement | null = null
let tooltipTimer = 0

function showTooltip(target: HTMLElement): void {
  const text = target.dataset.tooltip
  if (!text) return
  tooltip.textContent = text
  tooltip.hidden = false
  const margin = 8
  const targetRect = target.getBoundingClientRect()
  const tooltipRect = tooltip.getBoundingClientRect()
  const centerX = targetRect.left + targetRect.width / 2
  const left = Math.min(Math.max(centerX - tooltipRect.width / 2, margin), innerWidth - tooltipRect.width - margin)
  const placeAbove = targetRect.top - tooltipRect.height - margin >= margin
  tooltip.dataset.placement = placeAbove ? 'top' : 'bottom'
  tooltip.style.left = `${Math.round(left)}px`
  tooltip.style.top = `${Math.round(placeAbove ? targetRect.top - tooltipRect.height - margin : targetRect.bottom + margin)}px`
  tooltip.style.setProperty('--arrow-x', `${Math.round(Math.min(Math.max(centerX - left, 10), tooltipRect.width - 10))}px`)
  tooltip.classList.add('show')
}

function scheduleTooltip(target: HTMLElement): void {
  if (tooltipTarget === target) return
  hideTooltip()
  tooltipTarget = target
  tooltipTimer = window.setTimeout(() => showTooltip(target), 300)
}

function hideTooltip(): void {
  clearTimeout(tooltipTimer)
  tooltipTarget = null
  tooltip.classList.remove('show')
  tooltip.hidden = true
}

function tooltipTargetOf(event: Event): HTMLElement | null {
  return event.target instanceof Element ? event.target.closest<HTMLElement>('[data-tooltip]') : null
}

document.addEventListener('pointerover', (event) => { const target = tooltipTargetOf(event); if (target) scheduleTooltip(target); else hideTooltip() })
document.documentElement.addEventListener('pointerleave', hideTooltip)
document.addEventListener('pointerdown', hideTooltip)
document.addEventListener('focusin', (event) => { const target = tooltipTargetOf(event); if (target?.matches(':focus-visible')) scheduleTooltip(target) })
document.addEventListener('focusout', hideTooltip)
document.addEventListener('scroll', hideTooltip, true)
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideTooltip() })

const normalButton = document.getElementById('thumbnail-size-normal') as HTMLButtonElement
const largeButton = document.getElementById('thumbnail-size-large') as HTMLButtonElement
function setLarge(enabled: boolean): void { document.body.classList.toggle('large-thumbnails', enabled); normalButton.setAttribute('aria-pressed', String(!enabled)); largeButton.setAttribute('aria-pressed', String(enabled)); localStorage.setItem('large-thumbnails', String(enabled)) }
setLarge(localStorage.getItem('large-thumbnails') === 'true')
normalButton.addEventListener('click', () => setLarge(false)); largeButton.addEventListener('click', () => setLarge(true))
document.getElementById('refresh')?.addEventListener('click', () => post({ type: 'refresh' }))

const resizeHandle = document.getElementById('resize-handle') as HTMLDivElement; let resizeStart: { x: number; y: number; width: number; height: number } | null = null
resizeHandle.addEventListener('pointerdown', (event) => { resizeStart = { x: event.clientX, y: event.clientY, width: innerWidth, height: innerHeight }; resizeHandle.setPointerCapture(event.pointerId); event.preventDefault() })
resizeHandle.addEventListener('pointermove', (event) => { if (resizeStart) post({ type: 'resize', width: resizeStart.width + event.clientX - resizeStart.x, height: resizeStart.height + event.clientY - resizeStart.y }) })
resizeHandle.addEventListener('pointerup', (event) => { resizeStart = null; resizeHandle.releasePointerCapture(event.pointerId) })

window.addEventListener('message', (event: MessageEvent<{ pluginMessage?: PluginToUiMessage } | undefined>) => {
  const message = event.data && event.data.pluginMessage
  if (!message) return
  if (message.type === 'empty') {
    hideTooltip(); clearImages(); observer.disconnect(); grid.replaceChildren(); filtersElement.replaceChildren(); filtersElement.style.display = 'none'; grid.style.display = 'none'
    empty.textContent = message.message; empty.style.display = 'grid'; title.textContent = 'Variant picker'; meta.textContent = 'インスタンスを選択'
  } else if (message.type === 'variants') renderVariants(message)
  else if (message.type === 'thumbnail') {
    const item = elementsById.get(message.id); if (!item) return
    const previous = imageUrls.get(message.id); if (previous) URL.revokeObjectURL(previous)
    const url = URL.createObjectURL(new Blob([message.bytes as BlobPart], { type: 'image/png' })); imageUrls.set(message.id, url)
    const image = document.createElement('img'); image.src = url; image.alt = ''; item.querySelector('.thumb')?.replaceChildren(image)
  } else if (message.type === 'thumbnail-error') { const thumb = elementsById.get(message.id)?.querySelector('.thumb'); if (thumb) thumb.textContent = '—' }
  else if (message.type === 'selected') selectId(message.id)
})
