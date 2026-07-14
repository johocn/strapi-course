export interface ThemeConfig {
  primaryColor?: string
  secondaryColor?: string
  navStyle?: string
  cardStyle?: string
  tabBarColor?: string
  tabBarActiveColor?: string
}

let currentTheme: ThemeConfig = {}

export function applyTheme(themeConfig: ThemeConfig | null | undefined) {
  if (!themeConfig) return
  currentTheme = themeConfig

  // 1. H5 端设置 CSS 变量
  // #ifdef H5
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    if (themeConfig.primaryColor) root.style.setProperty('--brand-primary', themeConfig.primaryColor)
    if (themeConfig.secondaryColor) root.style.setProperty('--brand-secondary', themeConfig.secondaryColor)
  }
  // #endif

  // 2. 设置 tabBar 样式（运行时 API）
  // #ifndef H5
  try {
    uni.setTabBarStyle({
      backgroundColor: themeConfig.tabBarColor || '#667eea',
      selectedColor: themeConfig.tabBarActiveColor || '#ffffff',
      borderStyle: 'black',
    })
  } catch (e) {
    console.warn('[theme] setTabBarStyle failed:', e)
  }
  // #endif

  // 3. 设置导航栏颜色（每个页面 onShow 时也要调用）
  // #ifndef H5
  try {
    uni.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: themeConfig.primaryColor || '#667eea',
    })
  } catch (e) {
    console.warn('[theme] setNavigationBarColor failed:', e)
  }
  // #endif
}

export function getPrimaryColor(): string {
  return currentTheme.primaryColor || '#667eea'
}

export function getCurrentTheme(): ThemeConfig {
  return currentTheme
}
