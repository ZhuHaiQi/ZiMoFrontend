import assert from 'node:assert/strict'
import test from 'node:test'
import { createModuleLoader } from './helpers/load-module.js'

test('同一接口的标签、取值和数据路径映射相互独立', async () => {
  const load = createModuleLoader({
    '@/utils/request': { default: async () => ({
      data: [{ id: 1, code: 'A', name: '甲', title: '标题甲' }],
      rows: [{ id: 2, code: 'B', name: '乙', title: '标题乙' }]
    }) }
  })
  const { fetchApiOptions } = await load('src/utils/dynamicSource.js')
  const config = { url: '/options', dataField: 'data', labelField: 'name', valueField: 'id' }
  const first = await fetchApiOptions(config)
  const label = await fetchApiOptions({ ...config, labelField: 'title' })
  const value = await fetchApiOptions({ ...config, valueField: 'code' })
  const path = await fetchApiOptions({ ...config, dataField: 'rows' })
  assert.equal(first[0].label, '甲')
  assert.equal(label[0].label, '标题甲')
  assert.equal(value[0].value, 'A')
  assert.equal(path[0].label, '乙')
  assert.equal(path[0].value, 2)
})

test('相同配置复用缓存，强制刷新和清空缓存后重新请求', async () => {
  let requests = 0
  const load = createModuleLoader({
    '@/utils/request': { default: async () => ({ data: [{ label: '选项', value: ++requests }] }) }
  })
  const { fetchApiOptions, clearApiOptionsCache } = await load('src/utils/dynamicSource.js')
  const config = { url: '/options' }
  assert.equal((await fetchApiOptions(config))[0].value, 1)
  assert.equal((await fetchApiOptions({ ...config, labelField: 'label', valueField: 'value' }))[0].value, 1)
  assert.equal(requests, 1)
  assert.equal((await fetchApiOptions(config, true))[0].value, 2)
  clearApiOptionsCache()
  assert.equal((await fetchApiOptions(config))[0].value, 3)
})
