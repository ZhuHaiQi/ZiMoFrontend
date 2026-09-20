<template>
  <div class="query-settings">
    <el-form-item label="查询数据">
      <el-radio-group v-model="definition.queryMode">
        <el-radio-button value="NORMAL">正常数据</el-radio-button>
        <el-radio-button value="DELETED">已删除数据（只读）</el-radio-button>
      </el-radio-group>
    </el-form-item>
    <template v-if="definition.queryMode === 'DELETED'">
      <el-form-item v-if="assignment" label="来源 Tab" required>
        <el-select v-model="assignment.sourceTabIds" multiple filterable placeholder="选择本部门来源 Tab（可多选）" clearable style="width: 100%">
          <el-option v-for="tab in sources" :key="tab.id" :label="`${tab.tabName}（${tab.tabCode}）`" :value="tab.id" />
        </el-select>
      </el-form-item>
      <p class="query-tip">{{ assignment ? '可多选本部门已配置的普通 Tab，停用的来源需先启用。展示字段可从所选来源中选择，每条记录仅展示其来源已授权的字段。新建来源请先保存。' : '来源 Tab 按部门独立配置：请在左侧选择部门，再选择一个或多个本部门来源 Tab。' }}</p>
    </template>
  </div>
</template>

<script setup>
const props = defineProps({
  definition: { type: Object, required: true },
  definitions: { type: Array, default: () => [] },
  assignment: { type: Object, default: null },
  departmentTabs: { type: Array, default: () => [] }
})
const sources = computed(() => {
  const assigned = new Set(props.departmentTabs.map(tab => tab._definitionKey))
  return props.definitions.filter(tab => assigned.has(tab._definitionKey)
    && tab.id != null && tab.id !== props.definition.id && tab.queryMode !== 'DELETED')
})
</script>

<style scoped>
.query-tip { margin: -6px 0 18px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.6; }
</style>
