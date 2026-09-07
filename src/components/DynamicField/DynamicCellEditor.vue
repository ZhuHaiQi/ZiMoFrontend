<template>
  <div class="dynamic-cell-editor" @click.stop @keydown.esc.stop.prevent="cancel">
    <div class="editor-control" :class="['is-align-' + (field.align || 'center')]">
      <el-input
        v-if="field.componentType === 'input' || field.componentType === 'textarea'"
        ref="controlRef"
        :model-value="modelValue"
        :type="field.componentType === 'textarea' ? 'textarea' : 'text'"
        :autosize="field.componentType === 'textarea' ? { minRows: 2, maxRows: 4 } : undefined"
        :placeholder="placeholderOf(field)"
        v-bind="componentProps(field)"
        @update:model-value="updateValue"
        @keydown.enter="handleTextEnter"
      />
      <el-input-number
        v-else-if="field.componentType === 'input-number'"
        ref="controlRef"
        :model-value="modelValue"
        v-bind="componentProps(field)"
        controls-position="right"
        style="width: 100%"
        @update:model-value="updateValue"
        @keydown.enter.stop.prevent="commit"
      />
      <el-select
        v-else-if="field.componentType === 'select' || field.componentType === 'multi-select'"
        ref="controlRef"
        v-model="editorValue"
        :multiple="field.componentType === 'multi-select'"
        :placeholder="placeholderOf(field)"
        v-bind="componentProps(field)"
        popper-class="vxe-table--ignore-clear"
        style="width: 100%"
        @clear="updateValue(['multi-select'].includes(field.componentType) ? [] : null)"
      >
        <el-option
          v-for="option in optionsOf(field)"
          :key="String(option.value)"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-radio-group
        v-else-if="field.componentType === 'radio'"
        v-model="editorValue"
        v-bind="componentProps(field)"
      >
        <el-radio v-for="option in optionsOf(field)" :key="String(option.value)" :value="option.value">
          {{ option.label }}
        </el-radio>
      </el-radio-group>
      <el-checkbox-group
        v-else-if="field.componentType === 'checkbox'"
        v-model="editorValue"
        v-bind="componentProps(field)"
      >
        <el-checkbox v-for="option in optionsOf(field)" :key="String(option.value)" :value="option.value">
          {{ option.label }}
        </el-checkbox>
      </el-checkbox-group>
      <el-switch
        v-else-if="field.componentType === 'switch'"
        :model-value="modelValue"
        v-bind="componentProps(field)"
        @update:model-value="updateValue"
      />
      <el-date-picker
        v-else-if="field.componentType === 'date-picker' || field.componentType === 'datetime-picker'"
        ref="controlRef"
        :model-value="modelValue"
        :type="field.componentType === 'datetime-picker' ? 'datetime' : 'date'"
        :value-format="field.componentType === 'datetime-picker' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'"
        :placeholder="placeholderOf(field)"
        v-bind="componentProps(field)"
        popper-class="vxe-table--ignore-clear"
        style="width: 100%"
        @update:model-value="updateValue"
      />
      <el-slider
        v-else-if="field.componentType === 'slider'"
        :model-value="modelValue"
        v-bind="componentProps(field)"
        @update:model-value="updateValue"
      />
      <el-rate
        v-else-if="field.componentType === 'rate'"
        :model-value="modelValue"
        v-bind="componentProps(field)"
        @update:model-value="updateValue"
      />
      <el-color-picker
        v-else-if="field.componentType === 'color-picker'"
        ref="controlRef"
        :model-value="modelValue"
        v-bind="componentProps(field)"
        popper-class="vxe-table--ignore-clear"
        @update:model-value="updateValue"
      />
      <el-input
        v-else
        ref="controlRef"
        :model-value="modelValue"
        :placeholder="placeholderOf(field)"
        @update:model-value="updateValue"
        @keydown.enter.stop.prevent="commit"
      />
    </div>
  </div>
</template>

<script setup name="DynamicCellEditor">
import { fetchApiOptions } from '@/utils/dynamicSource'

const props = defineProps({
  modelValue: { default: undefined },
  field: { type: Object, required: true },
  dictOptions: { type: Object, default: () => ({}) },
  cachedApiOptions: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])
const controlRef = ref()
const apiOptions = ref([])

const isChoiceComponent = computed(() => ['select', 'multi-select', 'radio', 'checkbox'].includes(props.field.componentType))
const isMultiChoice = computed(() => ['multi-select', 'checkbox'].includes(props.field.componentType))

/**
 * 自适应对齐选项类型（彻底解决数字/字符串严格全等匹配失败导致回显为 1 的问题）
 */
const editorValue = computed({
  get: () => {
    const val = props.modelValue
    if (val === undefined || val === null || val === '') {
      return isMultiChoice.value ? [] : undefined
    }
    if (isChoiceComponent.value) {
      const options = optionsOf(props.field)
      if (isMultiChoice.value) {
        const arr = Array.isArray(val) ? val : [val]
        return arr.map(item => {
          const matched = options.find(opt => String(opt.value) === String(item))
          return matched !== undefined ? matched.value : item
        })
      } else {
        const matched = options.find(opt => String(opt.value) === String(val))
        return matched !== undefined ? matched.value : val
      }
    }
    return val
  },
  set: (newVal) => {
    updateValue(normalizeValueForField(props.field, newVal))
  }
})

function normalizeValueForField(field, value) {
  if (value === undefined || value === null || value === '') {
    return ['multi-select', 'checkbox'].includes(field.componentType) ? [] : null
  }
  if (field.dataType === 'BOOLEAN') {
    return value === true || value === 1 || value === '1' || value === 'true'
  }
  if (field.dataType === 'STRING') {
    if (Array.isArray(value)) return value.map(v => String(v))
    return String(value)
  }
  if (['INTEGER', 'DECIMAL'].includes(field.dataType)) {
    if (Array.isArray(value)) return value.map(v => Number(v))
    const num = Number(value)
    return isNaN(num) ? value : num
  }
  return value
}

async function loadApiOptions() {
  if (props.field.optionSource !== 'API') return
  if (props.cachedApiOptions?.length) return
  const componentProps = parseJson(props.field.componentPropsJson, {})
  const apiConfig = componentProps.apiConfig
  if (apiConfig?.url) {
    apiOptions.value = await fetchApiOptions(apiConfig)
  }
}

watch(() => props.field, () => loadApiOptions(), { immediate: true, deep: true })

onMounted(() => nextTick(() => controlRef.value?.focus?.()))

function updateValue(value) {
  emit('update:modelValue', value)
}

function commit() {
  emit('save')
}

function cancel() {
  emit('cancel')
}

function handleTextEnter(event) {
  // 所有输入控件统一使用 Enter 保存；多行文本可用 Shift+Enter 换行。
  if (props.field.componentType === 'textarea' && event.shiftKey) return
  event.preventDefault()
  event.stopPropagation()
  commit()
}

function parseJson(value, fallback) {
  if (!value) return fallback
  try { return typeof value === 'string' ? JSON.parse(value) : value } catch { return fallback }
}

function optionsOf(field) {
  if (field.optionSource === 'DICT' && field.dictType) {
    const list = props.dictOptions[field.dictType] || []
    return list.map(opt => ({
      ...opt,
      label: opt.label ?? opt.dictLabel,
      value: opt.value ?? opt.dictValue
    }))
  }
  if (field.optionSource === 'API') {
    return props.cachedApiOptions?.length ? props.cachedApiOptions : apiOptions.value
  }
  return parseJson(field.optionsJson, [])
}

function componentProps(field) {
  const result = { ...parseJson(field.componentPropsJson, {}) }
  delete result.span
  if (['input', 'select', 'multi-select', 'date-picker', 'datetime-picker'].includes(field.componentType) && result.clearable === undefined) {
    result.clearable = true
  }
  return result
}

function placeholderOf(field) {
  if (field.placeholder) return field.placeholder
  return ['select', 'multi-select', 'date-picker', 'datetime-picker'].includes(field.componentType)
    ? `请选择${field.fieldLabel}` : `请输入${field.fieldLabel}`
}
</script>

<style scoped>
.dynamic-cell-editor {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  height: 32px;
  box-sizing: border-box;
}
.editor-control {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  height: 32px;
}
.editor-control :deep(.el-input),
.editor-control :deep(.el-select),
.editor-control :deep(.el-input-number),
.editor-control :deep(.el-date-editor) {
  width: 100%;
  height: 32px;
  --el-component-size: 32px;
}
.editor-control :deep(.el-input__wrapper),
.editor-control :deep(.el-select__wrapper) {
  min-height: 32px;
  height: 32px;
  box-sizing: border-box;
}
.editor-control.is-align-left :deep(.el-input__inner),
.editor-control.is-align-left :deep(.el-select__placeholder),
.editor-control.is-align-left :deep(.el-select__selected-item) {
  text-align: left;
}
.editor-control.is-align-center :deep(.el-input__inner),
.editor-control.is-align-center :deep(.el-select__placeholder),
.editor-control.is-align-center :deep(.el-select__selected-item) {
  text-align: center;
}
.editor-control.is-align-right :deep(.el-input__inner),
.editor-control.is-align-right :deep(.el-select__placeholder),
.editor-control.is-align-right :deep(.el-select__selected-item) {
  text-align: right;
}
</style>
