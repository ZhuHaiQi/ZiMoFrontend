<template>
  <vxe-table
    ref="tableRef"
    :data="data"
    :loading="loading"
    :border="border"
    :stripe="stripe"
    :max-height="maxHeight"
    :row-config="rowConfig"
    :column-config="columnConfig"
    :sort-config="sortConfig"
    :scroll-y="scrollYConfig"
    :edit-config="editConfig"
    :cell-class-name="cellClassName"
    show-overflow="ellipsis"
    v-bind="$attrs"
    @sort-change="handleSortChange"
    @edit-activated="handleEditActivated"
    @edit-closed="handleEditClosed"
  >
    <vxe-column
      v-for="field in visibleFields"
      :key="field.fieldKey"
      :field="field.fieldKey"
      :title="field.fieldLabel"
      :min-width="field.columnWidth || 140"
      :sortable="field.sortable"
      :edit-render="field.formVisible === false ? null : {}"
    >
      <template #header>
        <!-- 自定义表头插槽会替换 vxe 内置的 renderEditHeader，铅笔图标需要手动补回。 -->
        <span v-if="field.formVisible !== false" class="vxe-cell--edit-icon"><i class="vxe-table-icon-edit" /></span>
        <span v-if="field.required" class="required-mark">*</span>{{ field.fieldLabel }}
      </template>
      <template #edit="{ row }">
        <!-- 编辑槽只在 VXE 激活当前单元格时渲染，动态控件本身继续异步拆包。 -->
        <dynamic-cell-editor
          :model-value="editing.value"
          :field="field"
          :dict-options="dictOptions"
          @update:model-value="editing.value = $event"
          @save="finishEdit(row)"
          @cancel="cancelEdit(row)"
        />
      </template>
      <template #default="{ row }">
        <div
          class="dynamic-cell"
          :class="{
            'is-editable': isEditable(row, field),
            'is-required-empty': field.required && isEmpty(row[field.fieldKey]),
            'is-saving': isCellSaving(row, field)
          }"
          :title="cellTitle(row, field)"
        >
          <template v-if="field.dataType === 'BOOLEAN' && !hasOptions(field)">
            <el-tag :type="booleanValue(row[field.fieldKey]) ? 'success' : 'info'" effect="light">
              {{ booleanValue(row[field.fieldKey]) ? '是' : '否' }}
            </el-tag>
          </template>
          <template v-else-if="field.componentType === 'color-picker'">
            <span class="color-value">
              <i :style="{ backgroundColor: row[field.fieldKey] || '#dcdfe6' }" />
              {{ row[field.fieldKey] || '-' }}
            </span>
          </template>
          <template v-else-if="hasOptions(field)">
            <!-- 字典字段复用若依 DictTag，完整支持回显样式、样式属性和自定义颜色。 -->
            <dict-tag
              v-if="field.optionSource === 'DICT'"
              :options="dictTagOptions[field.dictType] || []"
              :value="row[field.fieldKey]"
              :show-value="false"
            />
            <template v-else v-for="item in selectedOptions(field, row[field.fieldKey])" :key="String(item.value)">
              <el-tag v-if="item.color" :style="dictColorTagStyle(item.color)" class="option-tag" effect="light">{{ item.label }}</el-tag>
              <el-tag v-else :type="item.type || item.elTagType || ''" :class="item.cssClass || item.elTagClass" class="option-tag" effect="light">{{ item.label }}</el-tag>
            </template>
            <span v-if="!selectedOptions(field, row[field.fieldKey]).length">-</span>
          </template>
          <template v-else>
            {{ displayValue(field, row[field.fieldKey]) }}
          </template>
          <span v-if="isCellSaving(row, field)" class="saving-hint">保存中...</span>
          <span v-else-if="isEditable(row, field)" class="edit-hint">编辑</span>
        </div>
      </template>
    </vxe-column>

    <vxe-column v-if="$slots.version" title="版本" field="_version" width="75" align="center">
      <template #default="scope"><slot name="version" v-bind="scope" /></template>
    </vxe-column>
    <vxe-column v-if="$slots.actions" title="操作" width="140" fixed="right" align="center">
      <template #default="scope"><slot name="actions" v-bind="scope" /></template>
    </vxe-column>
  </vxe-table>
</template>

<script setup name="DynamicFieldTable">
import { VxeTable, VxeColumn } from 'vxe-table'
import 'vxe-table/lib/style.css'
import { dictColorTagStyle } from '@/utils/dictColor'

// 动态编辑器与表格主体分包，浏览数据时不会初始化 Element Plus 表单控件。
const DynamicCellEditor = defineAsyncComponent(() => import('./DynamicCellEditor.vue'))

defineOptions({ inheritAttrs: false })

const props = defineProps({
  fields: { type: Array, default: () => [] },
  data: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  dictOptions: { type: Object, default: () => ({}) },
  border: { type: [Boolean, String], default: true },
  stripe: { type: Boolean, default: true },
  maxHeight: { type: [String, Number], default: 620 },
  editable: { type: [Boolean, Function], default: false }
})

const emit = defineEmits(['sort-change', 'row-click', 'cell-change', 'cancel-cell'])
const tableRef = ref()

const editing = reactive({ row: null, field: null, value: undefined, originalValue: undefined, cancelled: false })

const rowConfig = { keyField: '_clientId', isHover: true }
const columnConfig = { resizable: true }
const sortConfig = { remote: true }
const scrollYConfig = computed(() => ({ enabled: props.data.length > 50, gt: 50 }))
const editConfig = computed(() => ({
  trigger: 'click',
  mode: 'cell',
  showStatus: true,
  autoClear: true,
  beforeEditMethod: ({ row, column }) => {
    const field = fieldOf(column.field)
    return !!field && isEditable(row, field) && !row._saving
  }
}))

const visibleFields = computed(() => props.fields
  .filter(field => field.status !== '1' && field.listVisible !== false)
  .sort((a, b) => (a.sort || 0) - (b.sort || 0)))

/** 将批量字典接口的数据适配为全局 DictTag 组件所需格式，仅在字典数据变化时计算。 */
const dictTagOptions = computed(() => Object.fromEntries(
  Object.entries(props.dictOptions || {}).map(([dictType, options]) => [
    dictType,
    (options || []).map(option => ({
      ...option,
      elTagType: option.elTagType ?? option.type ?? '',
      elTagClass: option.elTagClass ?? option.cssClass ?? ''
    }))
  ])
))

function fieldOf(fieldKey) {
  return visibleFields.value.find(field => field.fieldKey === fieldKey)
}

function handleEditActivated({ row, column }) {
  const field = fieldOf(column.field)
  if (!field) return
  editing.row = row
  editing.field = field
  editing.value = cloneValue(row[field.fieldKey])
  editing.originalValue = cloneValue(row[field.fieldKey])
  editing.cancelled = false
  emit('row-click', row)
}

/** VXE 在点击其它单元格或表格外部时触发 edit-closed，由此统一执行失焦保存。 */
function handleEditClosed({ row, column }) {
  const field = editing.field || fieldOf(column.field)
  if (!field || editing.row !== row) return resetEditing()
  if (editing.cancelled) {
    emit('cancel-cell', { row, field })
  } else {
    emit('cell-change', {
      row,
      field,
      value: cloneValue(editing.value),
      originalValue: cloneValue(editing.originalValue)
    })
  }
  resetEditing()
}

function handleSortChange({ field, order }) {
  emit('sort-change', {
    prop: field,
    order: order === 'asc' ? 'ascending' : order === 'desc' ? 'descending' : null
  })
}

function cellClassName({ row, column }) {
  const field = fieldOf(column.field)
  return field?.required && isEmpty(row[field.fieldKey]) ? 'required-empty-cell' : ''
}

function isEditable(row, field) {
  if (field.formVisible === false || row._saving) return false
  return typeof props.editable === 'function' ? props.editable(row, field) : props.editable
}

function isCellSaving(row, field) {
  return row._saving && row._savingFieldKey === field.fieldKey
}

function cellTitle(row, field) {
  if (isCellSaving(row, field)) return `${field.fieldLabel}正在保存`
  if (field.dataType === 'BOOLEAN') return booleanValue(row[field.fieldKey]) ? '是' : '否'
  if (hasOptions(field)) {
    const labels = selectedOptions(field, row[field.fieldKey]).map(option => option.label)
    return labels.length ? labels.join('、') : '-'
  }
  return String(displayValue(field, row[field.fieldKey]))
}

async function startEdit(row, fieldKey) {
  if (!row?._saving) await tableRef.value?.setEditCell(row, fieldKey)
}

async function finishEdit(row) {
  await tableRef.value?.clearEdit(row)
}

async function cancelEdit(row) {
  if (!row || editing.row === row) editing.cancelled = true
  await tableRef.value?.clearEdit(row)
}

function resetEditing() {
  editing.row = null
  editing.field = null
  editing.value = undefined
  editing.originalValue = undefined
  editing.cancelled = false
}

function parseJson(value, fallback) {
  if (!value) return fallback
  try { return typeof value === 'string' ? JSON.parse(value) : value } catch { return fallback }
}

function optionsOf(field) {
  if (field.optionSource === 'DICT' && field.dictType) return props.dictOptions[field.dictType] || []
  return parseJson(field.optionsJson, [])
}

function hasOptions(field) {
  return ['select', 'multi-select', 'radio', 'checkbox'].includes(field.componentType)
}

function selectedOptions(field, value) {
  const values = Array.isArray(value) ? value : [value]
  return optionsOf(field).filter(option => values.some(item => String(item) === String(option.value)))
}

function displayValue(field, value) {
  if (isEmpty(value)) return '-'
  if (Array.isArray(value)) return value.join('、')
  if (typeof value === 'object') return JSON.stringify(value)
  if (field.dataType === 'DATE') return String(value).slice(0, 10)
  if (field.dataType === 'DATETIME') return String(value).replace('T', ' ').slice(0, 19)
  return value
}

function isEmpty(value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)
}

function booleanValue(value) {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function cloneValue(value) {
  if (value === undefined || value === null || typeof value !== 'object') return value
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value))
}

defineExpose({ startEdit, finishEdit, cancelEdit })
</script>

<style scoped>
.dynamic-cell { position: relative; min-height: 30px; display: flex; align-items: center; width: 100%; }
.dynamic-cell.is-editable { cursor: text; padding-right: 48px; border-radius: 4px; }
.dynamic-cell.is-editable:hover { background: var(--el-fill-color-light); }
.required-mark { margin-right: 3px; color: var(--el-color-danger); }
.dynamic-cell.is-required-empty { background: var(--el-color-danger-light-9); }
:deep(.vxe-body--column.required-empty-cell) { background: var(--el-color-danger-light-9) !important; }
.edit-hint, .saving-hint { position: absolute; right: 4px; font-size: 11px; }
.edit-hint { color: var(--el-color-primary); opacity: 0; transition: opacity .15s; }
.saving-hint { color: var(--el-color-warning); }
.dynamic-cell:hover .edit-hint { opacity: .85; }
.color-value { display: inline-flex; align-items: center; gap: 7px; }
.color-value i { width: 14px; height: 14px; border-radius: 4px; border: 1px solid var(--el-border-color); }
.option-tag { margin-right: 5px; }
</style>
