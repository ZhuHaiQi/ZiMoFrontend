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
      :key="`${runtimeSchema.id || runtimeSchema.tableId}:${runtimeSchema.runtimeDeptId}`"
      :schema="runtimeSchema"
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
import { getDynamicRuntimeSchema } from '@/api/system/dynamicTable'

const open = defineModel({ type: Boolean, default: false })
const loading = defineModel('loading', { type: Boolean, default: false })
const props = defineProps({
  schema: { type: Object, default: null },
  dictOptions: { type: Object, default: () => ({}) },
  title: { type: String, default: '动态数据管理' },
  size: { type: [String, Number], default: '88%' }
})
const runtimeSchema = ref(null)
const schemaLoading = ref(false)
let loadSequence = 0

// 每次打开都从服务端读取当前部门可见的 Tab 和字段，避免使用设计器中的完整 Schema。
watch([open, () => props.schema?.id ?? props.schema?.tableId], async ([visible, schemaId]) => {
  const sequence = ++loadSequence
  runtimeSchema.value = null
  loading.value = visible && !!schemaId
  if (!visible || !schemaId) return
  schemaLoading.value = true
  try {
    const response = await getDynamicRuntimeSchema(schemaId)
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
