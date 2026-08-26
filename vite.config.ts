import { defineConfig, type Plugin } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import * as path from 'path'
import * as fs from 'fs'

/**
 * 修复 uni-h5-vue(Vue 3.4.21 运行时) 与项目 vue@3.5.x 编译产物不兼容：
 * initSlots 将 slots._ 定义为只读，而 3.5 编译器产物 slots._ 可枚举，
 * 导致 updateSlots 的 Object.assign(slots, children) 抛
 * "Cannot assign to read only property '_'"（Vue 调度器刷新手写错误）。
 * 将 _ 改为可写即可（值语义不变），不升级 vue、不装依赖。
 */
function patchUniH5VueSlots(): Plugin {
  const files = [
    path.resolve(__dirname, 'node_modules/@dcloudio/uni-h5-vue/dist/vue.runtime.esm.js'),
    path.resolve(__dirname, 'node_modules/@dcloudio/uni-h5-vue/dist/vue.runtime.cjs.js'),
    path.resolve(__dirname, 'node_modules/@dcloudio/uni-h5-vue/dist-x/vue.runtime.esm.js')
  ]
  const original = new Map<string, string>()
  let isBuild = false
  return {
    name: 'patch-uni-h5-vue-slots',
    enforce: 'pre',
    configResolved(config) {
      isBuild = config.command === 'build'
    },
    transform(code, id) {
      // dev 模式：通过 transform 管道直接修补模块源码（dev 管道会应用 transform 结果）
      if (isBuild) return
      if (!id.includes('@dcloudio/uni-h5-vue') || !/vue\.runtime\.(esm|cjs)\.js$/.test(id)) return
      return code.replace('def(children, "_", type)', 'def(children, "_", type, true)')
    },
    buildStart() {
      if (!isBuild) return
      for (const file of files) {
        try {
          const code = fs.readFileSync(file, 'utf8')
          const patched = code.replace(
            'def(children, "_", type)',
            'def(children, "_", type, true)'
          )
          if (patched !== code) {
            original.set(file, code)
            fs.writeFileSync(file, patched)
            console.log('[patch-uni-h5-vue-slots] patched ' + file)
          }
        } catch (e) {
          console.warn('[patch-uni-h5-vue-slots] skip ' + file + ': ' + e.message)
        }
      }
    },
    closeBundle() {
      if (!isBuild) return
      for (const [file, code] of original) {
        try {
          fs.writeFileSync(file, code)
          console.log('[patch-uni-h5-vue-slots] restored ' + file)
        } catch (e) {
          console.warn('[patch-uni-h5-vue-slots] restore fail ' + file + ': ' + e.message)
        }
      }
      original.clear()
    }
  }
}

export default defineConfig({
  plugins: [uni(), patchUniH5VueSlots()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: true
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@import "@/uni.scss";'
      }
    }
  }
})
