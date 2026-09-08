import request from '@/utils/request'

export function listDynamicTables(query) {
  return request({ url: '/system/dynamic/table/list', method: 'get', params: query })
}

export function getDynamicTable(id) {
  return request({ url: `/system/dynamic/table/${id}`, method: 'get' })
}

export function getDynamicFieldCatalog() {
  return request({ url: '/system/dynamic/table/catalog', method: 'get' })
}

export function getDynamicDictOptions(types) {
  return request({
    url: '/system/dynamic/table/dict-options',
    method: 'get',
    params: { types: Array.isArray(types) ? types.join(',') : types }
  })
}

export function addDynamicTable(data) {
  return request({ url: '/system/dynamic/table', method: 'post', data })
}

export function updateDynamicTable(data) {
  return request({ url: '/system/dynamic/table', method: 'put', data })
}

export function saveDynamicFields(id, data) {
  return request({ url: `/system/dynamic/table/${id}/fields`, method: 'put', data })
}

export function deleteDynamicTable(ids) {
  return request({ url: `/system/dynamic/table/${ids}`, method: 'delete' })
}

export function pageDynamicRecords(tableCode, data) {
  return request({ url: `/system/dynamic/record/${tableCode}/page`, method: 'post', data })
}

export function addDynamicRecord(tableCode, data) {
  return request({ url: `/system/dynamic/record/${tableCode}`, method: 'post', data })
}

export function updateDynamicRecord(tableCode, data) {
  return request({ url: `/system/dynamic/record/${tableCode}`, method: 'patch', data })
}

export function deleteDynamicRecord(tableCode, id, version) {
  return request({ url: `/system/dynamic/record/${tableCode}/${id}/${version}`, method: 'delete' })
}
