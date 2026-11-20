// 云服务的公开配置（可随前端发布，不含任何密钥）。
// 来自 workbuddy_cloud_service 的 publicConfig。
// endpoint 是当前应用的正式域名，重新发布时复用同一应用即可保持不变。
export const cloudConfig = {
  endpoint: 'https://intent-anchor.app.workbuddy.host',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey: 'wbpk_bUrnY3QZsjst2Tu98GRs8o_jWvlLIeiIMwncm03P39bfwuWF8mZb5Uw',
} as const

export type CloudMode = 'workbuddy' | 'guest'

/**
 * 云能力开关：
 * - 显示在 *.workbuddy.host 上时继续用原 WorkBuddy 登录/数据库，现网行为不变。
 * - 其他域名（EdgeOne/GitHub Pages/本地预览）默认静态游客模式，阶段 A 不接云。
 * - 如需在特殊域名上强制验证云能力，可在构建时设置 VITE_CLOUD_MODE=workbuddy。
 */
function detectCloudMode(): CloudMode {
  const explicit = import.meta.env.VITE_CLOUD_MODE
  if (explicit === 'workbuddy' || explicit === 'guest') return explicit

  if (typeof location !== 'undefined' && /(^|\.)workbuddy\.host$/.test(location.hostname)) {
    return 'workbuddy'
  }
  return 'guest'
}

export const cloudMode: CloudMode = detectCloudMode()
export const isCloudEnabled = cloudMode === 'workbuddy'
