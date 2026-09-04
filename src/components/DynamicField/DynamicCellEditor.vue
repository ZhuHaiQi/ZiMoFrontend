<template>
  <div class="dynamic-cell-editor" @click.stop @keydown.esc.stop.prevent="cancel">
    <div class="editor-control">
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
        :model-value="modelValue"
        :multiple="field.componentType === 'multi-select'"
        :placeholder="placeholderOf(field)"
        v-bind="componentProps(field)"
        popper-class="vxe-table--ignore-clear"
        style="width: 100%"
        @update:model-value="updateValue"
      >
        <el-option
          v-for="option in optionsOf(field)"
          :key="String(option.value)"
          :label="option.label"
          :value="optionValue(field, option.value)"
        />
      </el-select>
      <el-radio-group
        v-else-if="field.componentType === 'radio'"
        :model-value="modelValue"
        v-bind="componentProps(field)"
        @update:model-value="updateValue"
      >
        <el-radio v-for="option in optionsOf(field)" :key="String(option.value)" :value="optionValue(field, option.value)">
          {{ option.label }}
        </el-radio>
      </el-radio-group>
      <el-checkbox-group
        v-else-if="field.componentType === 'checkbox'"
        :model-value="modelValue"
        v-bind="componentProps(field)"
        @update:model-value="updateValue"
      >
        <el-checkbox v-for="option in optionsOf(field)" :key="String(option.value)" :value="optionValue(field, option.value)">
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
const props = defineProps({
  modelValue: { default: undefined },
  field: { type: Object, required: true },
  dictOptions: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])
const controlRef = ref()

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
  if (field.optionSource === 'DICT' && field.dictType) return props.dictOptions[field.dictType] || []
  return parseJson(field.optionsJson, [])
}

function optionValue(field, value) {
  if (field.dataType === 'BOOLEAN') return value === true || value === 1 || value === '1' || value === 'true'
  return value
}

function componentProps(field) {
  const result = { ...parseJson(field.componentPropsJson, {}) }
  delete result.span
  if (['select', 'multi-select'].includes(field.componentType) && result.clearable === undefined) {
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
.dynamic-cell-editor { display: flex; align-items: center; width: 100%; min-width: 0; }
.editor-control { flex: 1; min-width: 0; }
</style>
