<template>
  <el-form ref="formRef" :model="formState" :rules="rules" :label-width="labelWidth" :disabled="disabled">
    <el-row :gutter="20">
      <el-col v-for="field in visibleFields" :key="field.fieldKey" :span="fieldSpan(field)">
        <el-form-item :label="field.fieldLabel" :prop="field.fieldKey">
          <el-input
            v-if="field.componentType === 'input' || field.componentType === 'textarea'"
            v-model="formState[field.fieldKey]"
            :type="field.componentType === 'textarea' ? 'textarea' : 'text'"
            :placeholder="placeholderOf(field)"
            v-bind="componentProps(field)"
          />
          <el-input-number
            v-else-if="field.componentType === 'input-number'"
            v-model="formState[field.fieldKey]"
            v-bind="componentProps(field)"
            style="width: 100%"
          />
          <el-select
            v-else-if="field.componentType === 'select' || field.componentType === 'multi-select'"
            v-model="formState[field.fieldKey]"
            :multiple="field.componentType === 'multi-select'"
            :placeholder="placeholderOf(field)"
            v-bind="componentProps(field)"
            style="width: 100%"
          >
            <el-option v-for="option in optionsOf(field)" :key="option.value" :label="option.label" :value="optionValue(field, option.value)" />
          </el-select>
          <el-radio-group v-else-if="field.componentType === 'radio'" v-model="formState[field.fieldKey]" v-bind="componentProps(field)">
            <el-radio v-for="option in optionsOf(field)" :key="option.value" :value="optionValue(field, option.value)">{{ option.label }}</el-radio>
          </el-radio-group>
          <el-checkbox-group v-else-if="field.componentType === 'checkbox'" v-model="formState[field.fieldKey]" v-bind="componentProps(field)">
            <el-checkbox v-for="option in optionsOf(field)" :key="option.value" :value="optionValue(field, option.value)">{{ option.label }}</el-checkbox>
          </el-checkbox-group>
          <el-switch v-else-if="field.componentType === 'switch'" v-model="formState[field.fieldKey]" v-bind="componentProps(field)" />
          <el-date-picker
            v-else-if="field.componentType === 'date-picker' || field.componentType === 'datetime-picker'"
            v-model="formState[field.fieldKey]"
            :type="field.componentType === 'datetime-picker' ? 'datetime' : 'date'"
            :value-format="field.componentType === 'datetime-picker' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'"
            :placeholder="placeholderOf(field)"
            v-bind="componentProps(field)"
            style="width: 100%"
          />
          <el-slider v-else-if="field.componentType === 'slider'" v-model="formState[field.fieldKey]" v-bind="componentProps(field)" />
          <el-rate v-else-if="field.componentType === 'rate'" v-model="formState[field.fieldKey]" v-bind="componentProps(field)" />
          <el-color-picker v-else-if="field.componentType === 'color-picker'" v-model="formState[field.fieldKey]" v-bind="componentProps(field)" />
          <el-alert v-else type="warning" :closable="false" :title="`暂不支持组件 ${field.componentType}`" />
        </el-form-item>
      </el-col>
    </el-row>
  </el-form>
</template>

<script setup name="DynamicFieldForm">
const props = defineProps({
  fields: { type: Array, default: () => [] },
  modelValue: { type: Object, default: () => ({}) },
  dictOptions: { type: Object, default: () => ({}) },
  disabled: { type: Boolean, default: false },
  labelWidth: { type: [String, Number], default: '110px' },
  columns: { type: Number, default: 2 }
})

const emit = defineEmits(['update:modelValue'])
const formRef = ref()
const syncing = ref(false)
const formState = reactive({})

const visibleFields = computed(() => props.fields
  .filter(field => field.status !== '1' && field.formVisible !== false)
  .sort((a, b) => (a.sort || 0) - (b.sort || 0)))

const rules = computed(() => {
  const result = {}
  visibleFields.value.forEach(field => {
    const custom = parseJson(field.validationJson, {})
    const itemRules = []
    if (field.required) {
      itemRules.push({ required: true, message: `${field.fieldLabel}不能为空`, trigger: changeTrigger(field) })
    }
    const rule = {}
    ;['min', 'max', 'len'].forEach(key => {
      if (custom[key] !== undefined && custom[key] !== '') rule[key] = Number(custom[key])
    })
    if (custom.pattern) rule.pattern = new RegExp(custom.pattern)
    if (Object.keys(rule).length) {
      rule.message = custom.message || `${field.fieldLabel}格式不正确`
      rule.trigger = changeTrigger(field)
      itemRules.push(rule)
    }
    if (itemRules.length) result[field.fieldKey] = itemRules
  })
  return result
})

watch(() => props.modelValue, value => syncFromModel(value), { deep: true, immediate: true })
watch(() => props.fields, () => initializeDefaults(), { deep: true, immediate: true })
watch(formState, value => {
  if (!syncing.value) emit('update:modelValue', { ...value })
}, { deep: true })

function syncFromModel(value) {
  syncing.value = true
  Object.keys(formState).forEach(key => delete formState[key])
  Object.assign(formState, value || {})
  initializeDefaults()
  nextTick(() => { syncing.value = false })
}

function initializeDefaults() {
  visibleFields.value.forEach(field => {
    if (formState[field.fieldKey] === undefined) formState[field.fieldKey] = defaultValueOf(field)
  })
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
function fieldSpan(field) {
  const span = Number(parseJson(field.componentPropsJson, {}).span)
  return span >= 1 && span <= 24 ? span : 24 / Math.max(1, props.columns)
}
function placeholderOf(field) {
  if (field.placeholder) return field.placeholder
  return ['select', 'multi-select', 'date-picker', 'datetime-picker'].includes(field.componentType)
    ? `请选择${field.fieldLabel}` : `请输入${field.fieldLabel}`
}
function changeTrigger(field) {
  return ['input', 'textarea', 'input-number'].includes(field.componentType) ? 'blur' : 'change'
}
function defaultValueOf(field) {
  if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {
    if (field.dataType === 'BOOLEAN') return String(field.defaultValue) === 'true'
    if (['INTEGER', 'DECIMAL'].includes(field.dataType)) return Number(field.defaultValue)
    if (field.dataType === 'JSON') return parseJson(field.defaultValue, [])
    return field.defaultValue
  }
  if (field.dataType === 'BOOLEAN') return false
  if (field.dataType === 'JSON') return []
  return undefined
}

function validate(callback) { return formRef.value?.validate(callback) }
function resetFields() { formRef.value?.resetFields() }
defineExpose({ validate, resetFields, form: formState })
</script>
