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
 * - external ：自建 API 模式（/api/auth/* + /api/state，Neon + Cloud Functions），
 *              只有在显式设置 VITE_CLOUD_MODE=external 时才启用。
 * - guest    ：纯本地模式（默认）。数据只存在当前浏览器的 localStorage，
 *              两台设备各自独立、互不影响，不需要登录、数据库、短信或邮件。
 *
 * 当前产品定位是「两三个人自用」，所以正式域名默认就是 guest。
 * 将来若要恢复云同步，构建时设置 VITE_CLOUD_MODE=external 即可，无需改代码。
 */
function detectCloudMode(): CloudMode {
  const explicit = import.meta.env.VITE_CLOUD_MODE
  if (explicit === 'workbuddy' || explicit === 'external' || explicit === 'guest') return explicit

  if (typeof location === 'undefined') return 'guest'
  const host = location.hostname
  // WorkBuddy 托管域名保持原手机号登录 + 云数据库，行为不变
  if (/(^|\.)workbuddy\.host$/.test(host)) return 'workbuddy'
  // 其余所有环境（EdgeOne、自定义域名、localhost、file://）一律纯本地
  return 'guest'
}

export const cloudMode: CloudMode = detectCloudMode()
export const isCloudEnabled = cloudMode !== 'guest'
export const isExternal = cloudMode === 'external'
export const isWorkbuddy = cloudMode === 'workbuddy'
