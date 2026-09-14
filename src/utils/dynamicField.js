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
  const result = { ...parseJson(field?.componentPropsJson, {}) }
  for (const key of ['span', 'apiConfig', 'showAsTag', 'tableEditable', 'displayFormat', 'pickerType']) delete result[key]
  if (['input', 'select', 'multi-select', 'date-picker', 'datetime-picker', 'time-picker'].includes(field.componentType) && result.clearable === undefined) {
    result.clearable = true
  }
  return result
}

export function datePickerType(field) {
  const props = parseJson(field?.componentPropsJson, {})
  if (props.pickerType) return props.pickerType
  if (field?.componentType === 'datetime-picker' || field?.dataType === 'DATETIME') return 'datetime'
  return 'date'
}

export function datePickerFormat(field) {
  const props = parseJson(field?.componentPropsJson, {})
  if (props.format) return props.format
  if (props.pickerType === 'month') return 'YYYY-MM'
  if (field?.componentType === 'datetime-picker' || field?.dataType === 'DATETIME') return 'YYYY-MM-DD HH:mm:ss'
  if (field?.componentType === 'time-picker' || field?.dataType === 'TIME') return 'HH:mm:ss'
  return 'YYYY-MM-DD'
}

export function datePickerValueFormat(field) {
  const props = parseJson(field?.componentPropsJson, {})
  if (props.valueFormat) return props.valueFormat
  if (props.pickerType === 'month') return 'YYYY-MM'
  if (field?.componentType === 'datetime-picker' || field?.dataType === 'DATETIME') return 'YYYY-MM-DD HH:mm:ss'
  if (field?.componentType === 'time-picker' || field?.dataType === 'TIME') return 'HH:mm:ss'
  return 'YYYY-MM-DD'
}

export function placeholderOf(field) {
  return field.placeholder || (['select', 'multi-select', 'date-picker', 'datetime-picker', 'time-picker'].includes(field.componentType)
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

/** 判断是否属于日期时间类字段 */
export function isDateTimeField(field) {
  if (!field) return false
  return ['DATE', 'DATETIME', 'TIME'].includes(field.dataType)
    || ['date-picker', 'datetime-picker', 'time-picker'].includes(field.componentType)
}

/** 日期时间配置模式与常用预设定义 */
export const DATE_TIME_MODES = [
  {
    mode: 'date',
    label: '日期 (YYYY-MM-DD)',
    dataType: 'DATE',
    componentType: 'date-picker',
    defaultFormat: 'YYYY-MM-DD',
    defaultValueFormat: 'YYYY-MM-DD',
    defaultDisplayFormat: 'YYYY-MM-DD',
    formatPresets: ['YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY年MM月DD日'],
    displayPresets: ['YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY年MM月DD日', 'MM-DD', 'MM月DD日']
  },
  {
    mode: 'datetime',
    label: '日期时间 (YYYY-MM-DD HH:mm:ss)',
    dataType: 'DATETIME',
    componentType: 'datetime-picker',
    defaultFormat: 'YYYY-MM-DD HH:mm:ss',
    defaultValueFormat: 'YYYY-MM-DD HH:mm:ss',
    defaultDisplayFormat: 'YYYY-MM-DD HH:mm:ss',
    formatPresets: ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY/MM/DD HH:mm:ss', 'YYYY年MM月DD日 HH:mm'],
    displayPresets: ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD', 'MM-DD HH:mm', 'YYYY年MM月DD日 HH:mm']
  },
  {
    mode: 'time',
    label: '时间 (HH:mm:ss)',
    dataType: 'TIME',
    componentType: 'time-picker',
    defaultFormat: 'HH:mm:ss',
    defaultValueFormat: 'HH:mm:ss',
    defaultDisplayFormat: 'HH:mm:ss',
    formatPresets: ['HH:mm:ss', 'HH:mm'],
    displayPresets: ['HH:mm:ss', 'HH:mm', 'HH时mm分', 'HH时mm分ss秒']
  },
  {
    mode: 'month',
    label: '年月 (YYYY-MM)',
    dataType: 'DATE',
    componentType: 'date-picker',
    pickerType: 'month',
    defaultFormat: 'YYYY-MM',
    defaultValueFormat: 'YYYY-MM',
    defaultDisplayFormat: 'YYYY-MM',
    formatPresets: ['YYYY-MM', 'YYYY/MM', 'YYYY年MM月'],
    displayPresets: ['YYYY-MM', 'YYYY/MM', 'YYYY年MM月']
  }
]

/**
 * 健壮的原生通用日期时间格式化函数。
 * 支持输入纯时间 (11:27:46)、纯日期 (2026-09-15)、完整日期时间 (2026-09-16 00:18:59)、时间戳或 Date 对象。
 */
export function formatDateValue(value, pattern) {
  if (value === undefined || value === null || value === '') return ''
  if (!pattern || typeof pattern !== 'string') return String(value)

  let year = 1970
  let month = 1
  let date = 1
  let hours = 0
  let minutes = 0
  let seconds = 0
  let isTimeOnly = false

  const str = String(value).trim()

  // 1. 匹配纯时间格式：HH:mm:ss 或 HH:mm
  const timeMatch = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(str)
  if (timeMatch) {
    isTimeOnly = true
    hours = parseInt(timeMatch[1], 10) || 0
    minutes = parseInt(timeMatch[2], 10) || 0
    seconds = parseInt(timeMatch[3], 10) || 0
  } else {
    // 2. 匹配标准日期或日期时间
    const isoClean = str.replace(' ', 'T')
    const dtMatch = /^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?(?:T(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/.exec(isoClean)
    if (dtMatch) {
      year = parseInt(dtMatch[1], 10) || 1970
      month = parseInt(dtMatch[2], 10) || 1
      date = parseInt(dtMatch[3], 10) || 1
      hours = parseInt(dtMatch[4], 10) || 0
      minutes = parseInt(dtMatch[5], 10) || 0
      seconds = parseInt(dtMatch[6], 10) || 0
    } else {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) {
        year = d.getFullYear()
        month = d.getMonth() + 1
        date = d.getDate()
        hours = d.getHours()
        minutes = d.getMinutes()
        seconds = d.getSeconds()
      } else {
        return str
      }
    }
  }

  // 纯时间如果要求格式化包含年月，则不强行格式化避免产生 1970 假数据
  if (isTimeOnly && (pattern.includes('Y') || pattern.includes('D'))) {
    return str
  }

  const pad = n => String(n).padStart(2, '0')
  const map = {
    YYYY: String(year),
    YY: String(year).slice(-2),
    MM: pad(month),
    M: String(month),
    DD: pad(date),
    D: String(date),
    HH: pad(hours),
    H: String(hours),
    mm: pad(minutes),
    m: String(minutes),
    ss: pad(seconds),
    s: String(seconds)
  }

  return pattern.replace(/YYYY|YY|MM|M|DD|D|HH|H|mm|m|ss|s/g, match => map[match] ?? match)
}

