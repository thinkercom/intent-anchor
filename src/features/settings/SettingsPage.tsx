import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, Plus, Trash2, Download, Upload, RotateCcw, Info, Smartphone, Link2, Unlink } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { AppData } from '../../store/types'
import { exportData, downloadJson, parseImport } from '../../lib/exportImport'
import { signOut, unbindWechat } from '../../lib/cloud'
import { isCloudEnabled, isExternal } from '../../lib/cloudConfig'
import { refreshFromCloud } from '../../lib/syncManager'

interface Props {
  onBack: () => void
  // 数据被重置/导入后，延迟回到封面（由 App 提供 setView('cover')）
  onDataApplied: () => void
  onRequestLogin: () => void
  onRequestBind: () => void
  onLogoutDone: () => void
}

type Tab = 'habit' | 'reward' | 'text' | 'data'

export function SettingsPage({ onBack, onDataApplied, onRequestLogin, onRequestBind, onLogoutDone }: Props) {
  const [tab, setTab] = useState<Tab>('habit')
  const store = useAppStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [toast, setToast] = useState('')

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2200)
  }

  // 提交数据后延迟回封面：先让数据变更在当前页完成渲染（不触发 exit），
  // 再切视图，使本页 exit 动画能正常完成并卸载，避免页面残留拦截点击。
  const commitAndReturn = () => {
    window.setTimeout(() => onDataApplied(), 420)
  }

  // ---- 习惯 ----
  const [newHabit, setNewHabit] = useState('')
  const addHabit = () => {
    if (!newHabit.trim()) return
    store.addHabit(newHabit)
    setNewHabit('')
    flash('已添加习惯')
  }

  // ---- 奖励 ----
  const [rewardLabel, setRewardLabel] = useState('')
  const [rewardThreshold, setRewardThreshold] = useState(7)
  const [rewardCategory, setRewardCategory] = useState('小奖励')
  const addReward = () => {
    if (!rewardLabel.trim() || rewardThreshold <= 0) return
    store.addReward({ threshold: rewardThreshold, label: rewardLabel.trim(), category: rewardCategory })
    setRewardLabel('')
    setRewardThreshold(7)
    flash('已添加奖励')
  }

  // ---- 文案 / 意图预设 ----
  const [newPrompt, setNewPrompt] = useState('')
  const [newPreset, setNewPreset] = useState('')

  // ---- 数据 ----
  const handleExport = () => {
    const data: AppData = {
      schemaVersion: store.schemaVersion,
      intent: store.intent,
      intentPresets: store.intentPresets,
      customPrompts: store.customPrompts,
      habits: store.habits,
      checkins: store.checkins,
      rewards: store.rewards,
      telemetry: store.telemetry,
    }
    const fname = `intent-anchor-${new Date().toISOString().slice(0, 10)}.json`
    downloadJson(fname, exportData(data))
    flash('备份已下载')
  }

  const handleImport = async (file: File) => {
    try {
      const text = await file.text()
      const data = parseImport(text)
      store.replaceAllData(data)
      flash('导入成功，数据已覆盖')
      commitAndReturn()
    } catch (e) {
      flash(e instanceof Error ? e.message : '导入失败')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleReset = () => {
    if (window.confirm('确定清空所有数据并恢复默认？此操作不可撤销，建议先导出备份。')) {
      store.resetAll()
      flash('已重置')
      commitAndReturn()
    }
  }

  // ---- 云账号 ----
  const [bindBusy, setBindBusy] = useState(false)
  const handleLogout = async () => {
    const { error } = await signOut()
    if (error) {
      flash(error)
      return
    }
    onLogoutDone()
    flash('已退出登录')
  }
  const handlePullCloud = async () => {
    const { error } = await refreshFromCloud()
    flash(error ? error : '已从云端刷新')
  }
  const handleUnbind = async () => {
    const key = store.authUser?.masterKey
    if (!key) return
    setBindBusy(true)
    const { error } = await unbindWechat(key)
    setBindBusy(false)
    if (error) {
      flash(error)
      return
    }
    // 刷新本地登录态里的 linkedWechat 标记
    const u = store.authUser
    if (u) store.setAuthUser({ ...u, linkedWechat: false })
    flash('微信已解绑')
  }

  const syncLabel: Record<string, string> = {
    idle: '未同步',
    syncing: '同步中…',
    saved: '已同步',
    error: '同步失败',
  }

  const avgEnter = store.telemetry.enterDurations.length
    ? Math.round(store.telemetry.enterDurations.reduce((a, b) => a + b, 0) / store.telemetry.enterDurations.length)
    : 0

  return (
    <motion.main
      className="absolute inset-0 z-30 flex flex-col"
      style={{ background: 'var(--bg)' }}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.35 }}
    >
      {/* 顶栏 */}
      <div className="flex items-center px-2 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <motion.button onClick={onBack} className="rounded-full p-2" style={{ color: 'var(--fg-muted)' }} whileTap={{ scale: 0.92 }} aria-label="返回">
          <ArrowLeft size={20} />
        </motion.button>
        <span className="flex-1 text-center text-sm tracking-[0.2em]" style={{ color: 'var(--fg)' }}>设置</span>
        <span className="w-8" />
      </div>

      {/* Tab */}
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto px-5">
        {([
          ['habit', '习惯'],
          ['reward', '奖励'],
          ['text', '文案'],
          ['data', '数据'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="shrink-0 rounded-full px-4 py-1.5 text-sm"
            style={{
              background: tab === key ? 'var(--accent)' : 'var(--glass)',
              color: tab === key ? 'var(--bg)' : 'var(--fg)',
              border: '1px solid var(--card-border)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 内容 */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-[max(3rem,env(safe-area-inset-bottom))]">
        {tab === 'habit' && (
          <div className="flex flex-col gap-2.5">
            <SectionTitle>当前习惯（{store.habits.filter((h) => !h.archived).length}）</SectionTitle>
            {store.habits.filter((h) => !h.archived).map((h) => (
              <Row key={h.id}>
                <span className="flex-1 text-sm" style={{ color: 'var(--fg)' }}>{h.name}</span>
                <IconBtn onClick={() => store.removeHabit(h.id)} color="var(--fg-muted)" label="删除"><Trash2 size={16} /></IconBtn>
              </Row>
            ))}
            <div className="mt-3 flex gap-2">
              <TextInput value={newHabit} onChange={setNewHabit} onEnter={addHabit} placeholder="新习惯名称…" />
              <PrimaryBtn onClick={addHabit}><Plus size={16} />添加</PrimaryBtn>
            </div>
            <Hint>第一版建议 5 个以内。删除为软删除，不影响历史连续天数。</Hint>
          </div>
        )}

        {tab === 'reward' && (
          <div className="flex flex-col gap-2.5">
            <SectionTitle>奖励里程碑</SectionTitle>
            {[...store.rewards].sort((a, b) => a.threshold - b.threshold).map((r) => (
              <Row key={r.id}>
                <div className="flex-1">
                  <div className="text-sm" style={{ color: r.claimed ? 'var(--fg-muted)' : 'var(--fg)', textDecoration: r.claimed ? 'line-through' : 'none' }}>
                    {r.label}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>
                    连续 {r.threshold} 天 · {r.category}{r.claimed ? ' · 已兑现' : ''}
                  </div>
                </div>
                <IconBtn onClick={() => store.removeReward(r.id)} color="var(--fg-muted)" label="删除"><Trash2 size={16} /></IconBtn>
              </Row>
            ))}
            <div className="mt-3 rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <TextInput value={rewardLabel} onChange={setRewardLabel} placeholder="奖励名称，如：一杯手冲" />
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={rewardThreshold}
                  onChange={(e) => setRewardThreshold(Math.max(1, Number(e.target.value)))}
                  className="w-20 rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--glass)', border: '1px solid var(--card-border)', color: 'var(--fg)' }}
                />
                <select
                  value={rewardCategory}
                  onChange={(e) => setRewardCategory(e.target.value)}
                  className="rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--glass)', border: '1px solid var(--card-border)', color: 'var(--fg)' }}
                >
                  <option>小奖励</option><option>中奖励</option><option>大奖励</option>
                </select>
                <PrimaryBtn onClick={addReward}><Plus size={16} /></PrimaryBtn>
              </div>
              <div className="mt-1 text-[11px]" style={{ color: 'var(--fg-muted)' }}>天数阈值 · 类别</div>
            </div>
          </div>
        )}

        {tab === 'text' && (
          <div className="flex flex-col gap-2.5">
            <SectionTitle>常用意图</SectionTitle>
            {store.intentPresets.map((p) => (
              <Row key={p}>
                <span className="flex-1 text-sm" style={{ color: 'var(--fg)' }}>{p}</span>
                <IconBtn onClick={() => store.removeIntentPreset(p)} color="var(--fg-muted)" label="删除"><Trash2 size={16} /></IconBtn>
              </Row>
            ))}
            <div className="flex gap-2">
              <TextInput value={newPreset} onChange={setNewPreset} onEnter={() => { if (newPreset.trim()) { store.addIntentPreset(newPreset); setNewPreset('') } }} placeholder="新常用意图…" />
              <PrimaryBtn onClick={() => { if (newPreset.trim()) { store.addIntentPreset(newPreset); setNewPreset('') } }}><Plus size={16} /></PrimaryBtn>
            </div>

            <div className="mb-2 mt-6"><SectionTitle>封面第二行补充文案</SectionTitle></div>
            {store.customPrompts.map((p) => (
              <Row key={p}>
                <span className="flex-1 text-sm" style={{ color: 'var(--fg)' }}>{p}</span>
                <IconBtn onClick={() => store.removeCustomPrompt(p)} color="var(--fg-muted)" label="删除"><Trash2 size={16} /></IconBtn>
              </Row>
            ))}
            <div className="flex gap-2">
              <TextInput value={newPrompt} onChange={setNewPrompt} onEnter={() => { if (newPrompt.trim()) { store.addCustomPrompt(newPrompt); setNewPrompt('') } }} placeholder="自定义提问句…" />
              <PrimaryBtn onClick={() => { if (newPrompt.trim()) { store.addCustomPrompt(newPrompt); setNewPrompt('') } }}><Plus size={16} /></PrimaryBtn>
            </div>
            <Hint>补充的文案会加入每天的轮换池。默认 5 句始终保留。</Hint>
          </div>
        )}

        {tab === 'data' && (
          <div className="flex flex-col gap-3">
            <SectionTitle>账户与同步</SectionTitle>
            {!isCloudEnabled ? (
              <div className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                  当前部署为静态游客版，数据仅保存在本机浏览器。云登录、跨设备同步将在数据库和短信服务接入后开放。
                </p>
              </div>
            ) : (
            <div className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              {store.authUser ? (
                <>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--fg)' }}>
                      <Smartphone size={14} />
                      {store.authUser.phone || store.authUser.name || '手机号账户'}
                    </span>
                    <span className="text-[11px]" style={{ color: store.syncStatus === 'error' ? 'var(--fg-danger, #e08a8a)' : 'var(--fg-muted)' }}>
                      {syncLabel[store.syncStatus]}
                    </span>
                  </div>
                  <p className="mb-3 text-[11px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                    手机号是主账户。数据自动同步，换设备用手机号登录即可取回。
                  </p>

                  {/* 微信挂载状态：WorkBuddy 云版本支持；EdgeOne 自建版阶段 D 才接微信，先隐藏 */}
                  {!isExternal && (
                    <div className="mb-3 flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: 'var(--glass)', border: '1px solid var(--card-border)' }}>
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--fg)' }}>
                        <Link2 size={13} />微信快捷登录
                        <span className="text-[10px]" style={{ color: store.authUser.linkedWechat ? '#7fbf8f' : 'var(--fg-muted)' }}>
                          {store.authUser.linkedWechat ? '已挂载' : '未挂载'}
                        </span>
                      </span>
                      {store.authUser.linkedWechat ? (
                        <button onClick={handleUnbind} disabled={bindBusy} className="flex items-center gap-1 text-[11px] disabled:opacity-60" style={{ color: 'var(--fg-muted)' }}>
                          <Unlink size={12} />解绑
                        </button>
                      ) : (
                        <button onClick={onRequestBind} className="text-[11px]" style={{ color: 'var(--accent)' }}>
                          去挂载
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={handlePullCloud} className="flex-1 rounded-xl py-2 text-xs" style={{ background: 'var(--glass)', border: '1px solid var(--card-border)', color: 'var(--fg)' }}>
                      从云端刷新
                    </button>
                    <button onClick={handleLogout} className="flex-1 rounded-xl py-2 text-xs" style={{ background: 'var(--glass)', border: '1px solid var(--card-border)', color: 'var(--fg-muted)' }}>
                      退出登录
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-3 text-xs leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                    手机号是你的主账户，验证码登录，无需密码。登录后跨设备同步，不丢失现有数据。
                  </p>
                  <button
                    onClick={onRequestLogin}
                    className="mb-2 w-full rounded-xl py-2.5 text-sm"
                    style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                  >
                    手机号登录 / 注册
                  </button>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                    登录后可在账户里挂载微信作为快捷入口，之后用微信即可一键直达。
                  </p>
                </>
              )}
              {store.syncStatus === 'error' && store.syncError && (
                <p className="mt-2 text-[11px]" style={{ color: 'var(--fg-danger, #e08a8a)' }}>{store.syncError}</p>
              )}
            </div>
            )}

            <SectionTitle>数据备份</SectionTitle>
            <div className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <p className="mb-3 text-xs leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                登录后会云端同步；游客模式下清除浏览器数据会丢失记录，可定期导出 JSON 备份。
              </p>
              <div className="flex gap-2">
                <PrimaryBtn onClick={handleExport}><Download size={16} />导出备份</PrimaryBtn>
                <button onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm" style={{ background: 'var(--glass)', border: '1px solid var(--card-border)', color: 'var(--fg)' }}>
                  <Upload size={16} />导入备份
                </button>
                <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
              </div>
            </div>

            <SectionTitle>使用统计</SectionTitle>
            <div className="grid grid-cols-2 gap-2.5">
              <Stat label="累计打开" value={`${store.telemetry.openCount} 次`} />
              <Stat label="打卡动作" value={`${store.telemetry.checkinActions} 次`} />
              <Stat label="平均进入耗时" value={avgEnter ? `${(avgEnter / 1000).toFixed(1)} 秒` : '—'} />
              <Stat label="已领奖励" value={`${store.rewards.filter((r) => r.claimed).length} 个`} />
            </div>

            <SectionTitle>危险操作</SectionTitle>
            <button onClick={handleReset} className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm" style={{ background: 'var(--glass)', border: '1px solid var(--card-border)', color: 'var(--fg-muted)' }}>
              <RotateCcw size={16} />重置所有数据
            </button>

            <div className="mt-2 flex items-start gap-2 rounded-2xl p-4 text-[11px] leading-relaxed" style={{ background: 'var(--card-bg)', color: 'var(--fg-muted)' }}>
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>Intent Anchor · v0.1.0 · 数据仅保存在本机浏览器。导入为覆盖式，会替换当前全部数据。</span>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <motion.div
          className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm"
          style={{ background: 'var(--fg)', color: 'var(--bg)' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {toast}
        </motion.div>
      )}
    </motion.main>
  )
}

// ---- 小组件 ----
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[11px] tracking-[0.15em]" style={{ color: 'var(--fg-muted)' }}>{children}</div>
}
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl px-4 py-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      {children}
    </div>
  )
}
function IconBtn({ onClick, children, color, label }: { onClick: () => void; children: React.ReactNode; color: string; label: string }) {
  return <motion.button onClick={onClick} whileTap={{ scale: 0.9 }} style={{ color }} aria-label={label}>{children}</motion.button>
}
function TextInput({ value, onChange, onEnter, placeholder }: { value: string; onChange: (v: string) => void; onEnter?: () => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      placeholder={placeholder}
      className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
      style={{ background: 'var(--glass)', border: '1px solid var(--card-border)', color: 'var(--fg)' }}
    />
  )
}
function PrimaryBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button onClick={onClick} whileTap={{ scale: 0.96 }} className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
      {children}
    </motion.button>
  )
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <div className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>{label}</div>
      <div className="mt-1 text-lg" style={{ color: 'var(--fg)' }}>{value}</div>
    </div>
  )
}
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 px-1 text-[11px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{children}</p>
}
