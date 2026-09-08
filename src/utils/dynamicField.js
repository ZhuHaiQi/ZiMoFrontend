/** 动态表单、单元格编辑器和数据列表共用的字段规则。 */
export function parseJson(value, fallback) {
  if (!value) return fallback
  try { return (typeof value === 'string' ? JSON.parse(value) : value) ?? fallback } catch { return fallback }
}

export function isEmpty(value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)
}

export function isChoiceField(field) {
  return ['select', 'multi-select', 'radio', 'checkbox'].includes(field.componentType)
}

export function isMultiChoiceField(field) {
  return ['multi-select', 'checkbox'].includes(field.componentType)
}

/** 表格编辑开关默认开启，用户操作权限由调用方单独判断。 */
export function isTableFieldEditable(field) {
  return field.status !== '1' && field.listVisible !== false && field.formVisible !== false
    && parseJson(field.componentPropsJson, {}).tableEditable !== false
}

export function booleanValue(value) {
  return value === true || value === 1 || value === '1' || value === 'true'
}

/** 选项回显采用选项本身的类型，写入时再按字段数据类型转换。 */
export function choiceValue(field, value, options) {
  if (isEmpty(value)) return isMultiChoiceField(field) ? [] : undefined
  if (!isChoiceField(field)) return value
  const match = item => options.find(option => String(option.value) === String(item))?.value ?? item
  return isMultiChoiceField(field) ? (Array.isArray(value) ? value : [value]).map(match) : match(value)
}

export function normalizeValueForField(field, value, emptyValue = null) {
  if (isEmpty(value)) return isMultiChoiceField(field) ? [] : emptyValue
  if (field.dataType === 'BOOLEAN') return booleanValue(value)
  if (field.dataType === 'STRING') return Array.isArray(value) ? value.map(String) : String(value)
  if (['INTEGER', 'DECIMAL'].includes(field.dataType)) {
    const toNumber = item => Number.isNaN(Number(item)) ? item : Number(item)
    return Array.isArray(value) ? value.map(toNumber) : toNumber(value)
  }
  return value
}

export function componentProps(field) {
  const result = { ...parseJson(field.componentPropsJson, {}) }
  for (const key of ['span', 'apiConfig', 'showAsTag', 'tableEditable']) delete result[key]
  if (['input', 'select', 'multi-select', 'date-picker', 'datetime-picker'].includes(field.componentType) && result.clearable === undefined) {
    result.clearable = true
  }
  return result
}

export function placeholderOf(field) {
  return field.placeholder || (['select', 'multi-select', 'date-picker', 'datetime-picker'].includes(field.componentType)
    ? `请选择${field.fieldLabel}` : `请输入${field.fieldLabel}`)
}

export function defaultValueOf(field) {
  if (!isEmpty(field.defaultValue)) {
    if (field.dataType === 'BOOLEAN') return booleanValue(String(field.defaultValue).toLowerCase())
    if (['INTEGER', 'DECIMAL'].includes(field.dataType)) return Number(field.defaultValue)
    if (field.dataType === 'JSON') return parseJson(field.defaultValue, [])
    return field.defaultValue
  }
  if (field.dataType === 'BOOLEAN') return false
  if (field.dataType === 'JSON') return []
  return undefined
}
