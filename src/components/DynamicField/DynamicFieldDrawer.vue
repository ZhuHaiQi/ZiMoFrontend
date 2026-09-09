<template>
  <el-drawer v-model="open" :title="field ? '编辑字段' : '添加字段'" :size="size" append-to-body destroy-on-close>
    <el-form ref="fieldFormRef" :model="fieldForm" :rules="fieldRules" label-position="top">
      <div class="two-columns">
        <el-form-item label="字段名称" prop="fieldLabel"><el-input v-model="fieldForm.fieldLabel" placeholder="例如：客户等级" /></el-form-item>
        <el-form-item label="字段标识" prop="fieldKey"><el-input v-model="fieldForm.fieldKey" placeholder="例如：customer_level" /></el-form-item>
      </div>
      <el-form-item label="唯一标识" prop="uniqueKey">
        <el-input v-model="fieldForm.uniqueKey" placeholder="例如：${vin}（选填，格式为 ${...}）" clearable />
        <div class="form-tip">非必填项，同表内不能重复。格式必须为 ${...}（如 ${vin}），用于全局或跨系统唯一业务映射。</div>
      </el-form-item>
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
          <el-radio-button value="API">接口数据</el-radio-button>
        </el-radio-group>
        <el-select
          v-if="fieldForm.optionSource === 'DICT'"
          v-model="fieldForm.dictType"
          filterable
          clearable
          :loading="dictOptionsLoading"
          placeholder="请选择字典类型"
          style="width: 100%; margin-top: 12px"
          @change="loadCurrentDictOptions"
          @clear="handleDictTypeClear"
        >
          <el-option v-for="dict in dictTypes" :key="dict.dictType" :label="`${dict.dictName}（${dict.dictType}）`" :value="dict.dictType" />
        </el-select>
        <div v-if="fieldForm.optionSource === 'DICT'" class="form-tip">运行时通过批量接口读取若依字典缓存，字典修改后无需重新保存 Schema。</div>
  
        <div v-if="fieldForm.optionSource === 'API'" class="api-config-panel" style="margin-top: 12px">
          <div class="two-columns">
            <el-form-item label="接口地址 (URL)">
              <el-input v-model="fieldApiConfig.url" placeholder="如：/system/user/list" />
            </el-form-item>
            <el-form-item label="请求方式">
              <el-select v-model="fieldApiConfig.method" style="width: 100%">
                <el-option label="GET" value="GET" />
                <el-option label="POST" value="POST" />
              </el-select>
            </el-form-item>
          </div>
          <div class="two-columns">
            <el-form-item label="显示标签字段 (Label)">
              <el-input v-model="fieldApiConfig.labelField" placeholder="默认 label，如 nickName" />
            </el-form-item>
            <el-form-item label="存储数值字段 (Value)">
              <el-input v-model="fieldApiConfig.valueField" placeholder="默认 value，如 userId" />
            </el-form-item>
          </div>
          <div class="two-columns">
            <el-form-item label="数据路径 (Data Path)">
              <el-input v-model="fieldApiConfig.dataField" placeholder="可选，如 rows 或 data.list" />
            </el-form-item>
            <el-form-item label="调试接口">
              <el-button type="primary" plain icon="Connection" :loading="apiTesting" @click="testFetchApiOptions()" style="width: 100%">
                测试获取数据
              </el-button>
            </el-form-item>
          </div>
          <el-form-item label="请求参数 JSON (Params)">
            <el-input v-model="fieldApiConfig.paramsJson" type="textarea" :rows="2" placeholder='可选，如：{"status":"0","pageSize":100}' />
          </el-form-item>
          <div v-if="apiTestResults.length" class="api-preview-list">
            <div class="api-preview-title">解析选项预览 (前 5 项)：</div>
            <el-tag v-for="item in apiTestResults.slice(0, 5)" :key="String(item.value)" size="small" style="margin-right: 6px; margin-bottom: 4px">
              {{ item.label }} ({{ item.value }})
            </el-tag>
          </div>
          <div class="form-tip">运行时调用系统后端接口动态获取选项，自带防重缓存，修改接口后刷新页面生效。</div>
        </div>
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
  
      <div v-if="isChoiceComponent && fieldForm.optionSource === 'STATIC'" class="option-editor">
        <div class="section-title"><span>选项配置</span><el-button link type="primary" icon="Plus" @click="addOption">添加选项</el-button></div>
        <div v-for="(option, index) in fieldOptions" :key="index" class="option-row">
          <el-input v-model="option.label" placeholder="显示名称" />
          <el-input v-model="option.value" placeholder="选项值" />
          <el-select
            :model-value="optionColorSelectValue(option)"
            clearable
            placeholder="预设颜色"
            style="width: 130px"
            @update:model-value="val => handleOptionColorSelect(option, val)"
          >
            <el-option
              v-for="item in colorOptionsFor(option)"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            >
              <div class="color-option-item">
                <i class="color-badge" :style="{ backgroundColor: item.color }" />
                <span>{{ item.label }}</span>
              </div>
            </el-option>
          </el-select>
          <el-color-picker
            v-model="option.color"
            show-alpha
            :predefine="predefineColors"
            title="自定义取色"
            @change="val => handleColorPickerChange(option, val)"
          />
          <el-button link type="danger" icon="Delete" @click="fieldOptions.splice(index, 1)" />
        </div>
        <el-empty v-if="!fieldOptions.length" description="暂无选项" :image-size="48" />
      </div>
  
      <div class="section-title"><span>使用场景</span></div>
      <div class="switch-grid">
        <label><span><b>必填</b><small>空值处理与校验模式</small></span><el-switch v-model="fieldForm.required" /></label>
        <label v-if="isSelectComponent"><span><b>允许清空</b><small>显示清除当前选择的按钮</small></span><el-switch v-model="selectClearable" /></label>
        <label v-if="isChoiceComponent"><span><b>以标签 (Tag) 展示</b><small>默认关闭（纯文本显示），开启后表格以彩色 Tag 展示</small></span><el-switch v-model="showAsTag" /></label>
        <label><span><b>列表展示</b><small>生成表格列</small></span><el-switch v-model="fieldForm.listVisible" /></label>
        <label><span><b>表单展示</b><small>生成编辑控件</small></span><el-switch v-model="fieldForm.formVisible" /></label>
        <label><span><b>允许编辑</b><small>关闭后表格内仅查看</small></span><el-switch v-model="tableEditable" /></label>
        <label><span><b>支持查询</b><small>可生成查询条件</small></span><el-switch v-model="fieldForm.searchable" /></label>
        <label><span><b>支持排序</b><small>{{ fieldForm.dataType === 'JSON' ? '多值字段不支持排序' : '允许表格排序' }}</small></span><el-switch v-model="fieldForm.sortable" :disabled="fieldForm.dataType === 'JSON'" /></label>
        <label><span><b>启用字段</b><small>停用后不参与渲染</small></span><el-switch v-model="fieldEnabled" /></label>
      </div>
  
      <div v-if="fieldForm.required" class="required-config-panel">
        <div class="required-config-header">
          <span class="required-config-title">必填规则与提醒配置</span>
        </div>
        <div class="two-columns" style="margin-top: 10px;">
          <el-form-item label="必填提示方式">
            <el-radio-group v-model="requiredMode">
              <el-radio-button value="color">单元格颜色提醒</el-radio-button>
              <el-radio-button value="alert">报错弹窗提示</el-radio-button>
            </el-radio-group>
            <div class="form-tip">
              {{ requiredMode === 'color' ? '允许修改为空值保存，仅通过单元格高亮提示待补录' : '强校验模式，修改为空值时弹窗报错并拦截保存' }}
            </div>
          </el-form-item>
          <el-form-item v-if="requiredMode === 'color'" label="单元格必填高亮颜色">
            <div class="required-color-bar">
              <el-select
                :model-value="requiredColorSelectValue"
                placeholder="预设颜色"
                style="width: 140px"
                @update:model-value="handleRequiredColorSelect"
              >
                <el-option
                  v-for="item in requiredColorOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                >
                  <div class="color-option-item">
                    <i class="color-badge" :style="{ backgroundColor: item.color }" />
                    <span>{{ item.label }}</span>
                  </div>
                </el-option>
              </el-select>
              <el-color-picker
                v-model="requiredColor"
                show-alpha
                :predefine="predefineRequiredColors"
                title="自定义取色"
              />
              <el-button link type="primary" size="small" @click="requiredColor = '#fff0f0'">恢复默认浅红</el-button>
            </div>
            <div class="form-tip">当前设置的单元格空值背景色（默认浅红 #fff0f0）</div>
          </el-form-item>
        </div>
      </div>
  
      <div class="two-columns advanced-config">
        <el-form-item label="列宽"><el-input-number v-model="fieldForm.columnWidth" :min="80" :max="800" :step="10" style="width: 100%" /></el-form-item>
        <el-form-item label="对齐方式">
          <el-radio-group v-model="fieldForm.align">
            <el-radio-button value="left">居左</el-radio-button>
            <el-radio-button value="center">居中</el-radio-button>
            <el-radio-button value="right">居右</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="同行动行内互斥字段 (值不能重复)" style="grid-column: span 2">
          <el-select
            v-model="rowUniqueFields"
            multiple
            filterable
            clearable
            placeholder="选择不能与当前字段值相同的其他字段 (例如与 b 列、c 列互斥)"
            style="width: 100%"
          >
            <el-option
              v-for="item in otherFields"
              :key="item.fieldKey"
              :label="`${item.fieldLabel} (${item.fieldKey})`"
              :value="item.fieldKey"
            />
          </el-select>
          <div class="form-tip">配置后在同一行记录中，本字段的值不能与所选字段的值重复；保存时将校验拦截。</div>
        </el-form-item>
        <el-form-item label="组件属性 JSON" prop="componentPropsJson">
          <el-input v-model="fieldForm.componentPropsJson" type="textarea" :rows="4" placeholder='例如：{"clearable":true,"span":12}' />
        </el-form-item>
        <el-form-item label="校验规则 JSON" prop="validationJson">
          <el-input v-model="fieldForm.validationJson" type="textarea" :rows="4" placeholder='例如：{"min":2,"max":20}' />
        </el-form-item>
      </div>
    </el-form>
    <template #footer>
      <el-button :disabled="fieldApplying" @click="open = false">取消</el-button>
      <el-button type="primary" :loading="fieldApplying" :disabled="fieldApplying" @click="submitField">应用字段</el-button>
    </template>
  </el-drawer>
</template>

<script setup name="DynamicFieldDrawer">
import { optionselect } from '@/api/system/dict/type'
import { getDynamicDictOptions } from '@/api/system/dynamicTable'
import { fetchApiOptions } from '@/utils/dynamicSource'
import { parseJson } from '@/utils/dynamicField'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  field: { type: Object, default: null },
  fields: { type: Array, default: () => [] },
  catalog: { type: Array, default: () => [] },
  size: { type: [String, Number], default: '560px' }
})
const emit = defineEmits(['apply'])
const { proxy } = getCurrentInstance()
const dictTypes = ref([])
const dictOptionMap = ref({})
const dictOptionsLoading = ref(false)
const otherFields = computed(() => props.fields.filter(field => field !== props.field))
let draftVersion = 0
let dictRequestId = 0
const fieldApiConfig = reactive({
  url: '',
  method: 'GET',
  labelField: 'label',
  valueField: 'value',
  dataField: '',
  paramsJson: ''
})

const apiTesting = ref(false)
const apiTestResults = ref([])
const fieldFormRef = ref()
const fieldApplying = ref(false)
const fieldOptions = ref([])
const fieldForm = reactive(defaultField())
const fieldRules = {
  fieldLabel: [{ required: true, message: '字段名称不能为空', trigger: 'blur' }],
  fieldKey: [
    { required: true, message: '字段标识不能为空', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_]*$/, message: '请使用小写字母开头的小写字母、数字和下划线', trigger: 'blur' },
    { validator: validateFieldKeyUnique, trigger: ['blur', 'change'] }
  ],
  uniqueKey: [
    { validator: validateUniqueKey, trigger: ['blur', 'change'] }
  ],
  dataType: [{ required: true, message: '请选择数据类型', trigger: 'change' }],
  componentType: [{ required: true, message: '请选择组件类型', trigger: 'change' }],
  componentPropsJson: [{ validator: jsonObjectValidator, trigger: 'blur' }],
  validationJson: [{ validator: jsonObjectValidator, trigger: 'blur' }]
}

function validateFieldKeyUnique(rule, value, callback) {
  const key = (value || '').trim().toLowerCase()
  if (!key) return callback()
  const duplicate = otherFields.value.some(item => (item.fieldKey || '').trim().toLowerCase() === key)
  if (duplicate) {
    return callback(new Error(`字段标识“${value}”已存在，不能重复`))
  }
  callback()
}

function validateUniqueKey(rule, value, callback) {
  const val = (value || '').trim()
  if (!val) return callback()
  if (!/^\$\{[a-zA-Z0-9_]+\}$/.test(val)) {
    return callback(new Error('唯一标识格式必须为 ${...} 格式，如 ${vin}'))
  }
  const duplicate = otherFields.value.some(item => (item.uniqueKey || '').trim() === val)
  if (duplicate) {
    return callback(new Error(`唯一标识“${val}”在当前表内已存在，不能重复`))
  }
  callback()
}

const availableComponents = computed(() => props.catalog.find(item => item.value === fieldForm.dataType)?.components || [])
const isChoiceComponent = computed(() => ['select', 'multi-select', 'radio', 'checkbox'].includes(fieldForm.componentType))
const isSelectComponent = computed(() => ['select', 'multi-select'].includes(fieldForm.componentType))
const isMultiChoiceComponent = computed(() => ['multi-select', 'checkbox'].includes(fieldForm.componentType))
const currentChoiceOptions = computed(() => {
  if (fieldForm.optionSource === 'DICT') return dictOptionMap.value[fieldForm.dictType] || []
  if (fieldForm.optionSource === 'API') return apiTestResults.value || []
  return fieldOptions.value
})

const rowUniqueFields = computed({
  get: () => parseJson(fieldForm.validationJson, {}).rowUniqueFields || [],
  set: value => {
    const validation = parseJson(fieldForm.validationJson, {})
    if (Array.isArray(value) && value.length) {
      validation.rowUniqueFields = value
    } else {
      delete validation.rowUniqueFields
    }
    fieldForm.validationJson = JSON.stringify(validation)
  }
})

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

const showAsTag = computed({
  get: () => Boolean(parseJson(fieldForm.componentPropsJson, {}).showAsTag),
  set: value => {
    const componentProps = parseJson(fieldForm.componentPropsJson, {})
    if (value) {
      componentProps.showAsTag = true
    } else {
      delete componentProps.showAsTag
    }
    fieldForm.componentPropsJson = JSON.stringify(componentProps)
  }
})

const fieldEnabled = computed({
  get: () => fieldForm.status === '0',
  set: value => { fieldForm.status = value ? '0' : '1' }
})

const tableEditable = computed({
  get: () => parseJson(fieldForm.componentPropsJson, {}).tableEditable !== false,
  set: value => {
    const componentProps = parseJson(fieldForm.componentPropsJson, {})
    if (value) delete componentProps.tableEditable
    else componentProps.tableEditable = false
    fieldForm.componentPropsJson = JSON.stringify(componentProps)
  }
})

const requiredMode = computed({
  get: () => parseJson(fieldForm.validationJson, {}).requiredMode || 'color',
  set: value => {
    const validation = parseJson(fieldForm.validationJson, {})
    if (value && value !== 'color') {
      validation.requiredMode = value
    } else {
      delete validation.requiredMode
    }
    fieldForm.validationJson = JSON.stringify(validation)
  }
})

const requiredColor = computed({
  get: () => parseJson(fieldForm.validationJson, {}).requiredColor || '#fff0f0',
  set: value => {
    const validation = parseJson(fieldForm.validationJson, {})
    if (value && value !== '#fff0f0') {
      validation.requiredColor = value
    } else {
      delete validation.requiredColor
    }
    fieldForm.validationJson = JSON.stringify(validation)
  }
})

const presetRequiredColors = [
  { label: '经典浅红 (默认)', value: '#fff0f0', color: '#fff0f0' },
  { label: '警示浅橙', value: '#fdf6ec', color: '#fdf6ec' },
  { label: '柔和浅黄', value: '#fefce8', color: '#fefce8' },
  { label: '淡雅浅蓝', value: '#ecf5ff', color: '#ecf5ff' },
  { label: '薄荷浅绿', value: '#f0f9eb', color: '#f0f9eb' },
  { label: '浪漫浅紫', value: '#fbf0fa', color: '#fbf0fa' }
]

const predefineRequiredColors = [
  '#fff0f0',
  '#fdf6ec',
  '#fefce8',
  '#ecf5ff',
  '#f0f9eb',
  '#fbf0fa',
  '#fee2e2',
  '#ffedd5',
  '#fef3c7',
  '#e0f2fe'
]

const requiredColorOptions = computed(() => {
  const list = [...presetRequiredColors]
  const cur = requiredColor.value
  if (cur && !list.some(p => p.color.toLowerCase() === cur.toLowerCase())) {
    list.unshift({
      label: `自定义 (${cur})`,
      value: cur,
      color: cur
    })
  }
  return list
})

const requiredColorSelectValue = computed(() => {
  const cur = requiredColor.value
  const matched = presetRequiredColors.find(p => p.color.toLowerCase() === (cur || '').toLowerCase())
  return matched ? matched.value : cur
})

function handleRequiredColorSelect(val) {
  requiredColor.value = val || '#fff0f0'
}

function defaultField() {
  return {
    fieldLabel: '', fieldKey: '', uniqueKey: '', dataType: 'STRING', componentType: 'input', defaultValue: '',
    placeholder: '', componentPropsJson: '{}', validationJson: '{}', required: false,
    optionSource: 'STATIC', dictType: '',
    searchable: false, sortable: false, listVisible: true, formVisible: true,
    columnWidth: 140, align: 'center', status: '0'
  }
}

function handleDataTypeChange(dataType) {
  const type = props.catalog.find(item => item.value === dataType)
  fieldForm.componentType = type?.defaultComponent || ''
  fieldForm.defaultValue = ''
  if (dataType === 'JSON') fieldForm.sortable = false
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
  if (source === 'STATIC') {
    fieldForm.dictType = ''
  } else if (source === 'DICT') {
    fieldOptions.value = []
  } else if (source === 'API') {
    fieldOptions.value = []
    fieldForm.dictType = ''
  }
}

function handleDictTypeClear() {
  fieldForm.dictType = ''
  fieldForm.defaultValue = ''
}

const presetColorOptions = [
  { label: '成功绿', value: 'success', color: '#67C23A' },
  { label: '主要蓝', value: 'primary', color: '#409EFF' },
  { label: '警告橙', value: 'warning', color: '#E6A23C' },
  { label: '危险红', value: 'danger', color: '#F56C6C' },
  { label: '信息灰', value: 'info', color: '#909399' },
  { label: '典雅紫', value: '#722ED1', color: '#722ED1' },
  { label: '极光青', value: '#13C2C2', color: '#13C2C2' },
  { label: '活力橙', value: '#FA8C16', color: '#FA8C16' },
  { label: '浪漫粉', value: '#EB2F96', color: '#EB2F96' },
  { label: '极客蓝', value: '#2F54EB', color: '#2F54EB' },
  { label: '薄荷绿', value: '#00B96B', color: '#00B96B' }
]

const predefineColors = [
  '#409EFF',
  '#67C23A',
  '#E6A23C',
  '#F56C6C',
  '#909399',
  '#722ED1',
  '#13C2C2',
  '#FA8C16',
  '#EB2F96',
  '#2F54EB',
  '#00B96B',
  '#595959',
  '#FF4D4F',
  '#40A9FF',
  '#36CFC9',
  '#B37FEB'
]

function colorOptionsFor(option) {
  const list = [...presetColorOptions]
  if (option.color && !list.some(p => p.color.toLowerCase() === String(option.color).toLowerCase())) {
    list.unshift({
      label: `自定义 (${option.color})`,
      value: option.color,
      color: option.color
    })
  }
  return list
}

function optionColorSelectValue(option) {
  if (option.color) {
    const matched = presetColorOptions.find(p => p.color.toLowerCase() === String(option.color).toLowerCase() || p.value === option.color)
    return matched ? matched.value : option.color
  }
  return option.type || undefined
}

function handleOptionColorSelect(option, val) {
  if (!val) {
    option.color = ''
    option.type = ''
    return
  }
  const preset = presetColorOptions.find(p => p.value === val || p.color.toLowerCase() === String(val).toLowerCase())
  if (preset) {
    if (['success', 'primary', 'warning', 'danger', 'info'].includes(preset.value)) {
      option.type = preset.value
      option.color = preset.color
    } else {
      option.color = preset.color
      option.type = ''
    }
  } else {
    option.color = val
    option.type = ''
  }
}

function handleColorPickerChange(option, val) {
  option.color = val || ''
  if (!val) {
    option.type = ''
  } else {
    const preset = presetColorOptions.find(p => p.color.toLowerCase() === String(val).toLowerCase())
    option.type = preset && ['success', 'primary', 'warning', 'danger', 'info'].includes(preset.value) ? preset.value : ''
  }
}

function addOption() { fieldOptions.value.push({ label: '', value: '', type: '', color: '' }) }

async function testFetchApiOptions(silent = false) {
  const version = draftVersion
  if (!fieldApiConfig.url) {
    if (!silent) proxy.$modal.msgWarning('请先输入接口地址')
    return
  }
  let params = {}
  if (fieldApiConfig.paramsJson) {
    try {
      params = JSON.parse(fieldApiConfig.paramsJson)
    } catch {
      if (!silent) proxy.$modal.msgError('请求参数格式不正确，请输入合法 JSON')
      return
    }
  }
  apiTesting.value = true
  try {
    const list = await fetchApiOptions({
      url: fieldApiConfig.url,
      method: fieldApiConfig.method,
      labelField: fieldApiConfig.labelField,
      valueField: fieldApiConfig.valueField,
      dataField: fieldApiConfig.dataField,
      params
    }, true)
    if (version !== draftVersion) return
    apiTestResults.value = list
    if (!silent) {
      if (list.length) proxy.$modal.msgSuccess(`测试成功，解析到 ${list.length} 条选项数据`)
      else proxy.$modal.msgWarning('接口调用完成但未解析到选项数据，请检查数据路径与字段映射')
    }
  } catch (err) {
    if (version === draftVersion && !silent) proxy.$modal.msgError('接口调用失败，请检查地址是否正确')
  } finally {
    if (version === draftVersion) apiTesting.value = false
  }
}

async function submitField() {
  if (fieldApplying.value) return
  const version = draftVersion
  fieldApplying.value = true
  try {
    const valid = await fieldFormRef.value.validate().catch(() => false)
    if (!valid || !open.value || version !== draftVersion) return

    const normalizedFieldKey = (fieldForm.fieldKey || '').trim().toLowerCase()
    const duplicateKey = otherFields.value.some(item => (item.fieldKey || '').trim().toLowerCase() === normalizedFieldKey)
    if (duplicateKey) return proxy.$modal.msgError(`字段标识“${fieldForm.fieldKey}”已存在`)

    const normalizedUniqueKey = (fieldForm.uniqueKey || '').trim()
    if (normalizedUniqueKey) {
      if (!/^\$\{[a-zA-Z0-9_]+\}$/.test(normalizedUniqueKey)) {
        return proxy.$modal.msgError('唯一标识格式必须为 ${...} 格式，如 ${vin}')
      }
      const duplicateUniqueKey = otherFields.value.some(item => (item.uniqueKey || '').trim() === normalizedUniqueKey)
      if (duplicateUniqueKey) {
        return proxy.$modal.msgError(`唯一标识“${normalizedUniqueKey}”在当前表内已存在，不能重复`)
      }
    }

    if (isChoiceComponent.value && fieldForm.optionSource === 'STATIC' && fieldOptions.value.some(item => item.label === '' || item.value === '')) {
      return proxy.$modal.msgError('选项名称和值不能为空')
    }
    if (isChoiceComponent.value && fieldForm.optionSource === 'DICT' && !fieldForm.dictType) {
      return proxy.$modal.msgError('请选择关联的字典类型')
    }
    if (isChoiceComponent.value && fieldForm.optionSource === 'API') {
      if (!fieldApiConfig.url) return proxy.$modal.msgError('请输入接口地址')
      let params = {}
      if (fieldApiConfig.paramsJson) {
        try {
          params = JSON.parse(fieldApiConfig.paramsJson)
        } catch {
          return proxy.$modal.msgError('请求参数格式不正确，请输入合法 JSON')
        }
      }
      const componentProps = parseJson(fieldForm.componentPropsJson, {})
      componentProps.apiConfig = {
        url: fieldApiConfig.url.trim(),
        method: fieldApiConfig.method || 'GET',
        labelField: fieldApiConfig.labelField || 'label',
        valueField: fieldApiConfig.valueField || 'value',
        dataField: fieldApiConfig.dataField || '',
        params
      }
      fieldForm.componentPropsJson = JSON.stringify(componentProps)
    }
    const field = {
      ...JSON.parse(JSON.stringify(fieldForm)),
      fieldKey: normalizedFieldKey,
      uniqueKey: normalizedUniqueKey || undefined,
      align: fieldForm.align || 'center',
      optionsJson: JSON.stringify(isChoiceComponent.value && fieldForm.optionSource === 'STATIC' ? fieldOptions.value : [])
    }
    emit('apply', field)
    open.value = false
  } finally {
    if (version === draftVersion) fieldApplying.value = false
  }
}

function jsonObjectValidator(rule, value, callback) {
  try {
    const result = JSON.parse(value || '{}')
    if (!result || Array.isArray(result) || typeof result !== 'object') return callback(new Error('请输入 JSON 对象'))
    callback()
  } catch { callback(new Error('JSON 格式不正确')) }
}

// 每次打开都创建独立草稿；关闭或取消不会修改传入字段。
function initializeDraft() {
  const source = props.field ? JSON.parse(JSON.stringify(props.field)) : {}
  Object.keys(fieldForm).forEach(key => delete fieldForm[key])
  Object.assign(fieldForm, defaultField(), source, { align: source.align || 'center' })
  fieldOptions.value = parseJson(source.optionsJson, []).map(option => ({ ...option }))
  const apiConfig = parseJson(source.componentPropsJson, {}).apiConfig || {}
  Object.assign(fieldApiConfig, {
    url: apiConfig.url || '',
    method: apiConfig.method || 'GET',
    labelField: apiConfig.labelField || 'label',
    valueField: apiConfig.valueField || 'value',
    dataField: apiConfig.dataField || '',
    paramsJson: apiConfig.params ? JSON.stringify(apiConfig.params) : ''
  })
  apiTestResults.value = []
  apiTesting.value = false
  fieldApplying.value = false
  dictOptionsLoading.value = false
  if (fieldForm.optionSource === 'DICT') loadCurrentDictOptions()
  if (fieldForm.optionSource === 'API' && fieldApiConfig.url) testFetchApiOptions(true)
  nextTick(() => fieldFormRef.value?.clearValidate())
}

async function loadDictTypes() {
  const response = await optionselect()
  dictTypes.value = response.data || []
}

async function loadCurrentDictOptions() {
  const requestId = ++dictRequestId
  const version = draftVersion
  const dictType = fieldForm.dictType
  if (!dictType) {
    dictOptionsLoading.value = false
    return
  }
  dictOptionsLoading.value = true
  try {
    const response = await getDynamicDictOptions([dictType])
    if (version === draftVersion && requestId === dictRequestId) {
      dictOptionMap.value = { ...dictOptionMap.value, ...(response.data || {}) }
    }
  } finally {
    if (version === draftVersion && requestId === dictRequestId) dictOptionsLoading.value = false
  }
}

watch(open, visible => {
  draftVersion++
  if (!visible) return
  initializeDraft()
  if (!dictTypes.value.length) loadDictTypes()
}, { immediate: true })
</script>

<style scoped lang="scss">
.form-tip { margin-top: 5px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.5; }
.two-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.field-alert { margin-bottom: 18px; }
.source-config { padding: 0 0 18px; }
.section-title { display: flex; align-items: center; justify-content: space-between; margin: 8px 0 12px; padding-bottom: 8px; font-weight: 600; border-bottom: 1px solid var(--el-border-color-lighter); }
.option-editor { padding: 12px; margin-bottom: 20px; background: var(--el-fill-color-extra-light); border-radius: 8px; }
.option-row { display: grid; grid-template-columns: 1fr 1fr 130px 36px 32px; gap: 8px; align-items: center; margin-bottom: 8px; }
.color-option-item { display: flex; align-items: center; gap: 8px; }
.color-badge { width: 12px; height: 12px; border-radius: 50%; display: inline-block; flex: none; border: 1px solid rgba(0, 0, 0, 0.1); }
.switch-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin-bottom: 22px; }
.switch-grid label { display: flex; align-items: center; justify-content: space-between; padding: 11px 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 7px; }
.switch-grid b, .switch-grid small { display: block; }
.switch-grid b { font-size: 13px; }
.switch-grid small { margin-top: 4px; color: var(--el-text-color-secondary); font-size: 11px; }
.required-config-panel {
  padding: 14px 16px 6px;
  margin-top: -10px;
  margin-bottom: 20px;
  background: var(--el-fill-color-extra-light);
  border: 1px dashed var(--el-color-warning-light-5);
  border-radius: 8px;
}
.required-config-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-warning-dark-2);
  margin-bottom: 6px;
}
.required-color-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.advanced-config :deep(.el-form-item) { margin-bottom: 18px; }
</style>
