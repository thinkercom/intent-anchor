interface Props {
  /** 按行拆开的文案，行序即视觉行序 */
  lines: string[]
  className?: string
}

/**
 * 花填字主视觉。
 *
 * 两层文字严格重合：底层实色墨，上层用花簇纹理抠进字形。
 * 只有上层的 opacity 在循环里起落，其余属性一律不动 ——
 * 每帧都走合成器，不触发重排，也不重绘文字遮罩。
 *
 * 为什么要两层而不是直接给文字上花：
 * background-clip: text 的元素没法单独控制「花出现/退去」的时机，
 * 一旦把花刻死，字就永远是可读性最差的那个状态。
 */
export function FlowerHeadline({ lines, className = '' }: Props) {
  return (
    <h1 className={`hero-type ${className}`} aria-label={lines.join(' ')}>
      <span className="hero-type__solid" aria-hidden="true">
        {lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </span>
      <span className="hero-type__floral" aria-hidden="true">
        {lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </span>
    </h1>
  )
}
