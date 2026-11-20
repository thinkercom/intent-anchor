/**
 * 拖拽期间临时锁住页面滚动。
 *
 * 背景：习惯列表在可滚动容器里，如果要「长按后拖动排序」，
 * 手指一移动浏览器就会把手势判成滚动，并给元素发 pointercancel，拖动立刻中断。
 *
 * 常规做法是给元素设 `touch-action: none`，但那会让整行都没法滑动页面
 * （5 个习惯基本占满一屏，就再也滚不动了）。所以这里反过来：
 * - 平时 `touch-action: pan-y`，正常滚动不受影响
 * - 长按真正开始拖动时才挂一个非被动 touchmove 监听并 preventDefault，
 *   手指一直在原地，浏览器还没开始滚动，此时阻止即可让手势交给拖拽
 * - 松手后立刻摘掉监听，滚动恢复
 */
let lockCount = 0

function blockTouchMove(event: TouchEvent) {
  if (event.cancelable) event.preventDefault()
}

export function lockScrollForDrag(): void {
  lockCount += 1
  if (lockCount > 1) return
  document.addEventListener('touchmove', blockTouchMove, { passive: false, capture: true })
}

export function unlockScrollForDrag(): void {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount > 0) return
  document.removeEventListener('touchmove', blockTouchMove, true)
}
