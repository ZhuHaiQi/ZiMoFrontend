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
            :key="item.tableId"
            class="schema-card"
            :class="{ active: selectedTable?.tableId === item.tableId }"
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
                <span v-if="selectedTable.remark">{{ selectedTable.remark }}</span>
              </div>
            </div>
            <div class="workspace-actions">
              <el-button icon="DataAnalysis" @click="dataOpen = true" v-hasPermi="['system:dynamic:data:list']">数据管理</el-button>
              <el-button icon="View" @click="previewOpen = true">预览</el-button>
              <el-dropdown trigger="click">
                <el-button icon="MoreFilled" circle />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item icon="Edit" @click="handleEditTable" v-hasPermi="['system:dynamic:edit']">编辑动态表</el-dropdown-item>
                    <el-dropdown-item icon="Delete" divided @click="handleDeleteTable" v-hasPermi="['system:dynamic:remove']">删除动态表</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button type="primary" icon="Check" :disabled="!dirty" @click="saveFields" v-hasPermi="['system:dynamic:edit']">保存字段</el-button>
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
                      <code>{{ element.fieldKey }}</code>
                    </div>
                  </div>
                  <div><el-tag effect="plain">{{ typeLabel(element.dataType) }}</el-tag></div>
                  <div>
                    <div>{{ componentLabel(element) }}</div>
                    <code v-if="element.optionSource === 'DICT'">字典 · {{ element.dictType }}</code>
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

    <el-dialog v-model="tableDialogOpen" :title="tableDialogMode === 'add' ? '新建动态表' : '编辑动态表'" width="520px" append-to-body>
      <el-form ref="tableFormRef" :model="tableForm" :rules="tableRules" label-width="90px">
        <el-form-item label="名称" prop="tableName"><el-input v-model="tableForm.tableName" placeholder="例如：客户扩展信息" /></el-form-item>
        <el-form-item label="唯一编码" prop="tableCode">
          <el-input v-model="tableForm.tableCode" placeholder="例如：customer_profile" :disabled="tableDialogMode === 'edit'" />
          <div class="form-tip">作为 API 和业务组件引用标识，创建后不建议修改</div>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="tableForm.status"><el-radio value="0">启用</el-radio><el-radio value="1">停用</el-radio></el-radio-group>
        </el-form-item>
        <el-form-item label="说明"><el-input v-model="tableForm.remark" type="textarea" :rows="3" placeholder="说明这个字段集合会用在哪些业务场景" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="tableDialogOpen = false">取消</el-button><el-button type="primary" @click="submitTable">确定</el-button></template>
    </el-dialog>

    <el-drawer v-model="fieldDrawerOpen" :title="editingFieldIndex < 0 ? '添加字段' : '编辑字段'" size="560px" append-to-body destroy-on-close>
      <el-form ref="fieldFormRef" :model="fieldForm" :rules="fieldRules" label-position="top">
        <div class="two-columns">
          <el-form-item label="字段名称" prop="fieldLabel"><el-input v-model="fieldForm.fieldLabel" placeholder="例如：客户等级" /></el-form-item>
          <el-form-item label="字段标识" prop="fieldKey"><el-input v-model="fieldForm.fieldKey" placeholder="例如：customer_level" /></el-form-item>
        </div>
        <div class="two-columns">
          <el-form-item label="数据类型" prop="dataType">
            <el-select v-model="fieldForm.dataType" style="width: 100%" @change="handleDataTypeChange">
              <el-option v-for="item in catalog" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="组件类型" prop="componentType">
            <el-select v-model="fieldForm.componentType" style="width: 100%" @change="handleComponentChange">
              <el-option v-for="item in availableComponents" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
        </div>
        <el-alert title="数据类型决定值的语义，组件类型决定编辑方式；仅展示兼容组合。" type="info" :closable="false" show-icon class="field-alert" />
        <div v-if="isChoiceComponent" class="source-config">
          <div class="section-title"><span>选项来源</span></div>
          <el-radio-group v-model="fieldForm.optionSource" @change="handleOptionSourceChange">
            <el-radio-button value="STATIC">自定义选项</el-radio-button>
            <el-radio-button value="DICT">系统字典</el-radio-button>
          </el-radio-group>
          <el-select
            v-if="fieldForm.optionSource === 'DICT'"
            v-model="fieldForm.dictType"
            filterable
            clearable
            placeholder="请选择字典类型"
            style="width: 100%; margin-top: 12px"
            @change="loadCurrentDictOptions"
            @clear="handleDictTypeClear"
          >
            <el-option v-for="dict in dictTypes" :key="dict.dictType" :label="`${dict.dictName}（${dict.dictType}）`" :value="dict.dictType" />
          </el-select>
          <div v-if="fieldForm.optionSource === 'DICT'" class="form-tip">运行时通过批量接口读取若依字典缓存，字典修改后无需重新保存 Schema。</div>
        </div>
        <div class="two-columns">
          <el-form-item label="新增默认值">
            <el-select
              v-if="isChoiceComponent"
              v-model="choiceDefaultValue"
              :multiple="isMultiChoiceComponent"
              clearable
              placeholder="可选，请选择新增时的默认项"
              style="width: 100%"
            >
              <el-option v-for="option in currentChoiceOptions" :key="String(option.value)" :label="option.label" :value="option.value" />
            </el-select>
            <el-input v-else v-model="fieldForm.defaultValue" placeholder="可选，不填写则无默认值" />
            <div class="form-tip">新增数据时自动带入，只影响之后新增的记录，不修改已有数据。</div>
          </el-form-item>
          <el-form-item label="空值占位提示">
            <el-input v-model="fieldForm.placeholder" placeholder="例如：请选择用户性别" />
            <div class="form-tip">字段为空时显示的操作提示，仅用于界面展示，不会保存为业务数据。</div>
          </el-form-item>
        </div>

        <div v-if="isChoiceComponent && fieldForm.optionSource !== 'DICT'" class="option-editor">
          <div class="section-title"><span>选项配置</span><el-button link type="primary" icon="Plus" @click="addOption">添加选项</el-button></div>
          <div v-for="(option, index) in fieldOptions" :key="index" class="option-row">
            <el-input v-model="option.label" placeholder="显示名称" />
            <el-input v-model="option.value" placeholder="选项值" />
            <el-select v-model="option.type" clearable placeholder="颜色" style="width: 110px">
              <el-option label="成功" value="success" /><el-option label="警告" value="warning" />
              <el-option label="危险" value="danger" /><el-option label="信息" value="info" />
            </el-select>
            <el-button link type="danger" icon="Delete" @click="fieldOptions.splice(index, 1)" />
          </div>
          <el-empty v-if="!fieldOptions.length" description="暂无选项" :image-size="48" />
        </div>

        <div class="section-title"><span>使用场景</span></div>
        <div class="switch-grid">
          <label><span><b>必填</b><small>表单校验不能为空</small></span><el-switch v-model="fieldForm.required" /></label>
          <label v-if="isSelectComponent"><span><b>允许清空</b><small>显示清除当前选择的按钮</small></span><el-switch v-model="selectClearable" /></label>
          <label><span><b>列表展示</b><small>生成表格列</small></span><el-switch v-model="fieldForm.listVisible" /></label>
          <label><span><b>表单展示</b><small>生成编辑控件</small></span><el-switch v-model="fieldForm.formVisible" /></label>
          <label><span><b>支持查询</b><small>可生成查询条件</small></span><el-switch v-model="fieldForm.searchable" /></label>
          <label><span><b>支持排序</b><small>允许表格排序</small></span><el-switch v-model="fieldForm.sortable" /></label>
          <label><span><b>启用字段</b><small>停用后不参与渲染</small></span><el-switch v-model="fieldEnabled" /></label>
        </div>

        <div class="two-columns advanced-config">
          <el-form-item label="列宽"><el-input-number v-model="fieldForm.columnWidth" :min="80" :max="800" :step="10" style="width: 100%" /></el-form-item>
          <div />
          <el-form-item label="组件属性 JSON" prop="componentPropsJson">
            <el-input v-model="fieldForm.componentPropsJson" type="textarea" :rows="4" placeholder='例如：{"clearable":true,"span":12}' />
          </el-form-item>
          <el-form-item label="校验规则 JSON" prop="validationJson">
            <el-input v-model="fieldForm.validationJson" type="textarea" :rows="4" placeholder='例如：{"min":2,"max":20}' />
          </el-form-item>
        </div>
      </el-form>
      <template #footer><el-button @click="fieldDrawerOpen = false">取消</el-button><el-button type="primary" @click="submitField">应用字段</el-button></template>
    </el-drawer>

    <el-drawer v-model="previewOpen" title="实时预览" size="76%" append-to-body>
      <el-tabs v-model="previewTab">
        <el-tab-pane label="表单预览" name="form">
          <div class="preview-card"><dynamic-form v-model="previewModel" :fields="fields" :dict-options="dictOptionMap" /></div>
        </el-tab-pane>
        <el-tab-pane label="表格预览" name="table">
          <div class="preview-card"><dynamic-table :fields="fields" :data="previewRows" :dict-options="dictOptionMap" /></div>
        </el-tab-pane>
        <el-tab-pane label="Schema JSON" name="schema">
          <pre class="schema-json">{{ JSON.stringify({ ...selectedTable, fields: cleanFields(fields) }, null, 2) }}</pre>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>

    <el-drawer v-model="dataOpen" title="动态数据管理" size="88%" append-to-body destroy-on-close>
      <dynamic-data-manager v-if="dataOpen && selectedTable" :schema="{ ...selectedTable, fields }" :dict-options="dictOptionMap" />
    </el-drawer>
  </div>
</template>

<script setup name="DynamicTableDesigner">
import draggable from 'vuedraggable'
import DynamicTable from '@/components/DynamicField/DynamicTable.vue'
import DynamicForm from '@/components/DynamicField/DynamicForm.vue'
import DynamicDataManager from '@/components/DynamicField/DynamicDataManager.vue'
import { optionselect } from '@/api/system/dict/type'
import {
  listDynamicTables, getDynamicTable, getDynamicFieldCatalog, addDynamicTable,
  updateDynamicTable, saveDynamicFields, deleteDynamicTable, getDynamicDictOptions
} from '@/api/system/dynamicTable'

const { proxy } = getCurrentInstance()
const loading = ref(false)
const detailLoading = ref(false)
const tableList = ref([])
const selectedTable = ref(null)
const fields = ref([])
const catalog = ref([])
const dictTypes = ref([])
const dictOptionMap = ref({})
const dirty = ref(false)
const query = reactive({ pageNum: 1, pageSize: 100, tableName: '' })
let searchTimer

const tableDialogOpen = ref(false)
const tableDialogMode = ref('add')
const tableFormRef = ref()
const tableForm = reactive({ tableId: undefined, tableName: '', tableCode: '', status: '0', remark: '' })
const tableRules = {
  tableName: [{ required: true, message: '名称不能为空', trigger: 'blur' }],
  tableCode: [
    { required: true, message: '编码不能为空', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_]*$/, message: '请使用小写字母开头的小写字母、数字和下划线', trigger: 'blur' }
  ]
}

const fieldDrawerOpen = ref(false)
const fieldFormRef = ref()
const editingFieldIndex = ref(-1)
const fieldOptions = ref([])
const fieldForm = reactive(defaultField())
const fieldRules = {
  fieldLabel: [{ required: true, message: '字段名称不能为空', trigger: 'blur' }],
  fieldKey: [
    { required: true, message: '字段标识不能为空', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_]*$/, message: '请使用小写字母开头的小写字母、数字和下划线', trigger: 'blur' }
  ],
  dataType: [{ required: true, message: '请选择数据类型', trigger: 'change' }],
  componentType: [{ required: true, message: '请选择组件类型', trigger: 'change' }],
  componentPropsJson: [{ validator: jsonObjectValidator, trigger: 'blur' }],
  validationJson: [{ validator: jsonObjectValidator, trigger: 'blur' }]
}

const availableComponents = computed(() => catalog.value.find(item => item.value === fieldForm.dataType)?.components || [])
const isChoiceComponent = computed(() => ['select', 'multi-select', 'radio', 'checkbox'].includes(fieldForm.componentType))
const isSelectComponent = computed(() => ['select', 'multi-select'].includes(fieldForm.componentType))
const isMultiChoiceComponent = computed(() => ['multi-select', 'checkbox'].includes(fieldForm.componentType))
const currentChoiceOptions = computed(() => fieldForm.optionSource === 'DICT'
  ? (dictOptionMap.value[fieldForm.dictType] || [])
  : fieldOptions.value)
const choiceDefaultValue = computed({
  get: () => {
    if (!isMultiChoiceComponent.value) return fieldForm.defaultValue || undefined
    const value = parseJson(fieldForm.defaultValue, [])
    return Array.isArray(value) ? value : []
  },
  set: value => {
    fieldForm.defaultValue = isMultiChoiceComponent.value
      ? (Array.isArray(value) && value.length ? JSON.stringify(value) : '')
      : (value ?? '')
  }
})
const selectClearable = computed({
  get: () => parseJson(fieldForm.componentPropsJson, {}).clearable !== false,
  set: value => {
    const componentProps = parseJson(fieldForm.componentPropsJson, {})
    componentProps.clearable = value
    fieldForm.componentPropsJson = JSON.stringify(componentProps)
  }
})
const fieldEnabled = computed({
  get: () => fieldForm.status === '0',
  set: value => { fieldForm.status = value ? '0' : '1' }
})

const previewOpen = ref(false)
const previewTab = ref('form')
const previewModel = ref({})
const dataOpen = ref(false)
const previewRows = computed(() => [0, 1, 2].map(rowIndex => {
  const row = {}
  fields.value.forEach(field => { row[field.fieldKey] = sampleValue(field, rowIndex) })
  return row
}))

async function loadCatalog() {
  const response = await getDynamicFieldCatalog()
  catalog.value = response.data || []
}

async function loadDictTypes() {
  const response = await optionselect()
  dictTypes.value = response.data || []
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

async function loadCurrentDictOptions() {
  if (!fieldForm.dictType) return
  const response = await getDynamicDictOptions([fieldForm.dictType])
  dictOptionMap.value = { ...dictOptionMap.value, ...(response.data || {}) }
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
  if (!force && selectedTable.value?.tableId === item.tableId) return
  if (!force && dirty.value) {
    try { await proxy.$modal.confirm('当前字段有未保存修改，确定放弃并切换吗？') } catch { return }
  }
  detailLoading.value = true
  try {
    const response = await getDynamicTable(item.tableId)
    selectedTable.value = response.data
    fields.value = (response.data.fields || []).map((field, index) => ({ ...field, _key: field.fieldId || `${Date.now()}-${index}` }))
    await loadSchemaDictOptions(fields.value)
    dirty.value = false
    previewModel.value = {}
  } finally { detailLoading.value = false }
}

function handleAddTable() {
  tableDialogMode.value = 'add'
  Object.assign(tableForm, { tableId: undefined, tableName: '', tableCode: '', status: '0', remark: '' })
  tableDialogOpen.value = true
  nextTick(() => tableFormRef.value?.clearValidate())
}

function handleEditTable() {
  tableDialogMode.value = 'edit'
  Object.assign(tableForm, selectedTable.value)
  tableDialogOpen.value = true
  nextTick(() => tableFormRef.value?.clearValidate())
}

async function submitTable() {
  await tableFormRef.value.validate()
  const payload = { tableId: tableForm.tableId, tableName: tableForm.tableName, tableCode: tableForm.tableCode, status: tableForm.status, remark: tableForm.remark }
  if (tableDialogMode.value === 'add') await addDynamicTable(payload)
  else await updateDynamicTable(payload)
  proxy.$modal.msgSuccess(tableDialogMode.value === 'add' ? '创建成功' : '修改成功')
  tableDialogOpen.value = false
  selectedTable.value = null
  dirty.value = false
  await loadTables(payload.tableCode)
}

async function handleDeleteTable() {
  try { await proxy.$modal.confirm(`确定删除动态表“${selectedTable.value.tableName}”及其全部字段配置吗？`) } catch { return }
  await deleteDynamicTable(selectedTable.value.tableId)
  proxy.$modal.msgSuccess('删除成功')
  selectedTable.value = null
  fields.value = []
  dirty.value = false
  await loadTables()
}

function defaultField() {
  return {
    fieldLabel: '', fieldKey: '', dataType: 'STRING', componentType: 'input', defaultValue: '',
    placeholder: '', componentPropsJson: '{}', validationJson: '{}', required: false,
    optionSource: 'STATIC', dictType: '',
    searchable: false, sortable: false, listVisible: true, formVisible: true,
    columnWidth: 140, status: '0'
  }
}

function handleAddField() {
  editingFieldIndex.value = -1
  Object.assign(fieldForm, defaultField())
  fieldOptions.value = []
  fieldDrawerOpen.value = true
}

function handleEditField(index) {
  editingFieldIndex.value = index
  Object.assign(fieldForm, defaultField(), JSON.parse(JSON.stringify(fields.value[index])))
  fieldOptions.value = parseJson(fieldForm.optionsJson, []).map(option => ({ ...option }))
  fieldDrawerOpen.value = true
}

function handleDataTypeChange(dataType) {
  const type = catalog.value.find(item => item.value === dataType)
  fieldForm.componentType = type?.defaultComponent || ''
  fieldForm.defaultValue = ''
  fieldOptions.value = []
}

function handleComponentChange(componentType) {
  if (!['select', 'multi-select', 'radio', 'checkbox'].includes(componentType)) {
    fieldForm.optionSource = 'STATIC'
    fieldForm.dictType = ''
  }
  if (fieldForm.dataType === 'BOOLEAN' && componentType === 'radio' && !fieldOptions.value.length) {
    fieldOptions.value = [
      { label: '是', value: 'true', type: 'success' },
      { label: '否', value: 'false', type: 'info' }
    ]
  }
}

function handleOptionSourceChange(source) {
  fieldForm.defaultValue = ''
  if (source === 'STATIC') fieldForm.dictType = ''
  else fieldOptions.value = []
}

function handleDictTypeClear() {
  fieldForm.dictType = ''
  fieldForm.defaultValue = ''
}

function addOption() { fieldOptions.value.push({ label: '', value: '', type: '' }) }

async function submitField() {
  await fieldFormRef.value.validate()
  const duplicate = fields.value.some((item, index) => item.fieldKey === fieldForm.fieldKey && index !== editingFieldIndex.value)
  if (duplicate) return proxy.$modal.msgError(`字段标识“${fieldForm.fieldKey}”已存在`)
  if (isChoiceComponent.value && fieldOptions.value.some(item => item.label === '' || item.value === '')) {
    return proxy.$modal.msgError('选项名称和值不能为空')
  }
  if (isChoiceComponent.value && fieldForm.optionSource === 'DICT' && !fieldForm.dictType) {
    return proxy.$modal.msgError('请选择关联的字典类型')
  }
  const field = {
    ...JSON.parse(JSON.stringify(fieldForm)),
    optionsJson: JSON.stringify(isChoiceComponent.value && fieldForm.optionSource !== 'DICT' ? fieldOptions.value : []),
    _key: editingFieldIndex.value < 0 ? `${Date.now()}-${Math.random()}` : fields.value[editingFieldIndex.value]._key
  }
  if (editingFieldIndex.value < 0) fields.value.push(field)
  else fields.value.splice(editingFieldIndex.value, 1, field)
  normalizeSort()
  dirty.value = true
  await loadSchemaDictOptions(fields.value)
  fieldDrawerOpen.value = false
}

async function removeField(index) {
  try { await proxy.$modal.confirm(`确定删除字段“${fields.value[index].fieldLabel}”吗？`) } catch { return }
  fields.value.splice(index, 1)
  normalizeSort()
  dirty.value = true
}

function markReordered() { normalizeSort(); dirty.value = true }
function normalizeSort() { fields.value.forEach((field, index) => { field.sort = index + 1 }) }
function cleanFields(items) { return items.map(({ _key, ...field }, index) => ({ ...field, fieldId: undefined, sort: index + 1 })) }

async function saveFields() {
  await saveDynamicFields(selectedTable.value.tableId, cleanFields(fields.value))
  proxy.$modal.msgSuccess('字段配置已保存')
  await selectTable(selectedTable.value, true)
}

function parseJson(value, fallback) {
  if (!value) return fallback
  try { return typeof value === 'string' ? JSON.parse(value) : value } catch { return fallback }
}

function jsonObjectValidator(rule, value, callback) {
  try {
    const result = JSON.parse(value || '{}')
    if (!result || Array.isArray(result) || typeof result !== 'object') return callback(new Error('请输入 JSON 对象'))
    callback()
  } catch { callback(new Error('JSON 格式不正确')) }
}

function typeLabel(dataType) { return catalog.value.find(item => item.value === dataType)?.label || dataType }
function componentLabel(field) { return catalog.value.find(item => item.value === field.dataType)?.components?.find(item => item.value === field.componentType)?.label || field.componentType }
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
  await Promise.all([loadCatalog(), loadDictTypes()])
  await loadTables()
})
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
.two-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.field-alert { margin-bottom: 18px; }
.source-config { padding: 0 0 18px; }
.section-title { display: flex; align-items: center; justify-content: space-between; margin: 8px 0 12px; padding-bottom: 8px; font-weight: 600; border-bottom: 1px solid var(--el-border-color-lighter); }
.option-editor { padding: 12px; margin-bottom: 20px; background: var(--el-fill-color-extra-light); border-radius: 8px; }
.option-row { display: grid; grid-template-columns: 1fr 1fr 110px 32px; gap: 8px; margin-bottom: 8px; }
.switch-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin-bottom: 22px; }
.switch-grid label { display: flex; align-items: center; justify-content: space-between; padding: 11px 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 7px; }
.switch-grid b, .switch-grid small { display: block; }
.switch-grid b { font-size: 13px; }
.switch-grid small { margin-top: 4px; color: var(--el-text-color-secondary); font-size: 11px; }
.advanced-config :deep(.el-form-item) { margin-bottom: 18px; }
.preview-card { padding: 24px; border: 1px solid var(--el-border-color-lighter); border-radius: 9px; background: var(--el-bg-color); }
.schema-json { min-height: 420px; margin: 0; padding: 20px; overflow: auto; color: #d7dae0; background: #1e1f22; border-radius: 8px; font: 13px/1.65 Consolas, monospace; }
@media (max-width: 1100px) {
  .designer-body { grid-template-columns: 240px minmax(760px, 1fr); overflow: auto; }
  .workspace-header { align-items: flex-start; }
  .workspace-actions { flex-wrap: wrap; justify-content: flex-end; }
}
</style>
