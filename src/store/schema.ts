/**
 * 数据结构的版本号——**唯一定义处**。
 *
 * 规则：
 * - 改动 `AppData` 结构（新增/重命名/删除字段、改变字段含义）时必须 +1；
 * - 同时在 `useAppStore` 的 persist `migrate` 里补上对应的迁移步骤；
 * - 备份文件的 `schemaVersion`、store 持久化版本、导入校验都用这一个值，
 *   不要在别处再写死数字（以前导入模块和 store 各写了一份，改版本时容易漏）。
 */
export const SCHEMA_VERSION = 4

/** Zustand persist 的 localStorage 键；崩溃救援等需要直读原始数据的地方共用 */
export const STORE_KEY = 'intent-anchor-store'
