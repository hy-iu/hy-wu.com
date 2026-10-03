import { createRoot } from 'react-dom/client'
import './styles/global.css'
import { ThemeToggle } from './components/ThemeToggle'
import { ListFilter } from './components/ListFilter'

// MPA 页面壳是预渲染的完整 HTML（无 JS 可读），
// React 只负责挂载交互件：每页的主题按钮 + 列表页的过滤条。
function pageData(): Record<string, unknown> {
  const el = document.getElementById('page-data')
  if (!el?.textContent) return {}
  try {
    return JSON.parse(el.textContent) as Record<string, unknown>
  } catch {
    return {}
  }
}

for (const el of document.querySelectorAll<HTMLElement>('[data-mount]')) {
  const kind = el.dataset.mount
  if (kind === 'theme-toggle') {
    createRoot(el).render(<ThemeToggle />)
  } else if (kind === 'filter') {
    createRoot(el).render(
      <ListFilter
        target={el.dataset.target ?? ''}
        kind={el.dataset.kind ?? 'rows'}
        data={pageData()}
      />,
    )
  }
}
