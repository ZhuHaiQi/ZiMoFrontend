/**
 * 生成字典自定义颜色标签样式。
 * 文字使用原色，背景和边框使用同色系浅色，与 Element Plus light tag 风格一致。
 */
export function dictColorTagStyle(color) {
  if (!color) return undefined
  return {
    '--el-tag-text-color': color,
    '--el-tag-bg-color': `color-mix(in srgb, ${color} 10%, transparent)`,
    '--el-tag-border-color': `color-mix(in srgb, ${color} 25%, transparent)`
  }
}
