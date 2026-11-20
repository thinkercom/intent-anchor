// 腾讯云短信发送（TC3-HMAC-SHA256 签名），纯 Web Crypto 实现，无官方 SDK 依赖。
// 依赖环境变量：SMS_SECRET_ID / SMS_SECRET_KEY / SMS_SDK_APP_ID / SMS_SIGN_NAME / SMS_TEMPLATE_ID
import { cfg } from './config'

const ENDPOINT = 'sms.tencentcloudapi.com'
const SERVICE = 'sms'
const HOST = ENDPOINT
const ACTION = 'SendSms'
const VERSION = '2021-01-11'
const REGION = '' // 短信为全局服务，Region 传空即可

const encoder = new TextEncoder()

function sha256(msg: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', typeof msg === 'string' ? encoder.encode(msg) : msg)
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function hmac(key: ArrayBuffer | string, msg: string): Promise<ArrayBuffer> {
  const raw = typeof key === 'string' ? encoder.encode(key) : key
  const cryptoKey = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(msg))
}

/** 用 TC3 签名调用腾讯云 SendSms */
export async function sendSms(phoneE164: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const secretId = cfg('SMS_SECRET_ID')
  const secretKey = cfg('SMS_SECRET_KEY')
  const sdkAppId = cfg('SMS_SDK_APP_ID')
  const signName = cfg('SMS_SIGN_NAME')
  const templateId = cfg('SMS_TEMPLATE_ID')

  const missing = [
    !secretId && 'SMS_SECRET_ID',
    !secretKey && 'SMS_SECRET_KEY',
    !sdkAppId && 'SMS_SDK_APP_ID',
    !signName && 'SMS_SIGN_NAME',
    !templateId && 'SMS_TEMPLATE_ID',
  ].filter(Boolean)
  if (missing.length) return { ok: false, error: `短信服务未配置: ${missing.join(', ')}` }

  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10) // YYYY-MM-DD UTC

  const payload = {
    PhoneNumberSet: [phoneE164],
    SmsSdkAppId: sdkAppId,
    SignName: signName,
    TemplateID: templateId,
    TemplateParamSet: [code],
  }
  const body = JSON.stringify(payload)

  // 1) 拼接规范请求串
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${HOST}\n`
  const signedHeaders = 'content-type;host'
  const hashedBody = toHex(await sha256(body))
  const canonicalRequest = [
    'POST',
    '/',
    '', // canonical querystring
    canonicalHeaders,
    signedHeaders,
    hashedBody,
  ].join('\n')

  // 2) 待签名字符串
  const credentialScope = `${date}/${SERVICE}/tc3_request`
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    toHex(await sha256(canonicalRequest)),
  ].join('\n')

  // 3) 派生签名密钥链
  const secretDate = await hmac(`TC3${secretKey}`, date)
  const secretService = await hmac(secretDate, SERVICE)
  const secretSigning = await hmac(secretService, 'tc3_request')
  const signature = toHex(await hmac(secretSigning, stringToSign))

  const authorization = [
    'TC3-HMAC-SHA256',
    `Credential=${secretId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ')

  try {
    const res = await fetch(`https://${HOST}/`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json; charset=utf-8',
        Host: HOST,
        'X-TC-Action': ACTION,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Version': VERSION,
        ...(REGION ? { 'X-TC-Region': REGION } : {}),
      },
      body,
    })
    const result = (await res.json()) as { Response?: { Error?: { Code: string; Message: string }; RequestId?: string } }
    const err = result?.Response?.Error
    if (err) return { ok: false, error: `短信发送失败: ${err.Code} ${err.Message}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: `短信服务请求异常: ${e instanceof Error ? e.message : String(e)}` }
  }
}
