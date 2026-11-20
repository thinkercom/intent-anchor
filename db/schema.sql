-- ============================================================
-- 意图锚点 (Intent Anchor) — Neon PostgreSQL 建表脚本
-- 阶段 B/C：邮箱主账户 + EdgeOne Cloud Functions 自建认证
-- 用法：在 Neon 控制台 -> SQL Editor 粘贴执行（可重复执行，幂等）
--
-- 说明：本库只服务 EdgeOne（external）版本，主账户为「邮箱」。
-- WorkBuddy 现网仍使用其自有云端与手机号体系，与本库无关。
-- 若你此前已按旧版执行过 phone_otp 表，可忽略它（不影响本方案），
-- 也可手动执行 DROP TABLE IF EXISTS phone_otp; 清理。
-- ============================================================

-- 1) 主账户身份映射表：一个 master_key（规范化邮箱）可挂多个身份
CREATE TABLE IF NOT EXISTS account_identity (
  id          BIGSERIAL PRIMARY KEY,
  uid         TEXT NOT NULL UNIQUE,          -- 认证身份 id：邮箱阶段等于 master_key；微信阶段为微信 openid
  master_key  TEXT NOT NULL,                 -- 主账户键，规范化邮箱（小写去空格），如 thinker@example.com
  provider    TEXT NOT NULL,                 -- 'email' | 'wechat'
  verified    BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_master_key ON account_identity (master_key);

-- 2) 业务数据表：整包 AppData 存 JSONB，按 master_key 归属（结构不变）
CREATE TABLE IF NOT EXISTS user_state (
  id          BIGSERIAL PRIMARY KEY,
  master_key  TEXT NOT NULL UNIQUE,          -- 一个主账户一份存档
  owner_id    TEXT,                          -- 兼容旧字段：最后写入者 uid（可空）
  payload     JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_us_updated_at ON user_state (updated_at);

-- 3) 邮箱验证码表：存哈希不存明文，带过期与尝试次数
CREATE TABLE IF NOT EXISTS email_otp (
  email       TEXT PRIMARY KEY,              -- 规范化邮箱（小写去空格）
  code_hash   TEXT NOT NULL,                 -- HMAC-SHA256(code + ':' + email, JWT_SECRET)
  attempts    INT NOT NULL DEFAULT 0,        -- 校验尝试次数，>5 作废
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 过期记录由查询条件过滤，无需定时清理；可选：定期 DELETE FROM email_otp WHERE expires_at < now();

-- 说明：本方案不使用 Postgres RLS。身份隔离由云函数强制完成：
--   /api/state 从会话 JWT 解析出 master_key，所有查询强制 WHERE master_key = 会话值，
--   客户端即使伪造请求体也读不到 / 写不到他人的数据。
-- 数据库角色仅由服务端 DATABASE_URL 使用，切勿把连接串暴露给前端。
