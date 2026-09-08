<template>
  <el-form ref="formRef" :model="formState" :rules="rules" :label-width="labelWidth" :disabled="disabled">
    <el-row :gutter="20">
      <el-col
        v-for="field in visibleFields"
        :key="field.fieldKey"
        :span="fieldSpan(field)"
        :xs="24"
        :sm="props.columns >= 4 ? 12 : (fieldSpan(field) <= 12 ? fieldSpan(field) : 24)"
        :md="props.columns >= 4 ? 8 : fieldSpan(field)"
        :lg="fieldSpan(field)"
        :xl="fieldSpan(field)"
      >
        <el-form-item :label="field.fieldLabel" :prop="field.fieldKey" :required="field.required">
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
            :model-value="formFieldValue(field)"
            :multiple="field.componentType === 'multi-select'"
            :placeholder="placeholderOf(field)"
            v-bind="componentProps(field)"
            style="width: 100%"
            @update:model-value="updateFormFieldValue(field, $event)"
            @clear="updateFormFieldValue(field, ['multi-select'].includes(field.componentType) ? [] : '')"
          >
            <el-option v-for="option in optionsOf(field)" :key="String(option.value)" :label="option.label" :value="option.value" />
          </el-select>
          <el-radio-group
            v-else-if="field.componentType === 'radio'"
            :model-value="formFieldValue(field)"
            v-bind="componentProps(field)"
            @update:model-value="updateFormFieldValue(field, $event)"
          >
            <el-radio v-for="option in optionsOf(field)" :key="String(option.value)" :value="option.value">{{ option.label }}</el-radio>
          </el-radio-group>
          <el-checkbox-group
            v-else-if="field.componentType === 'checkbox'"
            :model-value="formFieldValue(field)"
            v-bind="componentProps(field)"
            @update:model-value="updateFormFieldValue(field, $event)"
          >
            <el-checkbox v-for="option in optionsOf(field)" :key="String(option.value)" :value="option.value">{{ option.label }}</el-checkbox>
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
import { parseJson, choiceValue, normalizeValueForField, componentProps, placeholderOf, defaultValueOf } from '@/utils/dynamicField'
import { useFieldOptions } from './useFieldOptions'

const props = defineProps({
  fields: { type: Array, default: () => [] },
  modelValue: { type: Object, default: () => ({}) },
  dictOptions: { type: Object, default: () => ({}) },
  disabled: { type: Boolean, default: false },
  labelWidth: { type: [String, Number], default: '110px' },
  columns: { type: Number, default: 2 },
  ignoreCustomSpan: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])
const formRef = ref()
const syncing = ref(false)
const formState = reactive({})
const { optionsOf } = useFieldOptions(() => props.fields, () => props.dictOptions)

const visibleFields = computed(() => props.fields
  .filter(field => field.status !== '1' && field.formVisible !== false)
  .sort((a, b) => (a.sort || 0) - (b.sort || 0)))

const rules = computed(() => {
  const result = {}
  visibleFields.value.forEach(field => {
    const custom = parseJson(field.validationJson, {})
    const itemRules = []
    if (field.required) {
      const mode = custom.requiredMode || 'color'
      if (mode === 'alert') {
        itemRules.push({ required: true, message: `${field.fieldLabel}不能为空`, trigger: changeTrigger(field) })
      }
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
    if (Array.isArray(custom.rowUniqueFields) && custom.rowUniqueFields.length > 0) {
      itemRules.push({
        validator: (r, value, callback) => {
          if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) {
            return callback()
          }
          for (const otherKey of custom.rowUniqueFields) {
            const otherVal = formState[otherKey]
            if (otherVal === undefined || otherVal === null || otherVal === '' || (Array.isArray(otherVal) && !otherVal.length)) {
              continue
            }
            if (JSON.stringify(value) === JSON.stringify(otherVal)) {
              const otherField = props.fields.find(f => f.fieldKey === otherKey)
              const otherLabel = otherField?.fieldLabel || otherKey
              return callback(new Error(`不能与【${otherLabel}】的值重复`))
            }
          }
          callback()
        },
        trigger: changeTrigger(field)
      })
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

function formFieldValue(field) {
  return choiceValue(field, formState[field.fieldKey], optionsOf(field))
}

function updateFormFieldValue(field, newVal) {
  formState[field.fieldKey] = normalizeValueForField(field, newVal, '')
}

function fieldSpan(field) {
  if (props.ignoreCustomSpan) {
    return Math.floor(24 / Math.max(1, props.columns))
  }
  const span = Number(parseJson(field.componentPropsJson, {}).span)
  return span >= 1 && span <= 24 ? span : Math.floor(24 / Math.max(1, props.columns))
}
function changeTrigger(field) {
  return ['input', 'textarea', 'input-number'].includes(field.componentType) ? 'blur' : 'change'
}
function validate(callback) { return formRef.value?.validate(callback) }
function resetFields() { formRef.value?.resetFields() }
defineExpose({ validate, resetFields, form: formState })
</script>
