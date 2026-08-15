/** 课时领分：specific + channel_cross_points=true + 多候选渠道 → 弹选择器 */
export function shouldShowChannelPicker(
  channelScope: string,
  channelIds: any[],
  channelCrossPointsFlag: boolean
): boolean {
  return channelCrossPointsFlag && channelScope === 'specific' && channelIds.length > 1
}

/** 答题领分：all 范围，或 specific 且一个渠道都没有 → 拉取可用渠道 */
export function shouldFetchAvailableChannels(
  channelConfig: { channelScope?: string; channelIds?: any[] },
  knownChannels: any[]
): boolean {
  if (channelConfig?.channelScope === 'all') return true
  if (channelConfig?.channelScope === 'specific' && knownChannels.length === 0) return true
  return false
}

/** specific 模式：id 数组 → 完整对象（name 兜底为 id） */
export function buildChannelOptions(channelIds: any[]): Array<{ documentId: any; name: any; id: any }> {
  return (channelIds || []).map((id: any) => ({ documentId: id, name: id, id }))
}

/** 按 documentId 去重保留完整对象 */
export function dedupeChannels(channels: any[]): any[] {
  return [...new Map(channels.map((c: any) => [c.documentId, c])).values()]
}

/** 渠道标签，默认渠道追加"（默认）" */
export function buildChannelLabels(channelIds: any[], defaultChannelId: any): string[] {
  return channelIds.map((id) => {
    const isDefault = isDefaultChannel(id, defaultChannelId)
    return `${id}${isDefault ? '（默认）' : ''}`
  })
}

/** String 比较判断是否默认渠道 */
export function isDefaultChannel(id: any, defaultChannelId: any): boolean {
  return String(id) === String(defaultChannelId)
}

/** 统一 String() 转换，消除 number/string 类型不一致 */
export function normalizeChannelId(id: any): string {
  return String(id)
}