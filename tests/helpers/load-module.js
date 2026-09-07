import { readFile } from 'node:fs/promises'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import { createPinia, defineStore } from 'pinia'

// 使用真实源码和 Pinia，只替换浏览器、网络依赖及 Vite 注入项。
export function createModuleLoader(mocks) {
  const pinia = createPinia()
  const context = createContext({
    console,
    defineStore(id, options) {
      const useStore = defineStore(id, options)
      return () => useStore(pinia)
    }
  })
  return async function loadModule(path) {
    const source = await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
    const module = new SourceTextModule(source, {
      context,
      identifier: path,
      initializeImportMeta(meta) {
        meta.glob = () => ({})
        meta.env = { VITE_APP_BASE_API: '/dev-api' }
      }
    })
    await module.link(specifier => {
      if (!Object.hasOwn(mocks, specifier)) throw new Error(`Missing mock: ${specifier}`)
      const exports = mocks[specifier]
      return new SyntheticModule(Object.keys(exports), function () {
        for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
      }, { context })
    })
    await module.evaluate()
    return module.namespace
  }
}
