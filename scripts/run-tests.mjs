/**
 * 关键逻辑的回归测试。
 *
 * 不引入测试框架：这些用例只验证纯函数（统计口径、备份指纹），
 * 用 esbuild 把每个 *.test.ts 打成单文件 ESM 再直接 import 执行即可。
 * 新增测试只需在 tests/ 下放一个 `xxx.test.ts`，断言用 console 输出 + exitCode。
 *
 * 为什么值得有：统计口径和版本迁移出错时，页面不会崩，只会安静地显示错的数字——
 * 这种问题在界面上极难发现，只能靠断言守住。
 */
import { build } from 'esbuild'
import { readdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const TESTS_DIR = resolve('tests')
const files = (await readdir(TESTS_DIR)).filter((f) => f.endsWith('.test.ts')).sort()
if (files.length === 0) {
  console.error('tests/ 下没有 *.test.ts')
  process.exitCode = 1
} else {
  const out = await mkdtemp(join(tmpdir(), 'mout-tests-'))
  for (const file of files) {
    const outfile = join(out, file.replace(/\.ts$/, '.mjs'))
    await build({
      entryPoints: [join(TESTS_DIR, file)],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      logLevel: 'error',
    })
    console.log(`\n--- ${file} ---`)
    await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`)
  }
  await rm(out, { recursive: true, force: true })
}
