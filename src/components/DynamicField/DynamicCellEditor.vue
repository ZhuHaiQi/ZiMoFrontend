<template>
  <!-- 先于子控件捕获 Esc，避免 el-select 拦截事件后只关闭下拉面板。 -->
  <div class="dynamic-cell-editor" @click.stop @keydown.esc.capture.stop.prevent="cancel">
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
          v-for="option in options"
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
        <el-radio v-for="option in options" :key="String(option.value)" :value="option.value">
          {{ option.label }}
        </el-radio>
      </el-radio-group>
      <el-checkbox-group
        v-else-if="field.componentType === 'checkbox'"
        v-model="editorValue"
        v-bind="componentProps(field)"
      >
        <el-checkbox v-for="option in options" :key="String(option.value)" :value="option.value">
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
import { choiceValue, normalizeValueForField, componentProps, placeholderOf } from '@/utils/dynamicField'

const props = defineProps({
  modelValue: { default: undefined },
  field: { type: Object, required: true },
  options: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])
const controlRef = ref()
const editorValue = computed({
  get: () => choiceValue(props.field, props.modelValue, props.options),
  set: value => updateValue(normalizeValueForField(props.field, value))
})

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
