import { useEffect, useRef, useState } from 'react'
import { Reorder, motion, useDragControls } from 'motion/react'
import { Check } from 'lucide-react'
import type { Habit } from '../../store/types'
import { lockScrollForDrag, unlockScrollForDrag } from '../../lib/dragGuard'

/** 长按多久进入拖拽（太短会和滑动冲突，太长会觉得没反应） */
const LONG_PRESS_MS = 320
/** 手指移动超过这个距离就判定为「想滚动页面」而不是长按 */
const MOVE_TOLERANCE = 10

interface Props {
  habit: Habit
  checked: boolean
  onToggle: () => void
  index: number
}

export function HabitItem({ habit, checked, onToggle, index }: Props) {
  const controls = useDragControls()
  const [dragging, setDragging] = useState(false)
  const [arming, setArming] = useState(false)

  const timerRef = useRef<number | null>(null)
  const releaseTimerRef = useRef<number | null>(null)
  const startPointRef = useRef<{ x: number; y: number } | null>(null)
  const lastEventRef = useRef<PointerEvent | null>(null)
  const downEventRef = useRef<PointerEvent | null>(null)
  /** 长按已触发：接踵而来的 click 必须吞掉，否则「长按」会顺手打个卡 */
  const armedRef = useRef(false)
  /** 当前是否持有滚动锁，卸载时要还回去 */
  const lockRef = useRef(false)

  /** 滚动锁必须幂等：pointerup / onDragEnd / 卸载都可能触发 */
  const releaseLock = () => {
    if (!lockRef.current) return
    lockRef.current = false
    unlockScrollForDrag()
  }

  const acquireLock = () => {
    if (lockRef.current) return
    lockRef.current = true
    lockScrollForDrag()
  }

  const clearPressTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setArming(false)
  }

  const detachWindowListeners = () => {
    window.removeEventListener('pointermove', handleWindowMove)
    window.removeEventListener('pointerup', handleWindowUp)
    window.removeEventListener('pointercancel', handleWindowUp)
  }

  const handleWindowMove = (event: PointerEvent) => {
    lastEventRef.current = event
    const start = startPointRef.current
    if (!start || armedRef.current) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE) {
      // 明确是在滑动页面：放弃长按
      clearPressTimer()
      detachWindowListeners()
    }
  }

  const handleWindowUp = () => {
    const wasArmed = armedRef.current
    clearPressTimer()
    detachWindowListeners()
    releaseLock()
    if (wasArmed) {
      // 长按后松手（没移动）：后面的 click 要吞掉，短暂后解除
      window.setTimeout(() => {
        armedRef.current = false
      }, 260)
    }
  }

  /** 滚动锁必须幂等：pointerup / onDragEnd / 卸载都可能触发 */
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const native = event.nativeEvent
    startPointRef.current = { x: native.clientX, y: native.clientY }
    lastEventRef.current = native
    downEventRef.current = native
    setArming(true)

    detachWindowListeners()
    window.addEventListener('pointermove', handleWindowMove, { passive: true })
    window.addEventListener('pointerup', handleWindowUp)
    window.addEventListener('pointercancel', handleWindowUp)

    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setArming(false)
      armedRef.current = true
      // 轻震动反馈（iOS 不支持，Android 有效；不支持就算了，不影响功能）
      navigator.vibrate?.(12)
      /**
       * 关键顺序：先锁滚动再 start。
       * 手指已经按了 320ms，浏览器还没开始滚动；此时挂上非被动 touchmove 拦截，
       * 后续移动才会被判成拖拽而不是「页面滚动 + pointercancel」。
       * 如果等 onDragStart 再锁，第一下 pointermove 已经被浏览器抢走，拖不起来。
       */
      acquireLock()
      // 用最后已知的指针位置开始拖动，避免松手时「跳一下」
      controls.start(lastEventRef.current ?? downEventRef.current!)
    }, LONG_PRESS_MS)
  }

  const handleClick = () => {
    if (armedRef.current) {
      armedRef.current = false
      return
    }
    onToggle()
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (releaseTimerRef.current) window.clearTimeout(releaseTimerRef.current)
      window.removeEventListener('pointermove', handleWindowMove)
      window.removeEventListener('pointerup', handleWindowUp)
      window.removeEventListener('pointercancel', handleWindowUp)
      // 拖拽中途被卸载（比如切换页面）时，务必把滚动锁还回去，否则整页永久滚不动
      releaseLock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Reorder.Item
      as="div"
      value={habit}
      dragListener={false}
      dragControls={controls}
      onPointerDown={handlePointerDown}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => {
        setDragging(false)
        releaseLock()
        if (releaseTimerRef.current) window.clearTimeout(releaseTimerRef.current)
        releaseTimerRef.current = window.setTimeout(() => {
          armedRef.current = false
        }, 260)
      }}
      className="relative rounded-2xl"
      style={{
        touchAction: 'pan-y',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        zIndex: dragging ? 30 : undefined,
      }}
      animate={{ scale: dragging ? 1.02 : arming ? 0.985 : 1 }}
      transition={{ duration: 0.18 }}
    >
      {/* 入场动画放在内层，避免和外层拖拽用的 y 变换打架 */}
      {/* 未完成 = 浮起来的玻璃；已完成 = 沉下去、没有影子。
          一整列卡片高度一致、影子一致，就是「同一个模具压出来的」。 */}
      <motion.button
        onClick={handleClick}
        className={`flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left ${
          dragging ? '' : checked ? 'surface-sunken' : 'surface-quiet'
        }`}
        style={
          dragging
            ? {
                background: 'var(--card-bg-drag)',
                border: '1px solid var(--accent)',
                boxShadow: 'var(--drag-shadow)',
              }
            : undefined
        }
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06, duration: 0.4 }}
        aria-label={checked ? `${habit.name}，已完成，轻触取消` : `${habit.name}，轻触打卡`}
      >
        {/* 勾选框：细圈 + 极淡填充，比实心灰饼干净；已勾选时是凸起的实心片 */}
        <motion.span
          className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{
            border: `1px solid ${checked ? 'var(--accent)' : 'var(--circle-ring)'}`,
            background: checked ? 'var(--accent)' : 'var(--circle-fill)',
            boxShadow: checked ? 'var(--circle-light)' : 'inset 0 1px 1px rgba(0,0,0,0.04)',
          }}
          animate={checked ? { scale: [1, 1.18, 1] } : { scale: 1 }}
          transition={{ duration: 0.35 }}
        >
          {checked && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              style={{ color: 'var(--bg)' }}
            >
              <Check size={13} strokeWidth={3} />
            </motion.span>
          )}
        </motion.span>

        {/* 名称 */}
        <span
          className="flex-1 text-[15px] transition-colors"
          style={{
            color: checked ? 'var(--fg-muted)' : 'var(--fg)',
            textDecoration: checked ? 'line-through' : 'none',
            textDecorationColor: 'var(--fg-muted)',
          }}
        >
          {habit.name}
        </span>

        {/* 拖动把手：不影响点击，只是给一个「这里能拖」的暗示 */}
        <span
          className="flex select-none flex-col items-center justify-center gap-[3px] px-0.5"
          aria-hidden="true"
          style={{ opacity: dragging ? 0.9 : 0.35 }}
        >
          <span className="h-[2px] w-3 rounded-full" style={{ background: 'var(--fg-muted)' }} />
          <span className="h-[2px] w-3 rounded-full" style={{ background: 'var(--fg-muted)' }} />
        </span>

        {/* 完成标记的光点 */}
        {checked && (
          <motion.span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--accent)' }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          />
        )}
      </motion.button>
    </Reorder.Item>
  )
}
