import { computed, shallowRef, watch } from 'vue'
import { fetchApiOptions } from '@/utils/dynamicSource'
import { parseJson } from '@/utils/dynamicField'

/** 只监听接口配置；失效的异步结果不能覆盖新字段的选项。 */
export function useFieldOptions(fields, dictOptions) {
  const apiOptionMap = shallowRef({})
  const apiConfigs = computed(() => JSON.stringify(fields()
    .filter(field => field.optionSource === 'API')
    .map(field => [field.fieldKey, parseJson(field.componentPropsJson, {}).apiConfig])))

  watch(apiConfigs, async (configs, previous, onCleanup) => {
    let active = true
    onCleanup(() => { active = false })
    apiOptionMap.value = {}
    const entries = await Promise.all(JSON.parse(configs).map(async ([key, config]) =>
      [key, await fetchApiOptions(config)]))
    if (active) apiOptionMap.value = Object.fromEntries(entries)
  }, { immediate: true })

  const optionMap = computed(() => Object.fromEntries(fields().map(field => {
    let options
    if (field.optionSource === 'DICT' && field.dictType) {
      options = (dictOptions()[field.dictType] || []).map(option => ({
        ...option,
        label: option.label ?? option.dictLabel,
        value: option.value ?? option.dictValue
      }))
    } else if (field.optionSource === 'API') {
      options = apiOptionMap.value[field.fieldKey] || []
    } else {
      options = parseJson(field.optionsJson, [])
    }
    return [field.fieldKey, options]
  })))

  return { optionsOf: field => optionMap.value[field.fieldKey] || [] }
}
