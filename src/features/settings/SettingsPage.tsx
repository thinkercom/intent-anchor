import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  Info,
  Smartphone,
  Mail,
  Link2,
  Unlink,
  ShieldAlert,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAppStore } from '../../store/useAppStore'
import { exportData, parseImport, saveBackupFile, backupFilename } from '../../lib/exportImport'
import {
  useBackupStatus,
  summarizeData,
  markExported,
  markImported,
  resetBackupMeta,
} from '../../lib/backup'
import type { BackupStatus } from '../../lib/backup'
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
  const backup = useBackupStatus()
  const [exporting, setExporting] = useState(false)

  // iOS 上「添加到主屏幕」后数据更稳：Safari 标签页长期不访问可能被系统清理。
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  const showHomeTip = isIOS && !isStandalone

  const toastTimer = useRef<number | null>(null)
  const flash = (msg: string, ms = 2400) => {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), ms)
  }

  // 提交数据后延迟回封面：先让数据变更在当前页完成渲染（不触发 exit），
  // 再切视图，使本页 exit 动画能正常完成并卸载，避免页面残留拦截点击。
  const commitAndReturn = (delay = 420) => {
    window.setTimeout(() => onDataApplied(), delay)
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
  const handleExport = async () => {
    if (exporting) return
    // 用 store 的统一快照，而不是在这里手写一遍字段：
    // 之前每加一个数据字段（收尾记录就是），这里就要跟着改，漏一个就导出缺一块。
    const data = store.getDataSnapshot()
    const count = summarizeData(data).checkinCount
    setExporting(true)
    try {
      const result = await saveBackupFile(backupFilename(), exportData(data))
      if (result === 'cancelled') return
      markExported(data, count)
      flash(
        result === 'shared'
          ? '备份已保存'
          : isIOS
            ? '已下载，在「文件」App 的下载里'
            : '备份已下载',
        3200,
      )
    } catch (e) {
      flash(e instanceof Error ? e.message : '导出失败', 3600)
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (file: File) => {
    try {
      const text = await file.text()
      const bundle = parseImport(text)
      const when = bundle.exportedAt ? format(parseISO(bundle.exportedAt), 'M 月 d 日 HH:mm') : ''
      const size = summarizeData(bundle.data)
      const ok = window.confirm(
        `即将用这份备份${when ? `（${when} 导出）` : ''}覆盖当前所有记录。\n\n` +
          `备份内容：${size.habitCount} 个习惯 · ${size.dayCount} 天记录 · ${size.checkinCount} 条打卡\n\n` +
          `当前数据会被替换且不可撤销，建议先导出一次现在的数据。确定继续吗？`,
      )
      if (!ok) return
      store.replaceAllData(bundle.data)
      markImported(bundle.data, size.checkinCount)
      flash('导入成功，数据已恢复', 2600)
      commitAndReturn(2400)
    } catch (e) {
      flash(e instanceof Error ? e.message : '导入失败', 3600)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleReset = () => {
    if (
      window.confirm(
        '确定清空所有数据并恢复默认？此操作不可撤销，建议先导出备份。' +
          (backup.summary.checkinCount > 0 ? `\n\n当前有 ${backup.summary.checkinCount} 条打卡记录会被删除。` : ''),
      )
    ) {
      store.resetAll()
      resetBackupMeta()
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

      {/* 备份提醒：任意 tab 下都能看到，点击直接跳到数据页 */}
      {backup.needsAttention && (
        <motion.button
          onClick={() => setTab('data')}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          className="mx-5 mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px]"
          style={{
            background: 'var(--warn-bg)',
            /* 提醒条也是玻璃：一道顶部微光 + 内高光，不然它是一块死板的色块 */
            backgroundImage: 'linear-gradient(180deg, var(--warn-sheen), transparent 62%)',
            border: '1px solid var(--warn-border)',
            boxShadow: 'inset 0 1px 0 var(--warn-sheen)',
            color: 'var(--warn-fg)',
          }}
        >
          <ShieldAlert size={13} className="shrink-0" />
          <span className="flex-1 leading-snug">{attentionText(backup)}，建议现在导出一份</span>
          <span className="shrink-0 opacity-80">去备份 ›</span>
        </motion.button>
      )}

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
            <Hint>第一版建议 5 个以内。删除后不再要求打卡，但历史仍按它当时存在计算；顺序在习惯页长按拖动调整。</Hint>
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
            <div className="surface mt-3 rounded-2xl p-4">
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
            {/* 备份卡放在最前：这是数据安全最要紧的一件事 */}
            <SectionTitle>数据备份</SectionTitle>
            <div
              className="surface rounded-2xl p-4"
              style={backup.needsAttention ? { borderColor: 'var(--warn-border)' } : undefined}
            >
              <div className="mb-1 flex items-center gap-2">
                {backup.needsAttention ? (
                  <ShieldAlert size={15} style={{ color: 'var(--warn-fg)' }} className="shrink-0" />
                ) : (
                  <ShieldCheck size={15} style={{ color: 'var(--accent)' }} className="shrink-0" />
                )}
                <span
                  className="flex-1 text-sm"
                  style={{ color: backup.needsAttention ? 'var(--warn-fg)' : 'var(--fg)' }}
                >
                  {backupTitle(backup)}
                </span>
                {backup.exportCount > 0 && (
                  <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>
                    已备份 {backup.exportCount} 次
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                {backupDesc(backup, isCloudEnabled)}
              </p>

              <div
                className="my-3 grid grid-cols-3 gap-2 rounded-xl px-3 py-2.5"
                style={{ background: 'var(--glass)', border: '1px solid var(--card-border)' }}
              >
                <MiniStat label="习惯" value={`${backup.summary.habitCount}`} />
                <MiniStat label="记录天数" value={`${backup.summary.dayCount}`} />
                <MiniStat label="打卡" value={`${backup.summary.checkinCount}`} />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-70"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                >
                  {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  {exporting ? '导出中…' : '导出备份'}
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm"
                  style={{ background: 'var(--glass)', border: '1px solid var(--card-border)', color: 'var(--fg)' }}
                >
                  <Upload size={16} />导入备份
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
                />
              </div>

              <p className="mt-2.5 flex items-start gap-1.5 text-[10px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                <Info size={11} className="mt-0.5 shrink-0" />
                <span>
                  {isIOS
                    ? '导出会弹出系统分享面板：选「存储到文件」可存进 iCloud 或“我的 iPhone”，也可以直接发到微信收藏。'
                    : '备份是一个 JSON 文件，存到网盘、邮箱或微信收藏都行。导入会覆盖当前全部记录。'}
                </span>
              </p>
            </div>

            {!isCloudEnabled ? (
              <>
                <SectionTitle>数据存储</SectionTitle>
                <div className="surface rounded-2xl p-4">
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                    数据只保存在这台设备上，不用登录。两个人各用自己手机打开同一个链接，记录彼此独立、互不影响。
                  </p>
                </div>
                {showHomeTip && (
                  <div className="rounded-2xl p-3.5" style={{ background: 'var(--glass)', border: '1px solid var(--card-border)' }}>
                    <p className="flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                      <Info size={13} className="mt-0.5 shrink-0" />
                      <span>
                        建议先「添加到主屏幕」：点 Safari 底部的分享按钮 → 添加到主屏幕，以后从桌面图标打开。
                        长期不打开的 Safari 网页，系统可能会清理它的数据。
                      </span>
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
            <SectionTitle>账户与同步</SectionTitle>
            <div className="surface rounded-2xl p-4">
              {store.authUser ? (
                <>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--fg)' }}>
                      {isExternal ? <Mail size={14} /> : <Smartphone size={14} />}
                      {store.authUser.email || store.authUser.phone || store.authUser.name || (isExternal ? '邮箱账户' : '手机号账户')}
                    </span>
                    <span className="text-[11px]" style={{ color: store.syncStatus === 'error' ? 'var(--fg-danger, #e08a8a)' : 'var(--fg-muted)' }}>
                      {syncLabel[store.syncStatus]}
                    </span>
                  </div>
                  <p className="mb-3 text-[11px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                    {isExternal
                      ? '邮箱是主账户。数据自动同步，换设备用邮箱登录即可取回。'
                      : '手机号是主账户。数据自动同步，换设备用手机号登录即可取回。'}
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
                    {isExternal
                      ? '邮箱是你的主账户，验证码登录，无需密码。登录后跨设备同步，不丢失现有数据。'
                      : '手机号是你的主账户，验证码登录，无需密码。登录后跨设备同步，不丢失现有数据。'}
                  </p>
                  <button
                    onClick={onRequestLogin}
                    className="mb-2 w-full rounded-xl py-2.5 text-sm"
                    style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                  >
                    {isExternal ? '邮箱登录 / 注册' : '手机号登录 / 注册'}
                  </button>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                    {isExternal
                      ? '验证码会发送到你的邮箱，5 分钟内有效。'
                      : '登录后可在账户里挂载微信作为快捷入口，之后用微信即可一键直达。'}
                  </p>
                </>
              )}
              {store.syncStatus === 'error' && store.syncError && (
                <p className="mt-2 text-[11px]" style={{ color: 'var(--fg-danger, #e08a8a)' }}>{store.syncError}</p>
              )}
            </div>
              </>
            )}

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

            <div className="mt-2 flex items-start gap-2 rounded-2xl p-4 text-[11px] leading-relaxed" style={{ background: 'var(--glass)', border: '1px solid var(--card-border)', color: 'var(--fg-muted)' }}>
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

// ---- 备份文案 ----

function fmtBackupTime(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = parseISO(iso)
    if (Number.isNaN(d.getTime())) return ''
    return format(d, 'M 月 d 日 HH:mm')
  } catch {
    return ''
  }
}

function backupTitle(status: BackupStatus): string {
  if (status.level === 'empty') return '还没有记录'
  if (!status.lastExportAt) return '还没有备份过'
  if (status.needsAttention) return `${status.daysSince} 天没备份了`
  return '数据已备份'
}

function backupDesc(status: BackupStatus, cloud: boolean): string {
  if (status.level === 'empty') return '开始打卡之后，这里会提醒你什么时候该备份。'
  if (!status.lastExportAt) {
    return (
      (cloud ? '未登录时数据只在这台设备上，' : '数据只在这台设备上。') +
      '清除浏览器数据、删除桌面图标或换手机会全部丢失，建议现在导出第一份。'
    )
  }
  if (status.needsAttention) {
    return status.unbackedCheckins > 0
      ? `上次备份是 ${fmtBackupTime(status.lastExportAt)}，之后新增了 ${status.unbackedCheckins} 条打卡记录。`
      : `上次备份是 ${fmtBackupTime(status.lastExportAt)}，之后有改动还没备份。`
  }
  if (!status.hasChanges) {
    return `${fmtBackupTime(status.lastExportAt)} 备份，数据已是最新。`
  }
  return status.unbackedCheckins > 0
    ? `${fmtBackupTime(status.lastExportAt)} 备份，之后另有 ${status.unbackedCheckins} 条新记录，攒几天再导出一份就行。`
    : `${fmtBackupTime(status.lastExportAt)} 备份，之后有改动（意图、习惯或奖励），攒几天再导出一份就行。`
}

function attentionText(status: BackupStatus): string {
  if (!status.lastExportAt) return `已经连续记录 ${status.summary.dayCount} 天，还没备份过`
  return `已经 ${status.daysSince} 天没备份`
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-sm" style={{ color: 'var(--fg)' }}>{value}</div>
      <div className="mt-0.5 text-[10px]" style={{ color: 'var(--fg-muted)' }}>{label}</div>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface flex items-center gap-2 rounded-2xl px-4 py-3">
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
      className="field min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
    />
  )
}
function PrimaryBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button onClick={onClick} whileTap={{ scale: 0.96 }} className="btn-solid flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
      {children}
    </motion.button>
  )
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-sunken rounded-2xl px-4 py-3">
      <div className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>{label}</div>
      <div className="mt-1 text-lg" style={{ color: 'var(--fg)' }}>{value}</div>
    </div>
  )
}
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 px-1 text-[11px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{children}</p>
}
