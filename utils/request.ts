/**
 * 通用请求工具 - 包含错误处理和重试机制
 */

// 网络状态
export const networkStatus = {
  isConnected: true,
  lastError: null as string | null
}

// 显示错误提示
export function showError(message: string, duration: number = 2000) {
  uni.showToast({
    title: message,
    icon: 'none',
    duration
  })
}

// 显示加载提示
export function showLoading(message: string = '加载中...') {
  uni.showLoading({ title: message, mask: true })
}

// 隐藏加载提示
export function hideLoading() {
  uni.hideLoading()
}

// 显示成功提示
export function showSuccess(message: string, duration: number = 1500) {
  uni.showToast({
    title: message,
    icon: 'success',
    duration
  })
}

// 检查网络状态
export function checkNetwork(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.getNetworkType({
      success: (res) => {
        networkStatus.isConnected = res.networkType !== 'none'
        resolve(networkStatus.isConnected)
      },
      fail: () => {
        networkStatus.isConnected = false
        resolve(false)
      }
    })
  })
}

// 带错误处理的请求
export async function safeRequest<T>(
  requestFn: () => Promise<T>,
  options: {
    loadingText?: string
    errorText?: string
    showErrorToast?: boolean
    retryCount?: number
    retryDelay?: number
  } = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const {
    loadingText = '加载中...',
    errorText = '网络请求失败',
    showErrorToast = true,
    retryCount = 0,
    retryDelay = 1000
  } = options

  // 检查网络状态
  const isConnected = await checkNetwork()
  if (!isConnected) {
    if (showErrorToast) {
      showError('网络连接异常，请检查网络设置')
    }
    return { success: false, error: '网络连接异常' }
  }

  showLoading(loadingText)

  let lastError: string | null = null
  let attempts = 0

  while (attempts <= retryCount) {
    try {
      const data = await requestFn()
      hideLoading()
      return { success: true, data }
    } catch (e: any) {
      lastError = e?.message || errorText
      attempts++

      if (attempts <= retryCount) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }
  }

  hideLoading()

  if (showErrorToast) {
    showError(lastError || errorText)
  }

  networkStatus.lastError = lastError
  return { success: false, error: lastError }
}

// 表单验证工具
export const validators = {
  // 手机号验证
  phone: (value: string): boolean => {
    return /^1[3-9]\d{9}$/.test(value)
  },

  // 验证码验证
  code: (value: string, length: number = 4): boolean => {
    return value.length >= length
  },

  // 非空验证
  required: (value: string): boolean => {
    return value.trim().length > 0
  },

  // 长度验证
  length: (value: string, min: number, max?: number): boolean => {
    const len = value.trim().length
    if (max) {
      return len >= min && len <= max
    }
    return len >= min
  },

  // 邮箱验证
  email: (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  },

  // 身份证验证
  idCard: (value: string): boolean => {
    return /^\d{17}[\dXx]$/.test(value)
  }
}

// 验证表单
export function validateForm(
  fields: { value: string; rules: { type: string; message: string; params?: any[] }[] }[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const field of fields) {
    for (const rule of field.rules) {
      let isValid = false

      switch (rule.type) {
        case 'required':
          isValid = validators.required(field.value)
          break
        case 'phone':
          isValid = validators.phone(field.value)
          break
        case 'code':
          isValid = validators.code(field.value, rule.params?.[0] || 4)
          break
        case 'length':
          isValid = validators.length(field.value, rule.params?.[0] || 0, rule.params?.[1])
          break
        case 'email':
          isValid = validators.email(field.value)
          break
        case 'idCard':
          isValid = validators.idCard(field.value)
          break
        default:
          isValid = true
      }

      if (!isValid) {
        errors.push(rule.message)
        break
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

// 显示表单错误
export function showFormErrors(errors: string[]) {
  if (errors.length > 0) {
    showError(errors[0])
  }
}