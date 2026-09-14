<template>
  <el-drawer
    v-model="open"
    :title="title"
    :size="size"
    class="dynamic-data-drawer"
    append-to-body
    destroy-on-close
  >
    <dynamic-data-manager
      v-if="open && runtimeSchema?.tabs?.length"
      :key="`${runtimeSchema.tableCode || runtimeSchema.id || runtimeSchema.tableId}:${runtimeSchema.runtimeDeptId}`"
      :schema="runtimeSchema"
      :dept-id="targetDeptId"
      :dict-options="dictOptions"
      @ready="loading = false"
    />
    <el-empty
      v-else-if="open && !schemaLoading"
      description="当前部门未配置可见 Tab"
    />
  </el-drawer>
</template>

<script setup name="DynamicDataDrawer">
import DynamicDataManager from './DynamicDataManager.vue'
import { getDynamicRuntimeSchemaByCode, getDynamicRuntimeSchemaById } from '@/api/system/dynamicTable'

const open = defineModel({ type: Boolean, default: false })
const loading = defineModel('loading', { type: Boolean, default: false })
const props = defineProps({
  schema: { type: Object, default: null },
  tableCode: { type: String, default: '' },
  tableId: { type: [Number, String], default: null },
  deptId: { type: [Number, String], default: null },
  dictOptions: { type: Object, default: () => ({}) },
  title: { type: String, default: '动态数据管理' },
  size: { type: [String, Number], default: '88%' }
})
const runtimeSchema = ref(null)
const schemaLoading = ref(false)
let loadSequence = 0

const targetCode = computed(() => props.tableCode || props.schema?.tableCode || '')
const targetId = computed(() => props.tableId || props.schema?.id || props.schema?.tableId || null)
const targetDeptId = computed(() => props.deptId ?? props.schema?.deptId ?? null)

// 每次打开都从服务端读取指定或当前部门可见的 Tab 和字段，优先支持按 tableCode 和指定 deptId 获取。
watch([open, targetCode, targetId, targetDeptId], async ([visible, code, id, deptId]) => {
  const sequence = ++loadSequence
  runtimeSchema.value = null
  const identifier = code || id
  loading.value = visible && !!identifier
  if (!visible || !identifier) return
  schemaLoading.value = true
  try {
    const response = code
      ? await getDynamicRuntimeSchemaByCode(code, deptId)
      : await getDynamicRuntimeSchemaById(id, deptId)
    if (sequence === loadSequence) runtimeSchema.value = response.data
  } finally {
    if (sequence === loadSequence) {
      schemaLoading.value = false
      if (!runtimeSchema.value?.tabs?.length) loading.value = false
    }
  }
}, { immediate: true, flush: 'sync' })
</script>

<style>
.dynamic-data-drawer.el-drawer {
  overflow: hidden;
}
.dynamic-data-drawer .el-drawer__body {
  padding: 16px 20px;
  height: calc(100% - 55px);
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
