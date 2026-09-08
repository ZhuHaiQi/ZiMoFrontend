import request from '@/utils/request'

/** 接口动态数据源内存缓存 */
const apiOptionsCache = new Map()

/**
 * 获取深层属性值
 */
function getByPath(obj, path) {
  if (!obj || !path) return undefined
  const segments = path.split('.')
  let curr = obj
  for (const seg of segments) {
    if (curr == null) return undefined
    curr = curr[seg]
  }
  return curr
}

/**
 * 根据接口配置获取动态选项数据
 * @param {Object} apiConfig API配置
 * @param {boolean} force 是否强制刷新不使用缓存
 * @returns {Promise<Array<{label: string, value: any, raw: Object}>>}
 */
export async function fetchApiOptions(apiConfig, force = false) {
  if (!apiConfig || !apiConfig.url) return []

  const url = String(apiConfig.url).trim()
  if (!url) return []
  const method = (apiConfig.method || 'GET').toUpperCase()
  let params = apiConfig.params || {}
  if (typeof params === 'string') {
    try {
      params = JSON.parse(params || '{}')
    } catch {
      params = {}
    }
  }

  const dataField = apiConfig.dataField || ''
  const labelKey = apiConfig.labelField || 'label'
  const valueKey = apiConfig.valueField || 'value'
  // 缓存的是映射后的选项，数据路径和字段映射也必须参与缓存标识。
  const cacheKey = JSON.stringify({ url, method, params, dataField, labelKey, valueKey })
  if (!force && apiOptionsCache.has(cacheKey)) {
    return apiOptionsCache.get(cacheKey)
  }

  const reqConfig = {
    url,
    method
  }

  if (method === 'GET') {
    reqConfig.params = params
  } else {
    reqConfig.data = params
  }

  // 缓存进行中的 Promise，使表格、搜索表单和预览共享同一次请求。
  const pending = (async () => {
    const response = await request(reqConfig)
    let rawList

    if (dataField) {
      const customData = getByPath(response, dataField)
      if (Array.isArray(customData)) {
        rawList = customData
      }
    }

    if (!rawList) {
      if (Array.isArray(response)) {
        rawList = response
      } else if (Array.isArray(response?.data)) {
        rawList = response.data
      } else if (Array.isArray(response?.rows)) {
        rawList = response.rows
      } else if (Array.isArray(response?.data?.list)) {
        rawList = response.data.list
      } else if (Array.isArray(response?.data?.rows)) {
        rawList = response.data.rows
      }
    }

    const options = (rawList || []).map(item => {
      if (item === null || item === undefined) return null
      if (typeof item !== 'object') {
        return { label: String(item), value: item, raw: item }
      }
      const label = item[labelKey] ?? item.label ?? item.name ?? item.title ?? item.dictLabel ?? ''
      const value = item[valueKey] ?? item.value ?? item.id ?? item.dictValue
      return {
        label: String(label),
        value,
        type: item.type || item.elTagType || '',
        color: item.color || '',
        raw: item
      }
    }).filter(Boolean)

    return options
  })().catch(error => {
    // 旧请求失败不能移除强制刷新创建的新缓存，失败请求允许下次重试。
    if (apiOptionsCache.get(cacheKey) === pending) apiOptionsCache.delete(cacheKey)
    console.error('拉取动态接口选项失败:', url, error)
    return []
  })
  apiOptionsCache.set(cacheKey, pending)
  return pending
}

/**
 * 清除接口选项缓存
 */
export function clearApiOptionsCache() {
  apiOptionsCache.clear()
}
