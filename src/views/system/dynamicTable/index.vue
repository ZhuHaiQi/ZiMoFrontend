<template>
  <div class="app-container dynamic-designer">
    <div class="designer-header">
      <div>
        <h2>动态字段设计器</h2>
        <p>将数据类型、输入组件和展示规则组合为可复用的业务字段模型</p>
      </div>
      <el-button type="primary" icon="Plus" @click="handleAddTable" v-hasPermi="['system:dynamic:add']">新建动态表</el-button>
    </div>

    <div class="designer-body">
      <aside class="schema-sidebar">
        <el-input v-model="query.tableName" placeholder="搜索名称或编码" clearable prefix-icon="Search" @input="debouncedLoad" />
        <div class="schema-count">动态表 <span>{{ tableList.length }}</span></div>
        <el-scrollbar class="schema-scroll">
          <div
            v-for="item in tableList"
            :key="item.id || item.tableId"
            class="schema-card"
            :class="{ active: (selectedTable?.id || selectedTable?.tableId) === (item.id || item.tableId), disabled: detailLoading }"
            @click="selectTable(item)"
          >
            <div class="schema-icon"><el-icon><Grid /></el-icon></div>
            <div class="schema-info">
              <div class="schema-name">{{ item.tableName }}</div>
              <code>{{ item.tableCode }}</code>
            </div>
            <el-tag :type="item.status === '0' ? 'success' : 'info'" size="small" effect="plain">
              {{ item.status === '0' ? '启用' : '停用' }}
            </el-tag>
          </div>
          <el-empty v-if="!loading && !tableList.length" description="暂无动态表" :image-size="72" />
        </el-scrollbar>
      </aside>

      <main class="field-workspace" v-loading="detailLoading">
        <template v-if="selectedTable">
          <div class="workspace-header">
            <div class="title-block">
              <div class="title-line">
                <h3>{{ selectedTable.tableName }}</h3>
                <el-tag v-if="dirty" type="warning" size="small" effect="light">有未保存修改</el-tag>
              </div>
              <div class="schema-meta">
                <span>编码 <code>{{ selectedTable.tableCode }}</code></span>
                <span>{{ fields.length }} 个字段</span>
                <span>{{ selectedTable.tabs?.length || 0 }} 个 Tab</span>
                <span v-if="selectedTable.showRowNumber">显示序号列</span>
                <span v-if="selectedTable.defaultSortField">
                  默认按 {{ fieldLabel(selectedTable.defaultSortField) }}{{ selectedTable.defaultSortOrder === 'asc' ? '升序' : '降序' }}
                </span>
                <span v-if="selectedTable.remark">{{ selectedTable.remark }}</span>
              </div>
            </div>
            <div class="workspace-actions">
              <el-button icon="DataAnalysis" :loading="dataOpening" :disabled="dataOpening" @click="dataOpen = true" v-hasPermi="['system:dynamic:data:list']">数据管理</el-button>
              <el-button icon="View" @click="previewOpen = true">预览</el-button>
              <el-button icon="Collection" @click="openTabConfig" v-hasPermi="['system:dynamic:edit']">部门 Tab 配置</el-button>
              <el-dropdown trigger="click" :disabled="tableDeleting">
                <el-button icon="MoreFilled" circle :loading="tableDeleting" :disabled="tableDeleting" />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item icon="Edit" :disabled="tableDeleting" @click="handleEditTable" v-hasPermi="['system:dynamic:edit']">编辑动态表</el-dropdown-item>
                    <el-dropdown-item :icon="tableDeleting ? 'Loading' : 'Delete'" :disabled="tableDeleting" divided @click="handleDeleteTable" v-hasPermi="['system:dynamic:remove']">
                      {{ tableDeleting ? '删除中...' : '删除动态表' }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button type="primary" icon="Check" :disabled="!dirty || fieldsSaving" :loading="fieldsSaving" @click="saveFields" v-hasPermi="['system:dynamic:edit']">保存字段</el-button>
            </div>
          </div>

          <div class="field-toolbar">
            <div>
              <strong>字段列表</strong>
              <span>拖动左侧手柄调整显示顺序</span>
            </div>
            <el-button type="primary" plain icon="Plus" @click="handleAddField" v-hasPermi="['system:dynamic:edit']">添加字段</el-button>
          </div>

          <div class="field-table-head" v-if="fields.length">
            <span>字段</span><span>数据类型</span><span>组件</span><span>使用场景</span><span>状态</span><span>操作</span>
          </div>
          <el-scrollbar class="field-scroll">
            <draggable v-model="fields" item-key="_key" handle=".drag-handle" animation="180" @end="markReordered">
              <template #item="{ element, index }">
                <div class="field-row">
                  <div class="field-main">
                    <span class="drag-handle"><el-icon><Rank /></el-icon></span>
                    <div class="field-type-icon" :class="`type-${element.dataType.toLowerCase()}`">{{ typeShort(element.dataType) }}</div>
                    <div>
                      <div class="field-label"><span v-if="element.required" class="required">*</span>{{ element.fieldLabel }}</div>
                      <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px">
                        <code>{{ element.fieldKey }}</code>
                        <el-tag v-if="element.uniqueKey" size="small" type="warning" effect="light" style="font-family: monospace">
                          {{ element.uniqueKey }}
                        </el-tag>
                      </div>
                    </div>
                  </div>
                  <div><el-tag effect="plain">{{ typeLabel(element.dataType) }}</el-tag></div>
                  <div>
                    <div>{{ componentLabel(element) }}</div>
                    <code v-if="element.optionSource === 'DICT'">字典 · {{ element.dictType }}</code>
                    <code v-else-if="element.optionSource === 'API'">接口 · {{ parseJson(element.componentPropsJson, {}).apiConfig?.url || '动态接口' }}</code>
                    <div style="margin-top: 2px; display: flex; gap: 4px; flex-wrap: wrap">
                      <el-tag size="small" type="info" effect="plain">
                        {{ alignLabel(element.align) }}
                      </el-tag>
                      <el-tag v-if="parseJson(element.componentPropsJson, {}).tableEditable === false" size="small" type="info" effect="plain">
                        表格只读
                      </el-tag>
                      <el-tag v-if="element.required" size="small" :type="fieldRequiredMode(element) === 'alert' ? 'danger' : 'warning'" effect="plain">
                        {{ fieldRequiredMode(element) === 'alert' ? '必填·报错拦截' : '必填·颜色标记' }}
                      </el-tag>
                      <el-tag v-if="hasRowUnique(element)" size="small" type="warning" effect="plain" :title="rowUniqueTip(element)">
                        同行互斥
                      </el-tag>
                    </div>
                  </div>
                  <div class="usage-tags">
                    <el-tooltip content="列表展示"><el-icon :class="{ muted: element.listVisible === false }"><Tickets /></el-icon></el-tooltip>
                    <el-tooltip content="表单填写"><el-icon :class="{ muted: element.formVisible === false }"><EditPen /></el-icon></el-tooltip>
                    <el-tooltip content="可查询"><el-icon :class="{ muted: !element.searchable }"><Search /></el-icon></el-tooltip>
                    <el-tooltip content="可排序"><el-icon :class="{ muted: !element.sortable }"><Sort /></el-icon></el-tooltip>
                  </div>
                  <div><el-tag :type="element.status === '0' ? 'success' : 'info'" size="small">{{ element.status === '0' ? '启用' : '停用' }}</el-tag></div>
                  <div class="row-actions">
                    <el-button link type="primary" icon="Edit" @click="handleEditField(index)">编辑</el-button>
                    <el-button link type="danger" icon="Delete" @click="removeField(index)">删除</el-button>
                  </div>
                </div>
              </template>
            </draggable>
            <el-empty v-if="!fields.length" description="还没有字段，添加第一个字段开始设计">
              <el-button type="primary" @click="handleAddField">添加字段</el-button>
            </el-empty>
          </el-scrollbar>
        </template>

        <div v-else class="workspace-empty">
          <el-empty description="选择或新建一个动态表开始设计" :image-size="120">
            <el-button type="primary" @click="handleAddTable">新建动态表</el-button>
          </el-empty>
        </div>
      </main>
    </div>

    <el-dialog v-model="tableDialogOpen" :title="tableDialogMode === 'add' ? '新建动态表' : '编辑动态表'" width="600px" append-to-body>
      <el-form ref="tableFormRef" :model="tableForm" :rules="tableRules" label-width="90px">
        <el-form-item label="名称" prop="tableName"><el-input v-model="tableForm.tableName" placeholder="例如：客户扩展信息" /></el-form-item>
        <el-form-item label="唯一编码" prop="tableCode">
          <el-input v-model="tableForm.tableCode" placeholder="例如：customer_profile" :disabled="tableDialogMode === 'edit'" />
          <div class="form-tip">作为 API 和业务组件引用标识，创建后不建议修改</div>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="tableForm.status"><el-radio value="0">启用</el-radio><el-radio value="1">停用</el-radio></el-radio-group>
        </el-form-item>
        <el-divider content-position="left">列表设置</el-divider>
        <el-form-item label="序号列">
          <el-switch v-model="tableForm.showRowNumber" />
          <span class="inline-tip">开启后在列表左侧显示跨页连续序号，不作为业务数据保存。</span>
        </el-form-item>
        <el-form-item label="说明"><el-input v-model="tableForm.remark" type="textarea" :rows="3" placeholder="说明这个字段集合会用在哪些业务场景" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="tableSubmitting" @click="tableDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="tableSubmitting" :disabled="tableSubmitting" @click="submitTable">确定</el-button>
      </template>
    </el-dialog>

    <dynamic-field-drawer
      v-model="fieldDrawerOpen"
      :field="fieldToEdit"
      :fields="fields"
      :catalog="catalog"
      @apply="applyField"
    />

    <dynamic-tab-drawer
      v-model="tabDrawerOpen"
      :tabs="selectedTable?.tabs || []"
      :department-tabs="selectedTable?.departmentTabs || []"
      :fields="fields"
      :departments="departmentOptions"
      :saving="tabsSaving"
      @save="saveTabs"
    />

    <el-drawer v-model="previewOpen" title="实时预览" size="76%" append-to-body>
      <el-tabs v-model="previewTab">
        <el-tab-pane label="表单预览" name="form">
          <div class="preview-card"><dynamic-form v-model="previewModel" :fields="fields" :dict-options="dictOptionMap" /></div>
        </el-tab-pane>
        <el-tab-pane label="表格预览" name="table">
          <div class="preview-card">
            <dynamic-table
              :fields="fields"
              :data="previewRows"
              :dict-options="dictOptionMap"
              :show-row-number="selectedTable.showRowNumber"
              :default-sort-field="selectedTable.defaultSortField || ''"
              :default-sort-order="selectedTable.defaultSortOrder || 'desc'"
            />
          </div>
        </el-tab-pane>
        <el-tab-pane label="Schema JSON" name="schema">
          <pre class="schema-json">{{ JSON.stringify({ ...selectedTable, fields: cleanFields(fields) }, null, 2) }}</pre>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>

    <dynamic-data-drawer
      v-model="dataOpen"
      v-model:loading="dataOpening"
      :schema="selectedTable ? { ...selectedTable, fields } : null"
      :dict-options="dictOptionMap"
    />
  </div>
</template>

<script setup name="DynamicTableDesigner">
import draggable from 'vuedraggable'
import DynamicTable from '@/components/DynamicField/DynamicTable.vue'
import DynamicForm from '@/components/DynamicField/DynamicForm.vue'
import DynamicFieldDrawer from '@/components/DynamicField/DynamicFieldDrawer.vue'
import DynamicTabDrawer from '@/components/DynamicField/DynamicTabDrawer.vue'
import DynamicDataDrawer from '@/components/DynamicField/DynamicDataDrawer.vue'
import {
  listDynamicTables, getDynamicTable, getDynamicFieldCatalog, addDynamicTable,
  updateDynamicTable, saveDynamicFields, deleteDynamicTable, getDynamicDictOptions,
  getDynamicDepartmentOptions, saveDynamicTabs, checkTableCodeUnique
} from '@/api/system/dynamicTable'

import { parseJson } from '@/utils/dynamicField'

const { proxy } = getCurrentInstance()
const loading = ref(false)
const detailLoading = ref(false)
const tableList = ref([])
const selectedTable = ref(null)
const fields = ref([])
const catalog = ref([])
const dictOptionMap = ref({})
const dirty = ref(false)
const query = reactive({ pageNum: 1, pageSize: 100, tableName: '' })
let searchTimer
const tableDialogOpen = ref(false)
const tableDialogMode = ref('add')
const tableFormRef = ref()
const tableSubmitting = ref(false)
const tableDeleting = ref(false)
const fieldsSaving = ref(false)
const tabDrawerOpen = ref(false)
const tabsSaving = ref(false)
const departmentOptions = ref([])
const tableForm = reactive(defaultTable())

const validateTableCode = async (rule, value, callback) => {
  if (!value) return callback()
  const code = value.trim().toLowerCase()
  const currentId = tableForm.id || tableForm.tableId
  // 1. 本地已有表格列表排重
  const isDuplicateInList = tableList.value.some(item => {
    const itemId = item.id || item.tableId
    return item.tableCode?.toLowerCase() === code && itemId !== currentId
  })
  if (isDuplicateInList) {
    return callback(new Error(`动态表唯一编码“${code}”已存在`))
  }
  // 2. 服务端实时唯一性校验
  try {
    const res = await checkTableCodeUnique({ tableCode: code, id: currentId })
    if (res.data === false) {
      return callback(new Error(`动态表唯一编码“${code}”已存在`))
    }
    callback()
  } catch (err) {
    callback()
  }
}

const tableRules = {
  tableName: [{ required: true, message: '名称不能为空', trigger: 'blur' }],
  tableCode: [
    { required: true, message: '编码不能为空', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_]*$/, message: '请使用小写字母开头的小写字母、数字和下划线', trigger: 'blur' },
    { validator: validateTableCode, trigger: 'blur' }
  ]
}

const fieldDrawerOpen = ref(false)
const fieldToEdit = ref(null)
const defaultSortFields = computed(() => fields.value.filter(field => field.status !== '1' && field.sortable))

function fieldRequiredMode(field) {
  return parseJson(field?.validationJson, {}).requiredMode || 'color'
}

const previewOpen = ref(false)
const previewTab = ref('form')
const previewModel = ref({})
const dataOpen = ref(false)
const dataOpening = ref(false)
const previewRows = computed(() => [0, 1, 2].map(rowIndex => {
  const row = { _clientId: `preview-${rowIndex}` }
  fields.value.forEach(field => { row[field.fieldKey] = sampleValue(field, rowIndex) })
  return row
}))

async function loadCatalog() {
  const response = await getDynamicFieldCatalog()
  catalog.value = response.data || []
}

async function loadSchemaDictOptions(fieldList = fields.value) {
  const types = [...new Set(fieldList.filter(field => field.optionSource === 'DICT' && field.dictType).map(field => field.dictType))]
  if (!types.length) {
    dictOptionMap.value = {}
    return
  }
  const response = await getDynamicDictOptions(types)
  dictOptionMap.value = response.data || {}
}

async function loadTables(preferredCode) {
  loading.value = true
  try {
    const response = await listDynamicTables(query)
    tableList.value = response.rows || []
    if (preferredCode) {
      const target = tableList.value.find(item => item.tableCode === preferredCode)
      if (target) await selectTable(target, true)
    } else if (!selectedTable.value && tableList.value.length) {
      await selectTable(tableList.value[0], true)
    }
  } finally { loading.value = false }
}

function debouncedLoad() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadTables(), 250)
}

async function selectTable(item, force = false) {
  if (detailLoading.value) return
  const currentId = selectedTable.value?.id || selectedTable.value?.tableId
  const itemId = item.id || item.tableId
  if (!force && currentId === itemId) return
  detailLoading.value = true
  try {
    if (!force && dirty.value) {
      try { await proxy.$modal.confirm('当前字段有未保存修改，确定放弃并切换吗？') } catch { return }
    }
    const response = await getDynamicTable(itemId)
    selectedTable.value = response.data
    fields.value = (response.data.fields || []).map((field, index) => ({ ...field, _key: field.id || field.fieldId || `${Date.now()}-${index}` }))
    await loadSchemaDictOptions(fields.value)
    dirty.value = false
    previewModel.value = {}
  } finally { detailLoading.value = false }
}

function handleAddTable() {
  if (dirty.value) return proxy.$modal.msgWarning('请先保存当前字段配置，再新建动态表')
  tableDialogMode.value = 'add'
  Object.assign(tableForm, defaultTable())
  tableDialogOpen.value = true
  nextTick(() => tableFormRef.value?.clearValidate())
}

function handleEditTable() {
  if (dirty.value) return proxy.$modal.msgWarning('请先保存字段配置，再修改列表设置')
  tableDialogMode.value = 'edit'
  Object.assign(tableForm, defaultTable(), selectedTable.value)
  tableDialogOpen.value = true
  nextTick(() => tableFormRef.value?.clearValidate())
}

async function submitTable() {
  if (tableSubmitting.value) return
  tableSubmitting.value = true
  try {
    const valid = await tableFormRef.value.validate().catch(() => false)
    if (!valid) return
    const targetId = tableForm.id || tableForm.tableId
    const payload = {
      id: targetId,
      tableId: targetId,
      tableName: tableForm.tableName,
      tableCode: tableForm.tableCode,
      showRowNumber: tableForm.showRowNumber,
      defaultSortField: tableForm.defaultSortField || null,
      defaultSortOrder: tableForm.defaultSortOrder,
      status: tableForm.status,
      remark: tableForm.remark
    }
    if (tableDialogMode.value === 'add') await addDynamicTable(payload)
    else await updateDynamicTable(payload)
    proxy.$modal.msgSuccess(tableDialogMode.value === 'add' ? '创建成功' : '修改成功')
    tableDialogOpen.value = false
    selectedTable.value = null
    dirty.value = false
    await loadTables(payload.tableCode)
  } finally {
    tableSubmitting.value = false
  }
}

async function handleDeleteTable() {
  if (tableDeleting.value) return
  tableDeleting.value = true
  try {
    try { await proxy.$modal.confirm(`确定删除动态表“${selectedTable.value.tableName}”及其全部字段、Tab 配置吗？`) } catch { return }
    await deleteDynamicTable(selectedTable.value.id || selectedTable.value.tableId)
    proxy.$modal.msgSuccess('删除成功')
    selectedTable.value = null
    fields.value = []
    dirty.value = false
    await loadTables()
  } finally {
    tableDeleting.value = false
  }
}

function defaultTable() {
  return {
    id: undefined,
    tableId: undefined,
    tableName: '',
    tableCode: '',
    showRowNumber: false,
    defaultSortField: '',
    defaultSortOrder: 'desc',
    status: '0',
    remark: ''
  }
}

function hasRowUnique(field) {
  const rule = parseJson(field?.validationJson, {})
  return Array.isArray(rule.rowUniqueFields) && rule.rowUniqueFields.length > 0
}

function rowUniqueTip(field) {
  const rule = parseJson(field?.validationJson, {})
  const keys = rule.rowUniqueFields || []
  const labels = keys.map(k => fieldLabel(k))
  return `同行值不能与 [${labels.join(', ')}] 重复`
}

async function removeField(index) {
  try { await proxy.$modal.confirm(`确定删除字段“${fields.value[index].fieldLabel}”吗？`) } catch { return }
  fields.value.splice(index, 1)
  normalizeSort()
  dirty.value = true
}

function markReordered() { normalizeSort(); dirty.value = true }

function normalizeSort() { fields.value.forEach((field, index) => { field.sort = index + 1 }) }

function cleanFields(items) {
  return items.map(({ _key, ...field }, index) => ({
    ...field,
    align: field.align || 'center',
    id: undefined,
    fieldId: undefined,
    sort: index + 1
  }))
}

function alignLabel(align) {
  if (align === 'left') return '居左'
  if (align === 'right') return '居右'
  return '居中'
}

async function saveFields() {
  if (fieldsSaving.value) return
  fieldsSaving.value = true
  try {
    await saveDynamicFields(selectedTable.value.id || selectedTable.value.tableId, cleanFields(fields.value))
    proxy.$modal.msgSuccess('字段配置已保存')
    await selectTable(selectedTable.value, true)
  } finally {
    fieldsSaving.value = false
  }
}

async function openTabConfig() {
  if (dirty.value) return proxy.$modal.msgWarning('请先保存字段配置，再配置 Tab')
  if (!departmentOptions.value.length) {
    const response = await getDynamicDepartmentOptions()
    departmentOptions.value = response.data || []
  }
  tabDrawerOpen.value = true
}

async function saveTabs(departments) {
  if (tabsSaving.value) return
  tabsSaving.value = true
  try {
    await saveDynamicTabs(selectedTable.value.id || selectedTable.value.tableId, departments)
    proxy.$modal.msgSuccess('部门 Tab 和字段配置已保存')
    tabDrawerOpen.value = false
    await selectTable(selectedTable.value, true)
  } finally {
    tabsSaving.value = false
  }
}

function typeLabel(dataType) { return catalog.value.find(item => item.value === dataType)?.label || dataType }

function componentLabel(field) { return catalog.value.find(item => item.value === field.dataType)?.components?.find(item => item.value === field.componentType)?.label || field.componentType }

function fieldLabel(fieldKey) { return fields.value.find(field => field.fieldKey === fieldKey)?.fieldLabel || fieldKey }

function typeShort(type) { return ({ STRING: 'Aa', TEXT: 'Tx', INTEGER: '12', DECIMAL: '.0', BOOLEAN: '01', DATE: '日', DATETIME: '时', JSON: '{}' })[type] || '?' }

function sampleValue(field, rowIndex) {
  const options = parseJson(field.optionsJson, [])
  const resolvedOptions = field.optionSource === 'DICT' ? (dictOptionMap.value[field.dictType] || []) : options
  if (field.dataType === 'BOOLEAN') return rowIndex % 2 === 0
  if (field.dataType === 'INTEGER') return 12 + rowIndex
  if (field.dataType === 'DECIMAL') return 19.9 + rowIndex
  if (field.dataType === 'DATE') return `2026-09-0${rowIndex + 1}`
  if (field.dataType === 'DATETIME') return `2026-09-0${rowIndex + 1} 10:30:00`
  if (field.dataType === 'JSON') return resolvedOptions.slice(0, Math.min(rowIndex + 1, 2)).map(item => item.value)
  if (resolvedOptions.length) return resolvedOptions[rowIndex % resolvedOptions.length].value
  if (field.componentType === 'color-picker') return ['#409eff', '#67c23a', '#e6a23c'][rowIndex]
  return `${field.fieldLabel}示例 ${rowIndex + 1}`
}

onMounted(async () => {
  await loadCatalog()
  await loadTables()
})

function handleAddField() {
  fieldToEdit.value = null
  fieldDrawerOpen.value = true
}

function handleEditField(index) {
  fieldToEdit.value = fields.value[index]
  fieldDrawerOpen.value = true
}

async function applyField(field) {
  const index = fieldToEdit.value ? fields.value.indexOf(fieldToEdit.value) : -1
  const nextField = { ...field, _key: index < 0 ? Date.now() + '-' + Math.random() : fields.value[index]._key }
  if (index < 0) fields.value.push(nextField)
  else fields.value.splice(index, 1, nextField)
  normalizeSort()
  dirty.value = true
  await loadSchemaDictOptions()
}
</script>

<style scoped lang="scss">
.dynamic-designer { min-height: calc(100vh - 84px); background: #f5f7fa; }
.designer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.designer-header h2 { margin: 0 0 6px; font-size: 22px; color: var(--el-text-color-primary); }
.designer-header p { margin: 0; color: var(--el-text-color-secondary); font-size: 13px; }
.designer-body { display: grid; grid-template-columns: 290px minmax(0, 1fr); height: calc(100vh - 176px); min-height: 590px; background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); border-radius: 10px; overflow: hidden; box-shadow: 0 5px 18px rgb(0 0 0 / 4%); }
.schema-sidebar { padding: 18px 14px 0; border-right: 1px solid var(--el-border-color-lighter); background: var(--el-fill-color-extra-light); overflow: hidden; display: flex; flex-direction: column; }
.schema-count { padding: 18px 4px 10px; color: var(--el-text-color-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
.schema-count span { float: right; }
.schema-scroll { flex: 1; }
.schema-card { display: flex; align-items: center; gap: 10px; padding: 11px 10px; margin-bottom: 6px; border: 1px solid transparent; border-radius: 8px; cursor: pointer; transition: all .18s; }
.schema-card:hover { background: var(--el-bg-color); border-color: var(--el-border-color-light); }
.schema-card.active { background: var(--el-color-primary-light-9); border-color: var(--el-color-primary-light-5); }
.schema-card.disabled { pointer-events: none; opacity: .7; }
.schema-icon { width: 34px; height: 34px; display: grid; place-items: center; flex: none; color: var(--el-color-primary); background: var(--el-color-primary-light-8); border-radius: 8px; }
.schema-info { min-width: 0; flex: 1; }
.schema-name { color: var(--el-text-color-primary); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
code { color: var(--el-text-color-secondary); font-family: Consolas, monospace; font-size: 12px; }
.field-workspace { min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.workspace-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--el-border-color-lighter); }
.title-line { display: flex; align-items: center; gap: 10px; }
.title-line h3 { margin: 0; font-size: 19px; }
.schema-meta { display: flex; gap: 18px; margin-top: 8px; color: var(--el-text-color-secondary); font-size: 12px; }
.workspace-actions { display: flex; align-items: center; gap: 9px; }
.field-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; }
.field-toolbar strong { margin-right: 12px; }
.field-toolbar span { color: var(--el-text-color-secondary); font-size: 12px; }
.field-table-head, .field-row { display: grid; grid-template-columns: minmax(260px, 1.5fr) 120px 130px 150px 80px 145px; align-items: center; column-gap: 12px; }
.field-table-head { padding: 9px 24px; color: var(--el-text-color-secondary); background: var(--el-fill-color-light); border-block: 1px solid var(--el-border-color-lighter); font-size: 12px; }
.field-scroll { flex: 1; }
.field-row { min-height: 70px; padding: 8px 24px; border-bottom: 1px solid var(--el-border-color-lighter); transition: background .15s; }
.field-row:hover { background: var(--el-fill-color-extra-light); }
.field-main { display: flex; align-items: center; min-width: 0; gap: 11px; }
.drag-handle { color: var(--el-text-color-placeholder); cursor: grab; }
.drag-handle:active { cursor: grabbing; }
.field-type-icon { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border-radius: 8px; font: 600 12px Consolas; color: #409eff; background: #ecf5ff; }
.type-integer, .type-decimal { color: #e6a23c; background: #fdf6ec; }
.type-boolean { color: #67c23a; background: #f0f9eb; }
.type-date, .type-datetime { color: #9b6ad6; background: #f5effc; }
.type-json { color: #f56c6c; background: #fef0f0; }
.field-label { font-weight: 600; line-height: 22px; }
.required { margin-right: 3px; color: var(--el-color-danger); }
.usage-tags { display: flex; gap: 11px; color: var(--el-color-primary); font-size: 17px; }
.usage-tags .muted { color: var(--el-text-color-placeholder); opacity: .45; }
.row-actions { white-space: nowrap; }
.workspace-empty { flex: 1; display: grid; place-items: center; }
.form-tip { margin-top: 5px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.5; }
.inline-tip { margin-left: 10px; color: var(--el-text-color-secondary); font-size: 12px; }
.two-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.preview-card { padding: 24px; border: 1px solid var(--el-border-color-lighter); border-radius: 9px; background: var(--el-bg-color); }
.schema-json { min-height: 420px; margin: 0; padding: 20px; overflow: auto; color: #d7dae0; background: #1e1f22; border-radius: 8px; font: 13px/1.65 Consolas, monospace; }
@media (max-width: 1100px) {
  .designer-body { grid-template-columns: 240px minmax(760px, 1fr); overflow: auto; }
  .workspace-header { align-items: flex-start; }
  .workspace-actions { flex-wrap: wrap; justify-content: flex-end; }
}
</style>
