<template>
  <div class="dynamic-data-manager">
    <div v-if="searchFields.length" class="search-panel">
      <dynamic-form v-model="searchModel" :fields="searchFields" :dict-options="dictOptions" :columns="3" />
      <div class="search-actions">
        <el-button type="primary" icon="Search" @click="handleQuery">查询</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </div>
    </div>

    <div class="data-toolbar">
      <div>
        <strong>{{ schema.tableName }}</strong><span>动态数据</span>
        <small>点击单元格按需加载控件，失去焦点自动保存，Esc 取消</small>
      </div>
      <el-button type="primary" icon="Plus" @click="handleAdd" v-hasPermi="['system:dynamic:data:add']">
        表格内新增
      </el-button>
    </div>

    <dynamic-table
      ref="dynamicTableRef"
      :fields="schema.fields"
      :data="rows"
      :dict-options="dictOptions"
      :loading="loading"
      :editable="canEditCell"
      @sort-change="handleSort"
      @cell-change="handleCellChange"
    >
      <template #version="{ row }">{{ row._isDraft ? '-' : row._version }}</template>
      <template #actions="{ row }">
          <template v-if="row._isDraft">
            <el-button link type="primary" icon="Check" :loading="row._saving" @mousedown.prevent.stop @click.stop="saveDraft(row)">
              保存新增
            </el-button>
            <el-button link icon="Close" :disabled="row._saving" @mousedown.prevent.stop @click.stop="cancelDraft(row)">取消</el-button>
          </template>
          <template v-else>
            <el-button link type="danger" icon="Delete" :disabled="row._saving" @click.stop="handleDelete(row)" v-hasPermi="['system:dynamic:data:remove']">
              删除
            </el-button>
          </template>
      </template>
    </dynamic-table>
    <pagination
      v-show="total > 0"
      :total="total"
      v-model:page="query.pageNum"
      v-model:limit="query.pageSize"
      @pagination="loadRecords"
    />
  </div>
</template>

<script setup name="DynamicDataManager">
import DynamicTable from './DynamicTable.vue'
import DynamicForm from './DynamicForm.vue'
import { pageDynamicRecords, addDynamicRecord, updateDynamicRecord, deleteDynamicRecord } from '@/api/system/dynamicTable'

const props = defineProps({
  schema: { type: Object, required: true },
  dictOptions: { type: Object, default: () => ({}) }
})

const { proxy } = getCurrentInstance()
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const searchModel = ref({})
const dynamicTableRef = ref()
const draftSequence = ref(0)
const pendingSaves = new Set()
const rowSaveChains = new Map()
const query = reactive({ pageNum: 1, pageSize: 20, sortField: '', sortOrder: 'desc' })

const activeFields = computed(() => (props.schema.fields || [])
  .filter(field => field.status !== '1')
  .sort((a, b) => (a.sort || 0) - (b.sort || 0)))

const editableFields = computed(() => activeFields.value
  .filter(field => field.listVisible !== false && field.formVisible !== false))

const searchFields = computed(() => activeFields.value
  .filter(field => field.searchable)
  .map(field => ({ ...field, required: false, formVisible: true })))

function buildFilters() {
  return searchFields.value.flatMap(field => {
    const value = searchModel.value[field.fieldKey]
    if (isEmpty(value)) return []
    return [{
      fieldKey: field.fieldKey,
      operator: ['STRING', 'TEXT'].includes(field.dataType) && !['select', 'radio'].includes(field.componentType) ? 'CONTAINS' : 'EQ',
      value
    }]
  })
}

async function loadRecords() {
  await flushEditing()
  loading.value = true
  try {
    const response = await pageDynamicRecords(props.schema.tableCode, { ...query, filters: buildFilters() })
    rows.value = (response.rows || []).map(mapRecord)
    total.value = response.total || 0
  } finally {
    loading.value = false
  }
}

function mapRecord(record) {
  return {
    ...(record.data || {}),
    _recordId: record.recordId,
    _version: record.version,
    _status: record.status,
    _clientId: `record-${record.recordId}`,
    _isDraft: false,
    _saving: false,
    _savingFieldKey: null
  }
}

function handleQuery() {
  query.pageNum = 1
  loadRecords()
}

function resetQuery() {
  searchModel.value = {}
  handleQuery()
}

function handleSort({ prop, order }) {
  query.sortField = order ? prop : ''
  query.sortOrder = order === 'ascending' ? 'asc' : 'desc'
  loadRecords()
}

function canEditCell(row) {
  return row._isDraft
    ? proxy.$auth.hasPermi('system:dynamic:data:add')
    : proxy.$auth.hasPermi('system:dynamic:data:edit')
}

function handleAdd() {
  const existingDraft = rows.value.find(row => row._isDraft)
  if (existingDraft) {
    focusFirstCell(existingDraft)
    return
  }
  const row = {
    _clientId: `draft-${Date.now()}-${++draftSequence.value}`,
    _isDraft: true,
    _saving: false,
    _savingFieldKey: null,
    _status: '0',
    _version: 0
  }
  activeFields.value.forEach(field => {
    const value = defaultValueOf(field)
    if (value !== undefined) row[field.fieldKey] = value
  })
  rows.value.unshift(row)
  nextTick(() => focusFirstCell(row))
}

function focusFirstCell(row) {
  const field = editableFields.value[0]
  if (!field) {
    proxy.$modal.msgWarning('当前表没有可编辑字段')
    return
  }
  dynamicTableRef.value?.startEdit(row, field.fieldKey)
}

/** 将 VXE 的编辑关闭事件加入保存队列，翻页和查询前会等待队列清空。 */
function handleCellChange(payload) {
  if (sameValue(payload.value, payload.originalValue)) return
  if (payload.row._isDraft) {
    saveCell(payload)
    return
  }

  const rowKey = payload.row._clientId
  const previous = rowSaveChains.get(rowKey) || Promise.resolve(true)
  payload.row._saving = true
  payload.row._savingFieldKey = payload.field.fieldKey
  // 同一行的请求必须串行执行，后一项会使用前一项返回的最新 version 和完整行数据。
  const task = previous.then(() => saveCell(payload))
  rowSaveChains.set(rowKey, task)
  pendingSaves.add(task)
  task.finally(() => {
    pendingSaves.delete(task)
    if (rowSaveChains.get(rowKey) === task) {
      rowSaveChains.delete(rowKey)
      payload.row._saving = false
      payload.row._savingFieldKey = null
    }
  })
}

async function saveCell({ row, field, value, originalValue }) {
  if (sameValue(value, originalValue)) return true
  // 草稿先保留用户输入，必填空值由单元格浅红背景提示，统一在保存新增时拦截。
  if (row._isDraft) {
    row[field.fieldKey] = cloneValue(value)
    return true
  }

  const message = validateField(field, value)
  if (message) {
    // 清空必填字段也会走到这里，必须给出提示，否则用户只会看到值无声回退。
    proxy.$modal.msgError(message)
    return false
  }

  try {
    // 后端按动态表完整字段执行更新，因此合并当前单元格后提交整行，避免其它列被覆盖为空。
    const data = buildRowData(row, field.fieldKey, value)
    const response = await updateDynamicRecord(props.schema.tableCode, {
      recordId: row._recordId,
      version: row._version,
      status: row._status,
      data
    })
    replaceWithServerRecord(row, response.data, field.fieldKey, value)
    return true
  } catch {
    // 全局请求拦截器负责展示后端错误；当前行保持服务端保存前的值。
    return false
  }
}

async function flushEditing() {
  await dynamicTableRef.value?.finishEdit()
  if (pendingSaves.size) await Promise.all([...pendingSaves])
}

async function saveDraft(row) {
  // 新增行在浏览器内暂存，用户确认保存前不会产生逐单元格网络请求。
  await dynamicTableRef.value?.finishEdit(row)

  for (const field of activeFields.value) {
    const message = validateField(field, row[field.fieldKey])
    if (!message) continue
    if (field.required && isEmpty(row[field.fieldKey])) {
      await nextTick()
      await dynamicTableRef.value?.startEdit(row, field.fieldKey)
      return
    }
    return proxy.$modal.msgError(message)
  }

  row._saving = true
  try {
    const response = await addDynamicRecord(props.schema.tableCode, { data: buildRowData(row) })
    if (response.data?.recordId) {
      // 保留 VXE Table 当前行引用，只把草稿内容就地转换为服务端正式记录。
      replaceWithServerRecord(row, response.data)
      total.value += 1
    } else {
      await loadRecords()
    }
    proxy.$modal.msgSuccess('新增成功')
  } finally {
    row._saving = false
  }
}

async function cancelDraft(row) {
  const clientId = row._clientId
  await dynamicTableRef.value?.cancelEdit(row)
  // 更换数组引用，确保 VXE Table 立即移除草稿；clientId 兼容组件返回代理行的情况。
  rows.value = rows.value.filter(item => item !== row && item._clientId !== clientId)
}

function buildRowData(row, overrideKey, overrideValue) {
  const data = {}
  activeFields.value.forEach(field => {
    const value = field.fieldKey === overrideKey ? overrideValue : row[field.fieldKey]
    if (value !== undefined) data[field.fieldKey] = cloneValue(value)
  })
  return data
}

function replaceWithServerRecord(row, record, fallbackKey, fallbackValue) {
  // 优先采用服务端返回的新版本号，保证下一次编辑继续参与乐观锁校验。
  if (record?.recordId) {
    const clientId = row._clientId
    const saving = row._saving
    const savingFieldKey = row._savingFieldKey
    const mapped = mapRecord(record)
    Object.keys(row).forEach(key => delete row[key])
    // 行对象及 key 都保持稳定，避免 VXE Table 继续缓存草稿插槽。
    Object.assign(row, mapped, { _clientId: clientId, _saving: saving, _savingFieldKey: savingFieldKey })
    return
  }
  row[fallbackKey] = cloneValue(fallbackValue)
  row._version += 1
}

async function handleDelete(row) {
  try {
    await proxy.$modal.confirm('确定删除这条动态数据吗？')
  } catch {
    return
  }
  await dynamicTableRef.value?.cancelEdit(row)
  await deleteDynamicRecord(props.schema.tableCode, row._recordId, row._version)
  proxy.$modal.msgSuccess('删除成功')
  await loadRecords()
}

function validateField(field, value) {
  if (field.required && isEmpty(value)) return `${field.fieldLabel}不能为空`
  if (isEmpty(value)) return ''
  const rule = parseJson(field.validationJson, {})
  const comparable = ['INTEGER', 'DECIMAL'].includes(field.dataType) ? Number(value) : String(value).length
  if (rule.len !== undefined && comparable !== Number(rule.len)) return rule.message || `${field.fieldLabel}长度不正确`
  if (rule.min !== undefined && comparable < Number(rule.min)) return rule.message || `${field.fieldLabel}不能小于${rule.min}`
  if (rule.max !== undefined && comparable > Number(rule.max)) return rule.message || `${field.fieldLabel}不能大于${rule.max}`
  if (rule.pattern) {
    try {
      if (!new RegExp(rule.pattern).test(String(value))) return rule.message || `${field.fieldLabel}格式不正确`
    } catch {
      return `${field.fieldLabel}的正则校验配置无效`
    }
  }
  return ''
}

function defaultValueOf(field) {
  if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {
    if (field.dataType === 'BOOLEAN') return ['true', '1'].includes(String(field.defaultValue).toLowerCase())
    if (['INTEGER', 'DECIMAL'].includes(field.dataType)) return Number(field.defaultValue)
    if (field.dataType === 'JSON') return parseJson(field.defaultValue, [])
    return field.defaultValue
  }
  if (field.dataType === 'BOOLEAN') return false
  if (field.dataType === 'JSON') return []
  return undefined
}

function parseJson(value, fallback) {
  if (!value) return fallback
  try { return typeof value === 'string' ? JSON.parse(value) : value } catch { return fallback }
}

function isEmpty(value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)
}

function cloneValue(value) {
  if (value === undefined || value === null || typeof value !== 'object') return value
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value))
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

watch(() => props.schema.tableId, () => {
  searchModel.value = {}
  query.pageNum = 1
  loadRecords()
}, { immediate: true })
</script>

<style scoped>
.search-panel { padding: 18px 18px 8px; margin-bottom: 16px; background: var(--el-fill-color-extra-light); border-radius: 8px; }
.search-actions { display: flex; justify-content: flex-end; margin: -8px 0 8px; }
.data-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.data-toolbar strong { margin-right: 10px; font-size: 16px; }
.data-toolbar span { color: var(--el-text-color-secondary); font-size: 12px; }
.data-toolbar small { margin-left: 14px; color: var(--el-text-color-placeholder); font-size: 12px; }
</style>
