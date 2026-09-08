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
    :seq-config="seqConfig"
    :scroll-y="scrollYConfig"
    :edit-config="editConfig"
    :cell-class-name="cellClassName"
    :cell-style="cellStyle"
    show-overflow="ellipsis"
    v-bind="$attrs"
    @sort-change="handleSortChange"
    @edit-activated="handleEditActivated"
    @edit-closed="handleEditClosed"
  >
    <vxe-column v-if="showRowNumber" type="seq" title="序号" width="70" fixed="left" align="center" />
    <vxe-column
      v-for="field in visibleFields"
      :key="field.fieldKey"
      :field="field.fieldKey"
      :title="field.fieldLabel"
      :min-width="field.columnWidth || 140"
      :sortable="field.sortable"
      :align="field.align || 'center'"
      :edit-render="editableFieldKeys.has(field.fieldKey) ? {} : null"
    >
      <template #header>
        <!-- 自定义表头插槽会替换 vxe 内置的 renderEditHeader，铅笔图标需要手动补回。 -->
        <span v-if="editableFieldKeys.has(field.fieldKey)" class="vxe-cell--edit-icon"><i class="vxe-table-icon-edit" /></span>
        <span v-if="field.required" class="required-mark">*</span>{{ field.fieldLabel }}
      </template>
      <template #edit="{ row }">
        <!-- 编辑槽只在 VXE 激活当前单元格时渲染。 -->
        <dynamic-cell-editor
          :model-value="editing.value"
          :field="field"
          :options="optionsOf(field)"
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
            'is-saving': isCellSaving(row, field),
            [`is-align-${field.align || 'center'}`]: true
          }"
          :title="cellTitle(row, field)"
        >
          <div class="cell-content">
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
              <template v-if="isShowAsTag(field)">
                <!-- 显式开启以标签展示时渲染为 Tag -->
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
                <!-- 默认以纯文本展示，不包裹 Tag；配置了自定义颜色则显示彩色状态圆点 -->
                <span class="options-text">
                  <template v-for="(item, idx) in selectedOptions(field, row[field.fieldKey])" :key="String(item.value)">
                    <span v-if="idx > 0">、</span>
                    <span v-if="item.color" class="option-color-text" :style="{ color: item.color }">
                      <i class="color-dot" :style="{ backgroundColor: item.color }" />{{ item.label }}
                    </span>
                    <span v-else>{{ item.label }}</span>
                  </template>
                  <span v-if="!selectedOptions(field, row[field.fieldKey]).length">-</span>
                </span>
              </template>
            </template>
            <template v-else>
              {{ displayValue(field, row[field.fieldKey]) }}
            </template>
          </div>
          <span v-if="isCellSaving(row, field)" class="saving-hint" title="保存中...">
            <el-icon class="is-loading"><Loading /></el-icon>
          </span>
          <span v-else-if="isEditable(row, field)" class="edit-hint" title="点击编辑">
            <el-icon><Edit /></el-icon>
          </span>
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
import { Edit, Loading } from '@element-plus/icons-vue'
import { dictColorTagStyle } from '@/utils/dictColor'
import { parseJson, isEmpty, booleanValue, isTableFieldEditable, isChoiceField as hasOptions } from '@/utils/dynamicField'
import { useFieldOptions } from './useFieldOptions'
import DynamicCellEditor from './DynamicCellEditor.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  fields: { type: Array, default: () => [] },
  data: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  dictOptions: { type: Object, default: () => ({}) },
  border: { type: [Boolean, String], default: true },
  stripe: { type: Boolean, default: true },
  maxHeight: { type: [String, Number], default: 620 },
  editable: { type: [Boolean, Function], default: false },
  showRowNumber: { type: Boolean, default: false },
  sequenceStart: { type: Number, default: 0 },
  defaultSortField: { type: String, default: '' },
  defaultSortOrder: { type: String, default: 'desc' }
})

const emit = defineEmits(['sort-change', 'cell-change'])
const tableRef = ref()
const { optionsOf } = useFieldOptions(() => props.fields, () => props.dictOptions)

const editing = reactive({ row: null, field: null, value: undefined, originalValue: undefined, cancelled: false })

const rowConfig = { keyField: '_clientId', isHover: true, height: 48 }
const columnConfig = { resizable: true }
const seqConfig = computed(() => ({ startIndex: props.sequenceStart }))
const sortConfig = computed(() => ({
  remote: true,
  defaultSort: props.defaultSortField
    ? { field: props.defaultSortField, order: props.defaultSortOrder === 'asc' ? 'asc' : 'desc' }
    : undefined
}))
const scrollYConfig = computed(() => ({ enabled: props.data.length > 50, gt: 50 }))
const editConfig = computed(() => ({
  trigger: 'click',
  mode: 'cell',
  showStatus: false,
  autoClear: true,
  beforeEditMethod: ({ row, column }) => {
    const field = fieldOf(column.field)
    return !!field && isEditable(row, field) && !row._saving
  }
}))

const visibleFields = computed(() => props.fields
  .filter(field => field.status !== '1' && field.listVisible !== false)
  .sort((a, b) => (a.sort || 0) - (b.sort || 0)))

const editableFieldKeys = computed(() => new Set(visibleFields.value
  .filter(isTableFieldEditable).map(field => field.fieldKey)))

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

const fieldMap = computed(() => new Map(visibleFields.value.map(field => [field.fieldKey, field])))

function fieldOf(fieldKey) {
  return fieldMap.value.get(fieldKey)
}

function handleEditActivated({ row, column }) {
  const field = fieldOf(column.field)
  if (!field) return
  editing.row = row
  editing.field = field
  editing.value = cloneValue(row[field.fieldKey])
  editing.originalValue = cloneValue(row[field.fieldKey])
  editing.cancelled = false
}

/** VXE 在点击其它单元格或表格外部时触发 edit-closed，由此统一执行失焦保存。 */
function handleEditClosed({ row, column }) {
  const field = editing.field || fieldOf(column.field)
  if (!field || editing.row !== row) return resetEditing()
  if (!editing.cancelled && editableFieldKeys.value.has(field.fieldKey)) {
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

function getFieldRequiredColor(field) {
  const validation = parseJson(field?.validationJson, {})
  return validation.requiredColor || '#fff0f0'
}

function cellStyle({ row, column }) {
  const field = fieldOf(column.field)
  if (field?.required && isEmpty(row[field.fieldKey])) {
    return {
      backgroundColor: getFieldRequiredColor(field)
    }
  }
  return null
}

function cellClassName({ row, column }) {
  const field = fieldOf(column.field)
  return field?.required && isEmpty(row[field.fieldKey]) ? 'required-empty-cell' : ''
}

function isEditable(row, field) {
  if (!editableFieldKeys.value.has(field.fieldKey)) return false
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
  const field = fieldOf(fieldKey)
  if (row && field && !row._saving && isEditable(row, field)) {
    await tableRef.value?.setEditCell(row, fieldKey)
  }
}

async function finishEdit(row) {
  await tableRef.value?.clearEdit(row)
}

async function cancelEdit(row) {
  if (!row || editing.row === row) editing.cancelled = true
  await tableRef.value?.clearEdit(row)
}

async function applySort(field, order) {
  if (field) await tableRef.value?.sort(field, order === 'asc' ? 'asc' : 'desc')
  else await tableRef.value?.clearSort()
}

function resetEditing() {
  editing.row = null
  editing.field = null
  editing.value = undefined
  editing.originalValue = undefined
  editing.cancelled = false
}

function isShowAsTag(field) {
  const componentProps = parseJson(field.componentPropsJson, {})
  return Boolean(componentProps.showAsTag)
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

function cloneValue(value) {
  if (value === undefined || value === null || typeof value !== 'object') return value
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value))
}

defineExpose({ startEdit, finishEdit, cancelEdit, applySort })
</script>

<style scoped>
/* 锁定 VXE Table 行高与单元格尺寸，彻底消除重排与状态切换引起的垂直抖动 */
:deep(.vxe-table--render-default .vxe-body--row) {
  height: 48px !important;
}
:deep(.vxe-table--render-default .vxe-body--column) {
  height: 48px !important;
  padding: 0 !important;
}
:deep(.vxe-table--render-default .vxe-cell) {
  height: 48px !important;
  max-height: 48px !important;
  padding: 0 8px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.dynamic-cell {
  position: relative;
  height: 32px;
  min-height: 32px;
  line-height: 32px;
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
  padding: 0 16px;
  border-radius: 4px;
}
.dynamic-cell.is-align-left {
  justify-content: flex-start;
  padding-left: 4px;
  padding-right: 20px;
}
.dynamic-cell.is-align-left .cell-content { text-align: left; }
.dynamic-cell.is-align-center {
  justify-content: center;
  padding-left: 16px;
  padding-right: 16px;
}
.dynamic-cell.is-align-center .cell-content { text-align: center; }
.dynamic-cell.is-align-right {
  justify-content: flex-end;
  padding-left: 20px;
  padding-right: 22px;
}
.dynamic-cell.is-align-right .cell-content { text-align: right; }
.dynamic-cell.is-editable { cursor: text; }
.dynamic-cell.is-editable:hover { background: var(--el-fill-color-light); }
.dynamic-cell.is-required-empty,
.dynamic-cell.is-required-empty.is-editable:hover {
  background: transparent !important;
}
.cell-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.required-mark { margin-right: 3px; color: var(--el-color-danger); }
:deep(.vxe-body--column.required-empty-cell) {
  background-color: var(--el-color-danger-light-9);
  transition: background-color .15s ease-in-out, filter .15s ease-in-out;
}
:deep(.vxe-body--column.required-empty-cell:hover) {
  filter: brightness(0.96);
}

/* 图标采用绝对定位脱离文档流，杜绝任何对文字宽度的挤压与横向晃动 */
.edit-hint, .saving-hint {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  line-height: 1;
  pointer-events: none;
}
.edit-hint {
  color: var(--el-color-primary);
  opacity: 0;
  transition: opacity .15s ease-in-out;
}
.dynamic-cell:hover .edit-hint {
  opacity: .9;
}
.saving-hint {
  color: var(--el-color-primary);
}
.saving-hint .is-loading {
  animation: rotating 2s linear infinite;
}
@keyframes rotating {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.color-value { display: inline-flex; align-items: center; gap: 7px; }
.color-value i { width: 14px; height: 14px; border-radius: 4px; border: 1px solid var(--el-border-color); }
.option-tag { margin-right: 5px; }
.option-color-text { display: inline-flex; align-items: center; gap: 4px; }
.color-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; flex: none; }
</style>
