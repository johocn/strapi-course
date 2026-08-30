/**
 * SSO 可达性探测工具
 *
 * 用途：在跳转 SSO 统一登录/注册前，先探测 SSO 服务端（如 h.joho.cn）是否可达。
 * 若不可达，C 端自动降级到本地登录/注册表单。
 *
 * 方式：对 SSO origin 发起 `no-cors` 的 fetch 探测 —— 浏览器无法读取跨域响应体
 * （opaque），但网络层失败（DNS / TLS / 连接拒绝）会 reject，据此判断可达性。
 * 失败则重试，最多 3 次。
 */
export async function probeHostReachable(url: string, attempts = 3): Promise<boolean> {
  // 非浏览器 / 无 fetch 环境不拦截（让调用方按可达处理）
  if (typeof fetch !== 'function') return true

  let origin = ''
  try {
    origin = new URL(url).origin
  } catch {
    return false
  }

  for (let i = 0; i < attempts; i++) {
    try {
      // no-cors：只探测连通性，不关心状态码与响应体；网络层失败才会 reject
      await fetch(origin + '/', { mode: 'no-cors', cache: 'no-store', redirect: 'follow' })
      return true
    } catch (e) {
      console.warn(`[sso-probe] 第 ${i + 1}/${attempts} 次探测 ${origin} 失败:`, e)
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 700))
    }
  }
  return false
}