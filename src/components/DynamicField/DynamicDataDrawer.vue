<template>
  <el-drawer v-model="open" :title="title" :size="size" append-to-body destroy-on-close>
    <dynamic-data-manager
      v-if="open && schema"
      :key="schema.tableId"
      :schema="schema"
      :dict-options="dictOptions"
      @ready="loading = false"
    />
  </el-drawer>
</template>

<script setup name="DynamicDataDrawer">
import DynamicDataManager from './DynamicDataManager.vue'

const open = defineModel({ type: Boolean, default: false })
const loading = defineModel('loading', { type: Boolean, default: false })
const props = defineProps({
  schema: { type: Object, default: null },
  dictOptions: { type: Object, default: () => ({}) },
  title: { type: String, default: '动态数据管理' },
  size: { type: [String, Number], default: '88%' }
})

// 每次打开或切换业务表都重新加载；关闭时立即解除入口按钮的加载状态。
watch([open, () => props.schema?.tableId], ([visible]) => {
  loading.value = visible && !!props.schema
}, { immediate: true, flush: 'sync' })
</script>
