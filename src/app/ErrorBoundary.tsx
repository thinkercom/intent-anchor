import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Download, RefreshCw, Wrench, Trash2, ChevronDown } from 'lucide-react'
import {
  clearStoredData,
  exportRescueBackup,
  hardReloadAndClearCache,
  hasLocalData,
  readCrashes,
  recordCrash,
  reloadPage,
  repairStoredData,
  snapshotCorruptedData,
} from '../lib/rescue'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  info: ErrorInfo | null
  detail: boolean
  busy: 'export' | 'repair' | null
  note: string
  hadData: boolean
  crashCount: number
}

/**
 * 崩溃页自己判断明暗：不能只依赖 <html data-theme>，
 * 因为崩溃发生在首帧时 useTheme 的 effect 还没执行，属性还没写上。
 */
function detectDarkTheme(): boolean {
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'dark' || attr === 'light') return attr === 'dark'
  try {
    const saved = localStorage.getItem('intent-anchor-theme-mode')
    if (saved === 'dark' || saved === 'light') return saved === 'dark'
  } catch {
    // 隐私模式下读不到，继续走时间/系统判断
  }
  const hour = new Date().getHours()
  if (hour >= 18 || hour < 6) return true
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
}

/**
 * 全局错误边界：任何渲染期异常都不再是白屏。
 * 崩溃页只依赖 localStorage 原始字符串，所以即使 store 数据坏了也能导出数据自救。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
    info: null,
    detail: false,
    busy: null,
    note: '',
    hadData: false,
    crashCount: 0,
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    recordCrash(error, info)
    this.setState({
      info,
      crashCount: readCrashes().length,
      hadData: hasLocalData(),
    })
  }

  private handleReload = (): void => {
    reloadPage()
  }

  private handleExport = async (): Promise<void> => {
    this.setState({ busy: 'export', note: '' })
    try {
      const result = await exportRescueBackup()
      this.setState({
        busy: null,
        note:
          result === 'cancelled'
            ? '已取消导出'
            : result === 'shared'
              ? '数据已保存，可以放心修复或重装'
              : '数据已下载到本机',
      })
    } catch (e) {
      this.setState({ busy: null, note: e instanceof Error ? e.message : '导出失败' })
    }
  }

  private handleRepair = (): void => {
    this.setState({ busy: 'repair', note: '' })
    // 修复会覆盖原数据，先留一份损坏快照，万一修完更糟还能找回原始内容
    snapshotCorruptedData()
    const result = repairStoredData()
    if (result.ok) {
      this.setState({ busy: null, note: '数据已修复，正在重新加载…' })
      window.setTimeout(reloadPage, 600)
    } else {
      this.setState({ busy: null, note: result.message })
    }
  }

  private handleClear = (): void => {
    const ok = window.confirm(
      this.state.hadData
        ? '会清空本机所有习惯与打卡记录，且不可撤销。\n\n建议先点「导出数据」留一份备份。确定继续吗？'
        : '确定清空本机数据并重新加载？',
    )
    if (!ok) return
    snapshotCorruptedData()
    clearStoredData()
    window.setTimeout(reloadPage, 200)
  }

  private handleHardReload = (): void => {
    void hardReloadAndClearCache()
  }

  render(): ReactNode {
    const { error, info, detail, busy, note, crashCount } = this.state
    if (!error) return this.props.children

    const dark = detectDarkTheme()

    const c = dark
      ? {
          bg: '#07080c',
          fg: '#f2f0ef',
          muted: '#9a98a3',
          card: 'rgba(28,27,36,0.72)',
          border: 'rgba(200,182,216,0.18)',
          accent: '#c8b6d8',
          danger: '#e08a8a',
          code: 'rgba(0,0,0,0.35)',
        }
      : {
          bg: '#f4f2ec',
          fg: '#2c2a26',
          muted: '#7a766c',
          card: 'rgba(255,255,255,0.78)',
          border: 'rgba(60,55,45,0.12)',
          accent: '#8a7f6d',
          danger: '#c96b6b',
          code: 'rgba(60,55,45,0.06)',
        }

    const primary: CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: '100%',
      padding: '12px 16px',
      borderRadius: 12,
      border: 'none',
      background: c.accent,
      color: c.bg,
      fontSize: 14,
      lineHeight: 1.2,
      cursor: 'pointer',
    }
    const secondary: CSSProperties = {
      ...primary,
      background: 'transparent',
      color: c.fg,
      border: `1px solid ${c.border}`,
    }
    const linkBtn: CSSProperties = {
      background: 'none',
      border: 'none',
      padding: '6px 2px',
      color: c.muted,
      fontSize: 11,
      textDecoration: 'underline',
      textUnderlineOffset: 3,
      cursor: 'pointer',
    }

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: c.bg,
          color: c.fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          overflowY: 'auto',
          fontFamily:
            "'DM Sans', system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
        }}
        role="alert"
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: c.card,
            border: `1px solid ${c.border}`,
            borderRadius: 20,
            padding: '22px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={20} style={{ color: c.danger, flexShrink: 0 }} />
            <span style={{ fontSize: 16 }}>页面没能正常显示</span>
          </div>

          <p style={{ fontSize: 12, lineHeight: 1.7, color: c.muted, margin: '0 0 14px' }}>
            {this.state.hadData
              ? '你的习惯和打卡记录还在本机，没有被删除。先试着重新加载；如果还是这样，可以导出数据留底，再修复。'
              : '本机暂时没有找到记录。可以先重新加载试试。'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button style={primary} onClick={this.handleReload} disabled={busy !== null}>
              <RefreshCw size={15} />
              重新加载
            </button>

            <button
              style={{ ...secondary, opacity: busy ? 0.6 : 1 }}
              onClick={this.handleExport}
              disabled={busy !== null}
            >
              <Download size={15} />
              {busy === 'export' ? '导出中…' : '导出数据（留一份备份）'}
            </button>

            <button
              style={{ ...secondary, opacity: busy ? 0.6 : 1 }}
              onClick={this.handleRepair}
              disabled={busy !== null}
            >
              <Wrench size={15} />
              {busy === 'repair' ? '修复中…' : '尝试修复数据'}
            </button>
          </div>

          {note && (
            <p style={{ fontSize: 11, lineHeight: 1.6, color: c.fg, margin: '10px 2px 0' }}>{note}</p>
          )}

          <button
            onClick={() => this.setState({ detail: !detail })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              padding: '12px 0 0',
              color: c.muted,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            <ChevronDown
              size={12}
              style={{ transform: detail ? 'rotate(180deg)' : 'none', transition: '200ms' }}
            />
            {detail ? '收起技术细节' : '技术细节'}
            {crashCount > 1 ? `（本机记录 ${crashCount} 次）` : ''}
          </button>

          {detail && (
            <div style={{ marginTop: 8 }}>
              <pre
                style={{
                  margin: 0,
                  padding: 10,
                  borderRadius: 10,
                  background: c.code,
                  color: c.muted,
                  fontSize: 10,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 180,
                  overflowY: 'auto',
                }}
              >
                {String(error.message || error)}
                {info?.componentStack ? `\n${info.componentStack.trim().slice(0, 600)}` : ''}
              </pre>
              <p style={{ fontSize: 10, lineHeight: 1.6, color: c.muted, margin: '8px 2px 0' }}>
                截图这一段发给开发者，能更快定位问题。
              </p>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 14,
              paddingTop: 12,
              borderTop: `1px solid ${c.border}`,
            }}
          >
            <button style={linkBtn} onClick={this.handleHardReload}>
              强制更新（清缓存）
            </button>
            <button
              style={{ ...linkBtn, color: c.danger, display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={this.handleClear}
            >
              <Trash2 size={11} />
              清空数据重来
            </button>
          </div>
        </div>
      </div>
    )
  }
}
