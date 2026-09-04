import request from '@/utils/request'

export function listDynamicTables(query) {
  return request({ url: '/system/dynamic/table/list', method: 'get', params: query })
}

export function getDynamicTable(tableId) {
  return request({ url: `/system/dynamic/table/${tableId}`, method: 'get' })
}

export function getDynamicTableByCode(tableCode) {
  return request({ url: `/system/dynamic/table/code/${tableCode}`, method: 'get' })
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

export function saveDynamicFields(tableId, data) {
  return request({ url: `/system/dynamic/table/${tableId}/fields`, method: 'put', data })
}

export function deleteDynamicTable(tableIds) {
  return request({ url: `/system/dynamic/table/${tableIds}`, method: 'delete' })
}

export function pageDynamicRecords(tableCode, data) {
  return request({ url: `/system/dynamic/record/${tableCode}/page`, method: 'post', data })
}

export function getDynamicRecord(tableCode, recordId) {
  return request({ url: `/system/dynamic/record/${tableCode}/${recordId}`, method: 'get' })
}

export function addDynamicRecord(tableCode, data) {
  return request({ url: `/system/dynamic/record/${tableCode}`, method: 'post', data })
}

export function batchAddDynamicRecords(tableCode, data) {
  return request({ url: `/system/dynamic/record/${tableCode}/batch`, method: 'post', data })
}

export function updateDynamicRecord(tableCode, data) {
  return request({ url: `/system/dynamic/record/${tableCode}`, method: 'put', data })
}

export function deleteDynamicRecord(tableCode, recordId, version) {
  return request({ url: `/system/dynamic/record/${tableCode}/${recordId}/${version}`, method: 'delete' })
}
