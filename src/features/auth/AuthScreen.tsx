import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { X } from 'lucide-react'
import {
  sendPhoneCode,
  signInWithPhone,
  sendEmailCode,
  signInWithEmail,
  signInWithWechat,
  isValidPhone,
  isValidEmail,
  getPendingWechatBind,
} from '../../lib/cloud'
import type { AuthUser } from '../../store/useAppStore'
import { isExternal } from '../../lib/cloudConfig'

interface Props {
  mode: 'login' | 'bind'
  onClose: () => void
  onGuest: () => void
  onSignedIn: (user: AuthUser, justBound: boolean) => void
}

/** 登录 / 绑定界面：external 版用邮箱验证码；WorkBuddy 现网用手机号，微信为挂载入口 */
export function AuthScreen({ mode, onClose, onGuest, onSignedIn }: Props) {
  const [account, setAccount] = useState('')   // 邮箱（external）或手机号（WorkBuddy）
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [accountError, setAccountError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  const isBind = mode === 'bind' || !!getPendingWechatBind()
  const accountLabel = isExternal ? '邮箱' : '手机号'
  const codePlaceholder = isExternal ? '邮箱验证码' : '短信验证码'
  const accountPlaceholder = isExternal ? 'you@example.com' : '11 位手机号'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSendCode = async () => {
    const value = account.trim()
    const valid = isExternal ? isValidEmail(value) : isValidPhone(value)
    if (!valid) {
      setAccountError(isExternal ? '请输入正确的邮箱地址' : '请输入正确的 11 位手机号')
      return
    }
    setAccountError('')
    setBusy(true)
    setError('')
    const { error: err } = isExternal ? await sendEmailCode(value) : await sendPhoneCode(value)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setCodeSent(true)
    setCooldown(60)
    const timer = window.setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          window.clearInterval(timer)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  const handleVerify = async () => {
    setBusy(true)
    setError('')
    const { user, error: err, justBound } = isExternal
      ? await signInWithEmail(code)
      : await signInWithPhone(code)
    setBusy(false)
    if (err || !user) {
      setError(err || '验证失败，请重试')
      return
    }
    onSignedIn(user, !!justBound)
  }

  const handleWechat = async () => {
    setBusy(true)
    setError('')
    const { error: err } = await signInWithWechat()
    if (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <motion.main
      role="dialog"
      aria-modal="true"
      aria-label={isBind ? '确认绑定' : isExternal ? '邮箱登录' : '手机号登录'}
      // 关键：整层必须是完全不透明的背景，且固定覆盖整个视口。
      // 任何半透明都会让底层设置页文字透出来，造成「两个页面叠在一起」。
      className="fixed inset-0 z-[100] isolate overflow-y-auto"
      style={{
        background: 'var(--modal-bg)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.button
        type="button"
        onClick={onClose}
        aria-label="关闭登录面板"
        className="absolute right-3 z-10 rounded-full p-2"
        style={{ top: 'max(0.75rem, env(safe-area-inset-top))', color: 'var(--fg-muted)' }}
        whileTap={{ scale: 0.9 }}
      >
        <X size={20} />
      </motion.button>

      {/* min-h-full + items-center：内容可滚动且不会被键盘/小屏裁掉顶部 */}
      <div
        className="flex min-h-full items-center justify-center px-5"
        style={{
          paddingTop: 'max(3.5rem, calc(env(safe-area-inset-top) + 2.5rem))',
          paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1.5rem))',
        }}
      >
        <div
          className="w-full max-w-xs rounded-3xl p-6"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <p
            className="mb-2 text-center text-2xl"
            style={{ fontFamily: 'var(--headline-font)', color: 'var(--fg)' }}
          >
            {isBind ? '确认绑定' : '保存你的坚持'}
          </p>
          <p className="mb-8 text-center text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
            {isBind
              ? `输入${accountLabel}验证码，完成微信与账户的绑定。`
              : isExternal
                ? '邮箱是你的主账户，登录后跨设备同步，无需密码。'
                : '手机号是你的主账户，登录后跨设备同步。微信可作为快捷入口挂载。'}
          </p>

          {/* 账户输入：邮箱（external）或手机号（WorkBuddy） */}
          <label className="mb-1 block text-xs" style={{ color: 'var(--fg-muted)' }}>
            {accountLabel}
          </label>
          <input
            type={isExternal ? 'email' : 'tel'}
            inputMode={isExternal ? 'email' : 'numeric'}
            autoComplete={isExternal ? 'email' : 'tel'}
            value={account}
            disabled={codeSent || busy}
            onChange={(e) => {
              setAccount(isExternal ? e.target.value.slice(0, 254) : e.target.value.replace(/\D/g, '').slice(0, 11))
              setAccountError('')
            }}
            placeholder={accountPlaceholder}
            className="mb-1 w-full rounded-xl px-4 py-3 text-sm"
            style={{ background: 'var(--glass)', border: '1px solid var(--card-border)', color: 'var(--fg)' }}
          />
          {accountError && <p className="mb-2 text-[11px]" style={{ color: 'var(--fg-danger)' }}>{accountError}</p>}

          {!codeSent ? (
            <button
              type="button"
              onClick={handleSendCode}
              disabled={busy}
              className="mb-5 w-full rounded-full py-3 text-sm font-medium transition-opacity disabled:opacity-60"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              {busy ? '发送中…' : '获取验证码'}
            </button>
          ) : (
            <>
              <label className="mb-1 block text-xs" style={{ color: 'var(--fg-muted)' }}>
                验证码
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder={codePlaceholder}
                className="mb-2 w-full rounded-xl px-4 py-3 text-sm tracking-widest"
                style={{ background: 'var(--glass)', border: '1px solid var(--card-border)', color: 'var(--fg)' }}
              />
              <button
                type="button"
                onClick={handleVerify}
                disabled={busy || !code}
                className="mb-2 w-full rounded-full py-3 text-sm font-medium transition-opacity disabled:opacity-60"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                {busy ? '验证中…' : isBind ? '验证并绑定' : '登录 / 注册'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCodeSent(false)
                  setCode('')
                  setError('')
                }}
                className="mb-4 w-full py-1 text-xs"
                style={{ color: 'var(--fg-muted)' }}
              >
                更换{accountLabel}{cooldown > 0 ? `（${cooldown}s 后可重发）` : ''}
              </button>
            </>
          )}

          {!isBind && !isExternal && (
            <>
              <div className="my-4 flex items-center gap-3" style={{ color: 'var(--fg-muted)' }}>
                <div className="h-px flex-1" style={{ background: 'var(--card-border)' }} />
                <span className="text-[11px]">或</span>
                <div className="h-px flex-1" style={{ background: 'var(--card-border)' }} />
              </div>
              <motion.button
                type="button"
                onClick={handleWechat}
                disabled={busy}
                className="mb-2 w-full rounded-full py-3 text-sm font-medium transition-opacity disabled:opacity-60"
                style={{
                  color: 'var(--fg)',
                  background: 'var(--glass)',
                  border: '1px solid var(--card-border)',
                }}
                whileTap={{ scale: 0.98 }}
              >
                微信快捷登录
              </motion.button>
            </>
          )}

          <button onClick={onGuest} className="w-full py-2 text-xs" style={{ color: 'var(--fg-muted)' }}>
            以游客身份继续
          </button>

          {error && (
            <p className="mt-4 text-center text-xs" style={{ color: 'var(--fg-danger)' }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </motion.main>
  )
}
