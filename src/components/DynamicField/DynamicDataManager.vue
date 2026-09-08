<template>
  <div class="dynamic-data-manager">
    <div v-if="searchFields.length" class="search-panel">
      <dynamic-form
        v-model="searchModel"
        :fields="displayedSearchFields"
        :dict-options="dictOptions"
        :columns="4"
        :ignore-custom-span="true"
      />
      <div class="search-actions">
        <el-button type="primary" icon="Search" :loading="loadAction === 'query'" :disabled="loading" @click="handleQuery">查询</el-button>
        <el-button icon="Refresh" :loading="loadAction === 'reset'" :disabled="loading" @click="resetQuery">重置</el-button>
        <el-button
          v-if="searchFields.length > SEARCH_FOLD_LIMIT"
          link
          type="primary"
          class="expand-btn"
          @click="searchExpanded = !searchExpanded"
        >
          <span>{{ searchExpanded ? '收起' : '展开' }}</span>
          <el-icon class="el-icon--right">
            <component :is="searchExpanded ? ArrowUp : ArrowDown" />
          </el-icon>
        </el-button>
      </div>
    </div>

    <div class="data-toolbar">
      <div>
        <strong>{{ schema.tableName }}</strong><span>动态数据</span>
        <small>点击单元格按需加载控件，失去焦点自动保存，Esc 取消</small>
      </div>
      <el-button type="primary" icon="Plus" :disabled="loading" @click="handleAdd" v-hasPermi="['system:dynamic:data:add']">
        表格内新增
      </el-button>
    </div>

    <div class="table-container">
      <dynamic-table
        ref="dynamicTableRef"
        height="100%"
        :fields="schema.fields"
        :data="rows"
        :dict-options="dictOptions"
        :loading="loading"
        :editable="canEditCell"
        :show-row-number="schema.showRowNumber"
        :sequence-start="(query.pageNum - 1) * query.pageSize"
        :default-sort-field="schema.defaultSortField || ''"
        :default-sort-order="schema.defaultSortOrder || 'desc'"
        @sort-change="handleSort"
        @cell-change="handleCellChange"
      >
        <template #version="{ row }">{{ row._isDraft ? '-' : row._version }}</template>
        <template #actions="{ row }">
            <template v-if="row._isDraft">
              <el-button link type="primary" icon="Check" :loading="row._submitting" :disabled="row._submitting" @mousedown.prevent.stop @click.stop="saveDraft(row)">
                保存新增
              </el-button>
              <el-button link icon="Close" :disabled="row._submitting" @mousedown.prevent.stop @click.stop="cancelDraft(row)">取消</el-button>
            </template>
            <template v-else>
              <el-button link type="danger" icon="Delete" :loading="row._deleting" :disabled="row._saving || row._deleting" @click.stop="handleDelete(row)" v-hasPermi="['system:dynamic:data:remove']">
                删除
              </el-button>
            </template>
        </template>
      </dynamic-table>
    </div>
    <div class="pagination-container">
      <pagination
        v-show="total > 0"
        :total="total"
        v-model:page="query.pageNum"
        v-model:limit="query.pageSize"
        :page-sizes="[10, 20, 30, 50, 100, 200, 500]"
        :disabled="loading"
        @pagination="loadRecords"
      />
    </div>
  </div>
</template>

<script setup name="DynamicDataManager">
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import { parseJson, isEmpty, defaultValueOf, isTableFieldEditable } from '@/utils/dynamicField'
import DynamicTable from './DynamicTable.vue'
import DynamicForm from './DynamicForm.vue'
import { pageDynamicRecords, addDynamicRecord, updateDynamicRecord, deleteDynamicRecord } from '@/api/system/dynamicTable'

const props = defineProps({
  schema: { type: Object, required: true },
  dictOptions: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['ready'])

const { proxy } = getCurrentInstance()
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const searchModel = ref({})
const dynamicTableRef = ref()
const draftSequence = ref(0)
const loadAction = ref('')
const initialLoadPending = ref(true)
const pendingSaves = new Set()
const rowSaveChains = new Map()
const query = reactive({ pageNum: 1, pageSize: 20, sortField: '', sortOrder: 'desc' })

const SEARCH_FOLD_LIMIT = 8
const searchExpanded = ref(false)

const activeFields = computed(() => (props.schema.fields || [])
  .filter(field => field.status !== '1')
  .sort((a, b) => (a.sort || 0) - (b.sort || 0)))

const editableFields = computed(() => activeFields.value.filter(isTableFieldEditable))
const editableFieldKeys = computed(() => new Set(editableFields.value.map(field => field.fieldKey)))

const searchFields = computed(() => activeFields.value
  .filter(field => field.searchable)
  .map(field => ({
    ...field,
    required: false,
    defaultValue: '',
    validationJson: '{}',
    formVisible: true
  })))

const displayedSearchFields = computed(() => {
  if (searchFields.value.length <= SEARCH_FOLD_LIMIT || searchExpanded.value) {
    return searchFields.value
  }
  return searchFields.value.slice(0, SEARCH_FOLD_LIMIT)
})

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
  if (loading.value) return
  loading.value = true
  try {
    await flushEditing()
    const response = await pageDynamicRecords(props.schema.tableCode, { ...query, filters: buildFilters() })
    rows.value = (response.rows || []).map(mapRecord)
    total.value = response.total || 0
  } finally {
    loading.value = false
    if (initialLoadPending.value) {
      initialLoadPending.value = false
      emit('ready')
    }
  }
}

function mapRecord(record) {
  const recId = record.id ?? record.recordId
  return {
    ...(record.data || {}),
    _id: recId,
    _recordId: recId,
    _version: record.version,
    _status: record.status,
    _clientId: `record-${recId}`,
    _isDraft: false,
    _saving: false,
    _submitting: false,
    _deleting: false,
    _savingFieldKey: null
  }
}

async function handleQuery() {
  if (loading.value) return
  loadAction.value = 'query'
  query.pageNum = 1
  try {
    await loadRecords()
  } finally {
    loadAction.value = ''
  }
}

async function resetQuery() {
  if (loading.value) return
  loadAction.value = 'reset'
  searchModel.value = {}
  query.pageNum = 1
  try {
    await loadRecords()
  } finally {
    loadAction.value = ''
  }
}

async function handleSort({ prop, order }) {
  if (!order) {
    resetDefaultSort()
    await dynamicTableRef.value?.applySort(query.sortField, query.sortOrder)
  } else {
    query.sortField = prop
    query.sortOrder = order === 'ascending' ? 'asc' : 'desc'
  }
  loadRecords()
}

function resetDefaultSort() {
  const defaultField = activeFields.value.find(field => field.fieldKey === props.schema.defaultSortField
    && field.sortable)
  query.sortField = defaultField?.fieldKey || ''
  query.sortOrder = defaultField && props.schema.defaultSortOrder === 'asc' ? 'asc' : 'desc'
}

function canEditCell(row, field) {
  if (!editableFieldKeys.value.has(field.fieldKey) || row._submitting || row._deleting) return false
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
    _submitting: false,
    _deleting: false,
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
  if (!editableFieldKeys.value.has(payload.field.fieldKey)) return
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
  if (!editableFieldKeys.value.has(field.fieldKey)) return false
  if (sameValue(value, originalValue)) return true
  // 草稿先保留用户输入，必填空值由单元格浅红背景提示，统一在保存新增时拦截。
  if (row._isDraft) {
    row[field.fieldKey] = cloneValue(value)
    return true
  }

  // 基础字段校验（如强校验模式必填校验、长度限制、正则）
  const message = validateField(field, value)
  if (message) {
    proxy.$modal.msgError(message)
    row[field.fieldKey] = cloneValue(originalValue)
    return false
  }

  // 校验同行动行内互斥字段（值不能重复）
  const uniqueMessage = validateRowUnique(row, field, value)
  if (uniqueMessage) {
    proxy.$modal.msgError(uniqueMessage)
    return false
  }

  // 先在前端立即乐观更新，展示用户输入的新值，避免等待接口返回期间跳回旧值闪烁
  row[field.fieldKey] = cloneValue(value)

  try {
    // 单元格只提交当前字段，未编辑列由后端保留，避免触发其它列的必填校验。
    const data = { [field.fieldKey]: value === undefined || value === '' ? null : cloneValue(value) }
    const targetRecId = row._id ?? row._recordId
    const response = await updateDynamicRecord(props.schema.tableCode, {
      id: targetRecId,
      recordId: targetRecId,
      version: row._version,
      data
    })
    replaceWithServerRecord(row, response.data, field.fieldKey, value)
    return true
  } catch {
    // 全局请求拦截器负责展示后端错误；请求失败时回滚为原始值
    row[field.fieldKey] = cloneValue(originalValue)
    return false
  }
}

async function flushEditing() {
  await dynamicTableRef.value?.finishEdit()
  if (pendingSaves.size) await Promise.all([...pendingSaves])
}

async function saveDraft(row) {
  if (row._submitting) return
  row._submitting = true
  // 新增行在浏览器内暂存，用户确认保存前不会产生逐单元格网络请求。
  try {
    await dynamicTableRef.value?.finishEdit(row)

    for (const field of activeFields.value) {
      const message = validateField(field, row[field.fieldKey])
      if (!message) continue
      if (field.required && isEmpty(row[field.fieldKey])) {
        const mode = getFieldRequiredMode(field)
        if (mode === 'alert') {
          row._submitting = false
          await nextTick()
          await dynamicTableRef.value?.startEdit(row, field.fieldKey)
          return proxy.$modal.msgError(`【${field.fieldLabel}】为必填项，请填写`)
        }
      }
      return proxy.$modal.msgError(message)
    }

    // 校验整行是否存在同行互斥字段冲突
    const uniqueConflict = validateAllRowUnique(row)
    if (uniqueConflict) {
      row._submitting = false
      await nextTick()
      await dynamicTableRef.value?.startEdit(row, uniqueConflict.field.fieldKey)
      return proxy.$modal.msgError(uniqueConflict.error)
    }

    const response = await addDynamicRecord(props.schema.tableCode, { data: buildRowData(row) })
    if (response.data?.id || response.data?.recordId) {
      // 保留 VXE Table 当前行引用，只把草稿内容就地转换为服务端正式记录。
      replaceWithServerRecord(row, response.data)
      total.value += 1
    } else {
      await loadRecords()
    }
    proxy.$modal.msgSuccess('新增成功')
  } finally {
    row._submitting = false
  }
}

async function cancelDraft(row) {
  const clientId = row._clientId
  await dynamicTableRef.value?.cancelEdit(row)
  // 更换数组引用，确保 VXE Table 立即移除草稿；clientId 兼容组件返回代理行的情况。
  rows.value = rows.value.filter(item => item !== row && item._clientId !== clientId)
}

function buildRowData(row) {
  const data = {}
  activeFields.value.forEach(field => {
    const value = row[field.fieldKey]
    if (value !== undefined) data[field.fieldKey] = cloneValue(value)
  })
  return data
}

function replaceWithServerRecord(row, record, fallbackKey, fallbackValue) {
  // 优先采用服务端返回的新版本号，保证下一次编辑继续参与乐观锁校验。
  const recId = record?.id ?? record?.recordId
  if (recId) {
    if (record.data && typeof record.data === 'object') {
      Object.assign(row, record.data)
    }
    row._id = recId
    row._recordId = recId
    row._version = record.version
    row._status = record.status
    row._isDraft = false
    return
  }
  if (fallbackKey) {
    row[fallbackKey] = cloneValue(fallbackValue)
  }
  row._version = (row._version || 0) + 1
}

async function handleDelete(row) {
  if (row._deleting || row._saving) return
  row._deleting = true
  try {
    try {
      await proxy.$modal.confirm('确定删除这条动态数据吗？')
    } catch {
      return
    }
    await dynamicTableRef.value?.cancelEdit(row)
    const targetRecId = row._id ?? row._recordId
    await deleteDynamicRecord(props.schema.tableCode, targetRecId, row._version)
    proxy.$modal.msgSuccess('删除成功')
    await loadRecords()
  } finally {
    row._deleting = false
  }
}

function getFieldRequiredMode(field) {
  const validation = parseJson(field?.validationJson, {})
  return validation.requiredMode || 'color'
}

function validateField(field, value) {
  if (field.required && isEmpty(value)) {
    const mode = getFieldRequiredMode(field)
    return mode === 'alert' ? `【${field.fieldLabel}】为必填项，不能为空` : ''
  }
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

function validateRowUnique(row, field, value) {
  if (isEmpty(value)) return ''
  const validation = parseJson(field.validationJson, {})
  const uniqueKeys = validation.rowUniqueFields
  if (!Array.isArray(uniqueKeys) || !uniqueKeys.length) return ''

  for (const otherKey of uniqueKeys) {
    if (otherKey === field.fieldKey) continue
    const otherVal = row[otherKey]
    if (isEmpty(otherVal)) continue
    if (sameValue(value, otherVal)) {
      const otherField = activeFields.value.find(f => f.fieldKey === otherKey)
      const otherLabel = otherField?.fieldLabel || otherKey
      return `【${field.fieldLabel}】的值不能与同行的【${otherLabel}】重复`
    }
  }
  return ''
}

function validateAllRowUnique(row) {
  for (const field of activeFields.value) {
    const value = row[field.fieldKey]
    const err = validateRowUnique(row, field, value)
    if (err) {
      return { error: err, field }
    }
  }
  return null
}

function cloneValue(value) {
  if (value === undefined || value === null || typeof value !== 'object') return value
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value))
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

watch(() => props.schema?.id ?? props.schema?.tableId, () => {
  searchExpanded.value = false
  searchModel.value = {}
  query.pageNum = 1
  resetDefaultSort()
  loadRecords()
}, { immediate: true })

watch(searchExpanded, () => {
  nextTick(() => {
    dynamicTableRef.value?.recalculate()
  })
})
</script>

<style scoped>
.dynamic-data-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
}
.search-panel {
  flex-shrink: 0;
  padding: 16px 16px 6px;
  margin-bottom: 12px;
  background: var(--el-fill-color-extra-light);
  border-radius: 8px;
}
.search-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin: -4px 0 8px;
}
.expand-btn {
  margin-left: 4px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
}
.data-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.data-toolbar strong { margin-right: 10px; font-size: 16px; }
.data-toolbar span { color: var(--el-text-color-secondary); font-size: 12px; }
.data-toolbar small { margin-left: 14px; color: var(--el-text-color-placeholder); font-size: 12px; }

.table-container {
  flex: 1;
  min-height: 200px;
  position: relative;
  overflow: hidden;
}

.pagination-container {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  padding-top: 10px;
}
</style>
