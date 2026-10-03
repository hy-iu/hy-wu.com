import { useEffect, useMemo, useState } from 'react'

interface FilterProps {
  /** 要过滤的 tbody 选择器，行必须是预渲染的 <tr> */
  target: string
  kind: 'rows' | 'library'
  /** library 模式下由 page-data 提供：{ clusters: string[], total: number } */
  data: Record<string, unknown>
}

// 黄页风招牌交互：预渲染表格的即时过滤。
// 内容已在 HTML 里（无 JS 可读、SEO 可见），这里只做 display 的显隐。
export function ListFilter({ target, kind, data }: FilterProps) {
  const [q, setQ] = useState('')
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState<number | null>(null)

  const clusters = useMemo(() => {
    if (kind !== 'library') return []
    const d = data as { clusters?: unknown }
    return Array.isArray(d.clusters) ? d.clusters.map(String) : []
  }, [kind, data])

  useEffect(() => {
    const tbody = document.querySelector(target)
    if (!tbody) return
    const rows = Array.from(tbody.querySelectorAll('tr'))
    const needle = q.trim().toLowerCase()
    let visible = 0
    for (const row of rows) {
      const textOk = needle === '' || row.textContent?.toLowerCase().includes(needle)
      const topicOk = topic === '' || (row as HTMLElement).dataset.topic === topic
      const show = textOk && topicOk
      ;(row as HTMLElement).classList.toggle('hide', !show)
      if (show) visible++
    }
    setCount(visible)
  }, [q, topic, target])

  return (
    <div className="filter-bar">
      <input
        type="search"
        value={q}
        placeholder="过滤…"
        onChange={(e) => setQ(e.target.value)}
        aria-label="过滤列表"
      />
      {kind === 'library' && clusters.length > 0 && (
        <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="按主题筛选">
          <option value="">全部主题</option>
          {clusters.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}
      {count !== null && <span className="count">{count} 条</span>}
    </div>
  )
}
