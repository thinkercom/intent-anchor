/**
 * From Uiverse.io by marcelodolza - https://uiverse.io/marcelodolza/stupid-vampirebat-24
 * MIT License, Copyright (c) marcelodolza (Marcelo Dolza)
 *
 * 原版是紫色渐变 + 旋转斜切的立体按钮。结构与动效保留，材质按本项目的主题重做：
 *   结构：错层投影（bg）+ 厚边框（wrap）+ 内凹面板（content）+ 描边（path）+ 点击 splash
 *   动效：逐字入场、悬停时每个字重新翻进来、箭头摆动、按下时箭头飞走、
 *         标签从 Begin Today 换成 Begin Now、面板抬起 2px
 *
 * 所有类名加 jb- 前缀，配色与字号集中在 index.css 的 .jb 里，不与全局样式打架。
 */
import { useState, type CSSProperties } from 'react'

interface Glyph {
  ch: string
  /** 第二个词的首字母：靠一点额外的左间距把词分开 */
  lead?: boolean
}

const IDLE: Glyph[] = [
  { ch: 'B' },
  { ch: 'e' },
  { ch: 'g' },
  { ch: 'i' },
  { ch: 'n' },
  { ch: 'T', lead: true },
  { ch: 'o' },
  { ch: 'd' },
  { ch: 'a' },
  { ch: 'y' },
]

const ARMED: Glyph[] = [
  { ch: 'B' },
  { ch: 'e' },
  { ch: 'g' },
  { ch: 'i' },
  { ch: 'n' },
  { ch: 'N', lead: true },
  { ch: 'o' },
  { ch: 'w' },
]

/**
 * 一个字两层：文字本身透明，真正的字形由 ::before（上方待命）和 ::after（当前显示）画出来。
 * 这样「翻进来」只需要动伪元素的 opacity 和 transform，字宽始终不变，按钮不会跟着抖。
 */
function Chars({ glyphs, state }: { glyphs: Glyph[]; state: 1 | 2 }) {
  return (
    <span className={`jb-char jb-state-${state}`} aria-hidden="true">
      {glyphs.map((g, i) => (
        <span
          key={`${g.ch}-${i}`}
          data-label={g.ch}
          style={
            {
              '--i': i + 1,
              ...(g.lead ? { marginLeft: '0.32em' } : null),
            } as CSSProperties
          }
        >
          {g.ch}
        </span>
      ))}
    </span>
  )
}

interface Props {
  onClick: () => void
}

export function BeginButton({ onClick }: Props) {
  // 触屏上没有 hover：按下的瞬间就切到「已瞄准」那一档，
  // 键盘用户则由 :focus-visible 触发，两处走同一套样式
  const [armed, setArmed] = useState(false)

  return (
    <button
      type="button"
      className="jb"
      data-armed={armed}
      onClick={onClick}
      onPointerDown={() => setArmed(true)}
      onBlur={() => setArmed(false)}
      aria-label="开始今天"
    >
      <div className="jb-bg" aria-hidden="true" />

      {/* 按下时向两侧散开的短线 */}
      <svg
        className="jb-splash"
        viewBox="0 0 342 208"
        width="342"
        height="208"
        fill="none"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeWidth="3" d="M54.1054 99.7837C54.1054 99.7837 40.0984 90.7874 26.6893 97.6362C13.2802 104.485 1.5 97.6362 1.5 97.6362" />
        <path strokeLinecap="round" strokeWidth="3" d="M285.273 99.7841C285.273 99.7841 299.28 90.7879 312.689 97.6367C326.098 104.486 340.105 95.4893 340.105 95.4893" />
        <path strokeLinecap="round" strokeWidth="3" strokeOpacity="0.3" d="M281.133 64.9917C281.133 64.9917 287.96 49.8089 302.934 48.2295C317.908 46.6501 319.712 36.5272 319.712 36.5272" />
        <path strokeLinecap="round" strokeWidth="3" strokeOpacity="0.3" d="M281.133 138.984C281.133 138.984 287.96 154.167 302.934 155.746C317.908 157.326 319.712 167.449 319.712 167.449" />
        <path strokeLinecap="round" strokeWidth="3" d="M230.578 57.4476C230.578 57.4476 225.785 41.5051 236.061 30.4998C246.337 19.4945 244.686 12.9998 244.686 12.9998" />
        <path strokeLinecap="round" strokeWidth="3" d="M230.578 150.528C230.578 150.528 225.785 166.471 236.061 177.476C246.337 188.481 244.686 194.976 244.686 194.976" />
        <path strokeLinecap="round" strokeWidth="3" strokeOpacity="0.3" d="M170.392 57.0278C170.392 57.0278 173.89 42.1322 169.571 29.54C165.252 16.9478 168.751 2.05227 168.751 2.05227" />
        <path strokeLinecap="round" strokeWidth="3" strokeOpacity="0.3" d="M170.392 150.948C170.392 150.948 173.89 165.844 169.571 178.436C165.252 191.028 168.751 205.924 168.751 205.924" />
        <path strokeLinecap="round" strokeWidth="3" d="M112.609 57.4476C112.609 57.4476 117.401 41.5051 107.125 30.4998C96.8492 19.4945 98.5 12.9998 98.5 12.9998" />
        <path strokeLinecap="round" strokeWidth="3" d="M112.609 150.528C112.609 150.528 117.401 166.471 107.125 177.476C96.8492 188.481 98.5 194.976 98.5 194.976" />
        <path strokeLinecap="round" strokeWidth="3" strokeOpacity="0.3" d="M62.2941 64.9917C62.2941 64.9917 55.4671 49.8089 40.4932 48.2295C25.5194 46.6501 23.7159 36.5272 23.7159 36.5272" />
        <path strokeLinecap="round" strokeWidth="3" strokeOpacity="0.3" d="M62.2941 145.984C62.2941 145.984 55.4671 161.167 40.4932 162.746C25.5194 164.326 23.7159 174.449 23.7159 174.449" />
      </svg>

      <div className="jb-wrap">
        {/* 焦点描边：沿面板轮廓的一条开口线，聚焦时跑一圈。
            原版的 viewBox 是按 220×80 的键帽画的 221×42，落到这里只会压在底边，
            所以按面板实际尺寸（214-3*2 × 74-3*2）重画，顶部留一段缺口当作起点 */}
        <svg className="jb-path" viewBox="0 0 208 68" width="208" height="68" fill="none" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeWidth="2"
            d="M176 2.5H192.5A13 13 0 0 1 205.5 15.5V52.5A13 13 0 0 1 192.5 65.5H15.5A13 13 0 0 1 2.5 52.5V15.5A13 13 0 0 1 15.5 2.5H28"
          />
        </svg>

        <div className="jb-outline" aria-hidden="true" />

        <div className="jb-content">
          <Chars glyphs={IDLE} state={1} />
          <div className="jb-icon" aria-hidden="true">
            <div />
          </div>
          <Chars glyphs={ARMED} state={2} />
        </div>
      </div>
    </button>
  )
}
