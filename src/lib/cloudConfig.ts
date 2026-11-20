// 云服务的公开配置（可随前端发布，不含任何密钥）。
// workbuddy 模式来自 workbuddy_cloud_service 的 publicConfig。
export const cloudConfig = {
  endpoint: 'https://intent-anchor.app.workbuddy.host',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey: 'wbpk_bUrnY3QZsjst2Tu98GRs8o_jWvlLIeiIMwncm03P39bfwuWF8mZb5Uw',
} as const

export type CloudMode = 'workbuddy' | 'external' | 'guest'

/**
 * 云能力模式：
 * - workbuddy：显示在 *.workbuddy.host 上，沿用原 WorkBuddy SDK 登录/数据库（现网不变）。
 * - external ：正式部署（EdgeOne 等）走自建 API：/api/auth/* + /api/state（Neon + Cloud Functions）。
 * - guest    ：本地开发/预览（localhost、file://）保持纯游客，避免误连线上云端。
 *
 * 可用构建时环境变量 VITE_CLOUD_MODE 强制覆盖（workbuddy / external / guest）。
 */
function detectCloudMode(): CloudMode {
  const explicit = import.meta.env.VITE_CLOUD_MODE
  if (explicit === 'workbuddy' || explicit === 'external' || explicit === 'guest') return explicit

  if (typeof location === 'undefined') return 'guest'
  const host = location.hostname
  if (/(^|\.)workbuddy\.host$/.test(host)) return 'workbuddy'
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || location.protocol === 'file:') {
    return 'guest'
  }
  // EdgeOne 默认域名与自定义域名等正式环境
  return 'external'
}

export const cloudMode: CloudMode = detectCloudMode()
export const isCloudEnabled = cloudMode !== 'guest'
export const isExternal = cloudMode === 'external'
export const isWorkbuddy = cloudMode === 'workbuddy'
