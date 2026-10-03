import { useState } from 'react'

// 明暗切换：初始值由页面壳的内联脚本在首帧前写入 <html data-theme>，
// 这里只负责翻转并记忆。纯黑底（dark）与纯浅灰底（light）两档。
export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>(
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  )

  function flip() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('theme', next)
    } catch {
      /* 隐私模式下忽略 */
    }
    setTheme(next)
  }

  return (
    <button type="button" className="theme-btn" onClick={flip} title="切换明暗主题">
      {theme === 'dark' ? '◐ 暗' : '◑ 明'}
    </button>
  )
}
