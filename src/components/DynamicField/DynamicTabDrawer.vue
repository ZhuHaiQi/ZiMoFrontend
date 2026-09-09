<template>
  <el-drawer v-model="open" title="动态表 Tab 配置" size="92%" append-to-body destroy-on-close>
    <div class="department-tab-config">
      <!-- 左侧：模式选择与部门导航 -->
      <aside class="department-panel">
        <div class="pool-entry-card" :class="{ active: activeMode === 'pool' }" @click="selectTabPool">
          <div class="pool-entry-header">
            <el-icon class="pool-icon"><Collection /></el-icon>
            <div class="pool-entry-title">
              <strong>全部 Tab 库</strong>
              <span>独立维护与管理</span>
            </div>
          </div>
          <el-tag size="small" :type="activeMode === 'pool' ? 'primary' : 'info'" effect="plain">
            {{ draftDefinitions.length }} 个 Tab
          </el-tag>
        </div>

        <div class="panel-divider-line"></div>

        <div class="panel-title">
          <div>
            <strong>按部门分配</strong>
            <span>选择部门配置 Tab 与字段</span>
          </div>
        </div>
        <el-input v-model="departmentKeyword" clearable placeholder="搜索部门" prefix-icon="Search" />
        <el-tree
          ref="departmentTreeRef"
          class="department-tree"
          :data="departmentTree"
          :props="{ label: 'deptName', children: 'children' }"
          node-key="deptId"
          highlight-current
          default-expand-all
          :expand-on-click-node="false"
          :filter-node-method="filterDepartment"
          @node-click="selectDepartment"
        >
          <template #default="{ data }">
            <span class="department-node">
              <span>{{ data.deptName }}</span>
              <el-tag v-if="departmentTabCount(data.deptId)" size="small" type="primary">
                {{ departmentTabCount(data.deptId) }}
              </el-tag>
            </span>
          </template>
        </el-tree>
      </aside>

      <!-- 中间栏：Tab 列表（根据 activeMode 区分） -->
      <section class="tab-panel">
        <!-- 模式 A：全部 Tab 库 -->
        <template v-if="activeMode === 'pool'">
          <div class="panel-title">
            <div><strong>Tab 库列表</strong><span>动态表独立维护的 Tab</span></div>
            <el-button link type="primary" icon="Plus" @click="createPoolTab">新建 Tab</el-button>
          </div>
          <div class="panel-tip">在此独立维护 Tab，各部门可按需引用并分配字段。</div>
          <draggable v-model="draftDefinitions" item-key="_definitionKey" handle=".tab-drag" animation="180">
            <template #item="{ element }">
              <div class="tab-item" :class="{ active: element._definitionKey === selectedPoolKey }" @click="selectPoolTab(element)">
                <el-icon class="tab-drag"><Rank /></el-icon>
                <div class="tab-name">
                  <strong>{{ element.tabName || '未命名 Tab' }}</strong>
                  <code>{{ element.tabCode || '-' }}</code>
                </div>
                <el-tag size="small" :type="referenceCount(element._definitionKey) ? 'success' : 'info'">
                  {{ referenceCount(element._definitionKey) ? `${referenceCount(element._definitionKey)} 部门` : '未引用' }}
                </el-tag>
              </div>
            </template>
          </draggable>
          <el-empty v-if="!draftDefinitions.length" description="还没有定义 Tab，点击上方新建" :image-size="70" />
        </template>

        <!-- 模式 B：部门 Tab 分配 -->
        <template v-else-if="currentDepartment">
          <div class="panel-title">
            <div><strong>{{ currentDepartment.deptName }}</strong><span>部门 Tab</span></div>
            <div class="tab-actions">
              <el-dropdown v-if="availableDefinitions.length" trigger="click" @command="reuseTab">
                <el-button link type="primary" icon="CopyDocument">从 Tab 库添加</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-for="definition in availableDefinitions" :key="definition._definitionKey" :command="definition._definitionKey">
                      {{ definition.tabName }}（{{ definition.tabCode }}）
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button link type="primary" icon="Plus" @click="addTabToDepartment">新建</el-button>
            </div>
          </div>
          <div class="panel-tip">复用同一 Tab 时，本部门可独立勾选展示字段。</div>
          <draggable v-model="currentDepartment.tabs" item-key="_assignmentKey" handle=".tab-drag" animation="180" @end="normalizeTabSort">
            <template #item="{ element }">
              <div class="tab-item" :class="{ active: element._assignmentKey === selectedAssignmentKey }" @click="selectTab(element)">
                <el-icon class="tab-drag"><Rank /></el-icon>
                <div class="tab-name">
                  <strong>{{ definitionOf(element)?.tabName || '未命名 Tab' }}</strong>
                  <code>{{ definitionOf(element)?.tabCode || '-' }}</code>
                </div>
                <div class="tab-item-tags">
                  <el-tag v-if="!element.fieldKeys.length" size="small" type="warning" effect="plain">无字段</el-tag>
                  <el-tag size="small" :type="element.enabled ? 'success' : 'info'">{{ element.enabled ? '启用' : '停用' }}</el-tag>
                </div>
              </div>
            </template>
          </draggable>
          <el-empty v-if="!currentDepartment.tabs.length" description="该部门还没有分配 Tab" :image-size="70">
            <el-button v-if="availableDefinitions.length" type="primary" link @click="addAllTabsToDepartment">
              一键添加所有 Tab
            </el-button>
          </el-empty>
        </template>
      </section>

      <!-- 右侧栏：详情配置 -->
      <!-- 模式 A 详情：Tab 独立定义编辑 -->
      <main v-if="activeMode === 'pool' && selectedPoolDefinition" class="tab-detail">
        <div class="detail-title">
          <div><strong>Tab 独立定义</strong><span>全局共享，修改后所有引用部门同步生效</span></div>
          <el-tag type="info">Tab 库</el-tag>
        </div>
        <div class="two-columns">
          <el-form-item label="Tab 名称" required :error="poolNameError">
            <el-input v-model="selectedPoolDefinition.tabName" maxlength="100" placeholder="例如：常规试验" />
          </el-form-item>
          <el-form-item label="Tab 编码" required :error="poolCodeError">
            <el-input
              v-model="selectedPoolDefinition.tabCode"
              maxlength="64"
              placeholder="例如：tab_cg（同表内唯一）"
            />
          </el-form-item>
        </div>

        <div class="field-section">
          <div class="section-title">
            <strong>引用部门列表</strong>
            <span>当前引用此 Tab 的部门 ({{ referencingDepts(selectedPoolDefinition._definitionKey).length }})</span>
          </div>
          <div v-if="referencingDepts(selectedPoolDefinition._definitionKey).length" class="referencing-tags">
            <el-tag
              v-for="dept in referencingDepts(selectedPoolDefinition._definitionKey)"
              :key="dept.deptId"
              class="dept-ref-tag"
              @click="jumpToDepartment(dept.deptId, selectedPoolDefinition._definitionKey)"
            >
              {{ dept.deptName }}
            </el-tag>
          </div>
          <div v-else class="text-secondary">暂无部门引用该 Tab，可在左侧选择部门并添加。</div>
        </div>

        <el-button link type="danger" icon="Delete" class="delete-btn" @click="removePoolDefinition(selectedPoolDefinition)">
          删除该 Tab（从所有部门移除）
        </el-button>
      </main>

      <!-- 模式 B 详情：部门 Tab 与字段配置 -->
      <main v-else-if="activeMode === 'dept' && currentTab && currentDefinition" class="tab-detail">
        <div class="detail-title">
          <div><strong>Tab 部门配置</strong><span>名称、编码由所有引用部门共享</span></div>
          <el-tag>{{ currentDepartment.deptName }}</el-tag>
        </div>
        <div class="two-columns">
          <el-form-item label="Tab 名称" required :error="currentNameError">
            <el-input v-model="currentDefinition.tabName" maxlength="100" />
          </el-form-item>
          <el-form-item label="Tab 编码" required :error="currentCodeError">
            <el-input
              v-model="currentDefinition.tabCode"
              maxlength="64"
              placeholder="例如：basic_info（同表唯一）"
            />
          </el-form-item>
        </div>
        <div class="dept-status-sort-row">
          <el-form-item label="本部门状态" class="status-item">
            <el-switch v-model="currentTab.enabled" inline-prompt active-text="启用" inactive-text="停用" />
          </el-form-item>
          <el-form-item label="默认排序" class="sort-field-item" label-width="70px">
            <el-select
              v-model="currentTab.defaultSortField"
              clearable
              :placeholder="currentTabSortableFields.length ? '默认按记录ID倒序' : '当前未勾选可排序字段'"
              :disabled="!currentTabSortableFields.length"
              style="width: 100%"
            >
              <el-option
                v-for="field in currentTabSortableFields"
                :key="field.fieldKey"
                :label="field.fieldLabel"
                :value="field.fieldKey"
              >
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <span>{{ field.fieldLabel }}</span>
                  <code style="margin-left: 8px;">{{ field.fieldKey }}</code>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="排序方向" class="sort-order-item" label-width="70px">
            <el-select
              v-model="currentTab.defaultSortOrder"
              :disabled="!currentTab.defaultSortField"
              style="width: 100%"
            >
              <el-option label="降序" value="desc" />
              <el-option label="升序" value="asc" />
            </el-select>
          </el-form-item>
        </div>

        <section class="field-section">
          <div class="section-title">
            <strong>本部门展示字段</strong>
            <span>仅影响 {{ currentDepartment.deptName }} 下的这个 Tab（已选 {{ currentTab.fieldKeys.length }} 个字段）</span>
          </div>
          <div v-if="!currentTab.fieldKeys.length" class="empty-field-hint">
            <el-icon><InfoFilled /></el-icon>
            <span>提示：当前未勾选字段，保存后该部门在该 Tab 下将展示空内容。</span>
          </div>
          <el-checkbox-group v-model="currentTab.fieldKeys" class="field-options">
            <el-checkbox v-for="field in configurableFields" :key="field.fieldKey" :value="field.fieldKey" border>
              {{ field.fieldLabel }}{{ field.status === '1' ? '（已停用）' : '' }} <code>{{ field.fieldKey }}</code>
            </el-checkbox>
          </el-checkbox-group>
          <el-empty v-if="!configurableFields.length" description="请先保存字段配置" :image-size="60" />
        </section>

        <el-button link type="danger" icon="Delete" @click="removeCurrent">
          从“{{ currentDepartment.deptName }}”移除该 Tab
        </el-button>
      </main>

      <div v-else class="empty-detail">
        <el-empty :description="activeMode === 'pool' ? '选择或新建一个 Tab 进行定义' : '选择部门并新建或复用一个 Tab'" />
      </div>
    </div>

    <template #footer>
      <el-button :disabled="saving" @click="open = false">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="saving" @click="submit">保存配置</el-button>
    </template>
  </el-drawer>
</template>

<script setup name="DynamicTabDrawer">
import draggable from 'vuedraggable'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  tabs: { type: Array, default: () => [] },
  departmentTabs: { type: Array, default: () => [] },
  fields: { type: Array, default: () => [] },
  departments: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false }
})
const emit = defineEmits(['save'])
const { proxy } = getCurrentInstance()
const departmentTreeRef = ref()
const departmentKeyword = ref('')
const draftDefinitions = ref([])
const draftDepartments = ref([])
const activeMode = ref('pool') // 'pool' | 'dept'
const selectedPoolKey = ref('')
const selectedDeptId = ref()
const selectedAssignmentKey = ref('')
let localSequence = 0

const selectedPoolDefinition = computed(() =>
  draftDefinitions.value.find(item => item._definitionKey === selectedPoolKey.value) || null)

// 保留已选的停用字段供用户查看、移除，运行时仍由服务端过滤。
const configurableFields = computed(() => props.fields.filter(field =>
  field.status !== '1' || currentTab.value?.fieldKeys.includes(field.fieldKey)))
const departmentTree = computed(() => buildTree(draftDepartments.value))
const currentDepartment = computed(() => draftDepartments.value.find(item => item.deptId === selectedDeptId.value) || null)
const currentTab = computed(() => currentDepartment.value?.tabs.find(item => item._assignmentKey === selectedAssignmentKey.value) || null)
const currentDefinition = computed(() => definitionOf(currentTab.value))
const availableDefinitions = computed(() => {
  const used = new Set((currentDepartment.value?.tabs || []).map(tab => tab._definitionKey))
  return draftDefinitions.value.filter(definition => !used.has(definition._definitionKey))
})

// 当前选中 Tab 下已勾选且支持排序的可用字段列表
const currentTabSortableFields = computed(() => {
  if (!currentTab.value) return []
  const selectedKeys = new Set(currentTab.value.fieldKeys || [])
  return props.fields.filter(field => field.status !== '1' && Boolean(field.sortable) && selectedKeys.has(field.fieldKey))
})

// 取消勾选字段时联动重置该 Tab 默认排序
watch(() => currentTab.value?.fieldKeys, newKeys => {
  if (!currentTab.value || !currentTab.value.defaultSortField) return
  if (!newKeys || !newKeys.includes(currentTab.value.defaultSortField)) {
    currentTab.value.defaultSortField = ''
  }
}, { deep: true })

// Tab 编码唯一性实时校验
const poolNameError = computed(() => {
  if (!selectedPoolDefinition.value) return ''
  return selectedPoolDefinition.value.tabName?.trim() ? '' : 'Tab 名称不能为空'
})

const poolCodeError = computed(() => {
  if (!selectedPoolDefinition.value) return ''
  return validateCode(selectedPoolDefinition.value.tabCode, selectedPoolDefinition.value._definitionKey)
})

const currentNameError = computed(() => {
  if (!currentDefinition.value) return ''
  return currentDefinition.value.tabName?.trim() ? '' : 'Tab 名称不能为空'
})

const currentCodeError = computed(() => {
  if (!currentDefinition.value) return ''
  return validateCode(currentDefinition.value.tabCode, currentDefinition.value._definitionKey)
})

function validateCode(code, definitionKey) {
  if (!code || !code.trim()) return 'Tab 编码不能为空'
  const normalized = code.trim().toLowerCase()
  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
    return '请以小写字母开头，由小写字母、数字或下划线组成'
  }
  const duplicate = draftDefinitions.value.some(
    item => item._definitionKey !== definitionKey && item.tabCode?.trim().toLowerCase() === normalized
  )
  if (duplicate) return `Tab 编码“${normalized}”已存在，不能重复`
  return ''
}

watch(open, visible => {
  if (!visible) return
  initializeDraft()
}, { immediate: true })

watch(departmentKeyword, value => departmentTreeRef.value?.filter(value))

function initializeDraft() {
  departmentKeyword.value = ''
  selectedAssignmentKey.value = ''
  activeMode.value = 'pool'
  const definitions = new Map()

  const registerDefinition = tab => {
    const id = tab.id ?? tab.tabId
    const code = (tab.tabCode || `tab_${++localSequence}`).trim().toLowerCase()
    const key = id ? `id:${id}` : `code:${code}`
    if (!definitions.has(key)) {
      definitions.set(key, {
        _definitionKey: key,
        id,
        tabName: tab.tabName || '',
        tabCode: code
      })
    }
    return key
  }

  props.tabs.forEach(registerDefinition)
  props.departmentTabs.forEach(group => (group.tabs || []).forEach(registerDefinition))
  draftDefinitions.value = [...definitions.values()]
  selectedPoolKey.value = draftDefinitions.value[0]?._definitionKey || ''

  const configurations = new Map((props.departmentTabs || []).map(group => [group.deptId, group]))
  if (!props.departmentTabs.length) {
    props.tabs.forEach(tab => (tab.deptIds || []).forEach(deptId => {
      if (!configurations.has(deptId)) configurations.set(deptId, { deptId, tabs: [] })
      configurations.get(deptId).tabs.push(tab)
    }))
  }

  const configuredDepartments = new Set()
  draftDepartments.value = props.departments.map(department => {
    const group = configurations.get(department.deptId)
    configuredDepartments.add(department.deptId)
    return {
      deptId: department.deptId,
      deptName: department.deptName,
      parentId: department.parentId,
      tabs: (group?.tabs || []).map((tab, index) => {
        const definitionKey = registerDefinition(tab)
        return {
          _assignmentKey: `${department.deptId}:${definitionKey}:${index}`,
          _definitionKey: definitionKey,
          enabled: tab.status !== '1',
          fieldKeys: [...(tab.fieldKeys || [])],
          defaultSortField: tab.defaultSortField || '',
          defaultSortOrder: tab.defaultSortOrder || 'desc',
          sort: index + 1
        }
      })
    }
  })

  configurations.forEach((group, deptId) => {
    if (configuredDepartments.has(deptId)) return
    draftDepartments.value.push({
      deptId,
      deptName: `部门 ${deptId}（已停用）`,
      parentId: null,
      tabs: (group.tabs || []).map((tab, index) => ({
        _assignmentKey: `${deptId}:${registerDefinition(tab)}:${index}`,
        _definitionKey: registerDefinition(tab),
        enabled: tab.status !== '1',
        fieldKeys: [...(tab.fieldKeys || [])],
        defaultSortField: tab.defaultSortField || '',
        defaultSortOrder: tab.defaultSortOrder || 'desc',
        sort: index + 1
      }))
    })
  })

  const initialDept = draftDepartments.value.find(item => item.tabs.length) || draftDepartments.value[0]
  selectedDeptId.value = initialDept?.deptId
  nextTick(() => departmentTreeRef.value?.setCurrentKey(selectedDeptId.value))
}

function buildTree(items) {
  const nodes = new Map(items.map(item => [item.deptId, { ...item, children: [] }]))
  const roots = []
  nodes.forEach(node => {
    const parent = nodes.get(node.parentId)
    if (parent) parent.children.push(node)
    else roots.push(node)
  })
  return roots
}

function filterDepartment(keyword, data) {
  return !keyword || data.deptName?.toLowerCase().includes(keyword.trim().toLowerCase())
}

function departmentTabCount(deptId) {
  return draftDepartments.value.find(item => item.deptId === deptId)?.tabs.length || 0
}

function definitionOf(tab) {
  return tab ? draftDefinitions.value.find(item => item._definitionKey === tab._definitionKey) : null
}

function referenceCount(definitionKey) {
  return draftDepartments.value.filter(d => d.tabs.some(t => t._definitionKey === definitionKey)).length
}

function referencingDepts(definitionKey) {
  return draftDepartments.value.filter(d => d.tabs.some(t => t._definitionKey === definitionKey))
}

function selectTabPool() {
  activeMode.value = 'pool'
  departmentTreeRef.value?.setCurrentKey(null)
  if (!selectedPoolKey.value && draftDefinitions.value.length) {
    selectedPoolKey.value = draftDefinitions.value[0]._definitionKey
  }
}

function selectDepartment(department) {
  activeMode.value = 'dept'
  selectedDeptId.value = department.deptId
  selectedAssignmentKey.value = currentDepartment.value?.tabs[0]?._assignmentKey || ''
}

function selectPoolTab(definition) {
  selectedPoolKey.value = definition._definitionKey
}

function selectTab(tab) {
  selectedAssignmentKey.value = tab._assignmentKey
}

function createPoolTab() {
  let number = draftDefinitions.value.length + 1
  let code = `tab_${number}`
  const codes = new Set(draftDefinitions.value.map(item => item.tabCode?.toLowerCase()))
  while (codes.has(code)) code = `tab_${++number}`
  const definitionKey = `new:${Date.now()}:${++localSequence}`
  const newDef = {
    _definitionKey: definitionKey,
    id: undefined,
    tabName: `Tab ${number}`,
    tabCode: code
  }
  draftDefinitions.value.push(newDef)
  selectedPoolKey.value = definitionKey
}

async function removePoolDefinition(definition) {
  const refDepts = referencingDepts(definition._definitionKey)
  const warnText = refDepts.length
    ? `该 Tab 正在被 ${refDepts.length} 个部门引用，删除将同时从这些部门移除该 Tab。确定删除“${definition.tabName}”吗？`
    : `确定删除 Tab“${definition.tabName}”吗？`
  try {
    await proxy.$modal.confirm(warnText)
  } catch { return }

  // 从所有部门中移除该 Tab
  draftDepartments.value.forEach(department => {
    department.tabs = department.tabs.filter(t => t._definitionKey !== definition._definitionKey)
  })
  // 从全局池中移除
  const index = draftDefinitions.value.findIndex(item => item._definitionKey === definition._definitionKey)
  if (index >= 0) {
    draftDefinitions.value.splice(index, 1)
  }
  selectedPoolKey.value = draftDefinitions.value[Math.min(index, draftDefinitions.value.length - 1)]?._definitionKey || ''
}

function addTabToDepartment() {
  if (!currentDepartment.value) return
  let number = draftDefinitions.value.length + 1
  let code = `tab_${number}`
  const codes = new Set(draftDefinitions.value.map(item => item.tabCode?.toLowerCase()))
  while (codes.has(code)) code = `tab_${++number}`
  const definitionKey = `new:${Date.now()}:${++localSequence}`
  draftDefinitions.value.push({ _definitionKey: definitionKey, id: undefined, tabName: `Tab ${number}`, tabCode: code })
  addAssignment(definitionKey)
}

function reuseTab(definitionKey) {
  addAssignment(definitionKey)
}

function addAllTabsToDepartment() {
  if (!currentDepartment.value) return
  availableDefinitions.value.forEach(def => {
    addAssignment(def._definitionKey)
  })
}

function addAssignment(definitionKey) {
  if (!currentDepartment.value || currentDepartment.value.tabs.some(tab => tab._definitionKey === definitionKey)) return
  const assignment = {
    _assignmentKey: `${currentDepartment.value.deptId}:${definitionKey}:${Date.now()}:${++localSequence}`,
    _definitionKey: definitionKey,
    enabled: true,
    fieldKeys: [],
    defaultSortField: '',
    defaultSortOrder: 'desc',
    sort: currentDepartment.value.tabs.length + 1
  }
  currentDepartment.value.tabs.push(assignment)
  selectedAssignmentKey.value = assignment._assignmentKey
}

function normalizeTabSort() {
  currentDepartment.value?.tabs.forEach((tab, index) => { tab.sort = index + 1 })
}

function jumpToDepartment(deptId, definitionKey) {
  activeMode.value = 'dept'
  selectedDeptId.value = deptId
  nextTick(() => {
    departmentTreeRef.value?.setCurrentKey(deptId)
    const matchTab = currentDepartment.value?.tabs.find(t => t._definitionKey === definitionKey)
    if (matchTab) {
      selectedAssignmentKey.value = matchTab._assignmentKey
    }
  })
}

async function removeCurrent() {
  if (!currentTab.value || !currentDefinition.value) return
  try {
    await proxy.$modal.confirm(`确定从“${currentDepartment.value.deptName}”移除 Tab“${currentDefinition.value.tabName}”吗？`)
  } catch { return }
  const index = currentDepartment.value.tabs.indexOf(currentTab.value)
  currentDepartment.value.tabs.splice(index, 1)
  normalizeTabSort()
  selectedAssignmentKey.value = currentDepartment.value.tabs[Math.min(index, currentDepartment.value.tabs.length - 1)]?._assignmentKey || ''
}

function submit() {
  const codePattern = /^[a-z][a-z0-9_]*$/
  const codes = new Set()

  // 1. 严格校验所有 Tab 定义
  for (const definition of draftDefinitions.value) {
    const name = definition.tabName?.trim()
    const code = definition.tabCode?.trim().toLowerCase()
    if (!name) return proxy.$modal.msgError('存在 Tab 名称为空，请检查后保存')
    if (!code || !codePattern.test(code)) return proxy.$modal.msgError(`Tab“${name}”编码格式不正确，需以小写字母开头`)
    if (codes.has(code)) return proxy.$modal.msgError(`Tab 编码“${code}”重复，同表内编码必须唯一`)
    definition.tabName = name
    definition.tabCode = code
    codes.add(code)
  }

  // 2. 构造独立的 Tab 库定义列表
  const tabs = draftDefinitions.value.map((def, index) => ({
    id: def.id,
    tabName: def.tabName,
    tabCode: def.tabCode,
    sort: index + 1,
    status: '0'
  }))

  // 3. 构造部门分配与字段列表（彻底放宽未选字段限制，不再阻断报错）
  const departmentTabs = []
  for (const department of draftDepartments.value) {
    if (!department.tabs.length) continue
    const deptTabs = []
    for (const [index, assignment] of department.tabs.entries()) {
      const definition = definitionOf(assignment)
      if (!definition) continue
      deptTabs.push({
        id: definition.id,
        tabName: definition.tabName,
        tabCode: definition.tabCode,
        sort: index + 1,
        status: assignment.enabled ? '0' : '1',
        fieldKeys: [...assignment.fieldKeys],
        defaultSortField: assignment.defaultSortField || null,
        defaultSortOrder: assignment.defaultSortOrder || 'desc'
      })
    }
    departmentTabs.push({ deptId: department.deptId, tabs: deptTabs })
  }

  emit('save', { tabs, departmentTabs })
}
</script>

<style scoped>
.department-tab-config {
  display: grid;
  grid-template-columns: 260px 280px minmax(420px, 1fr);
  min-height: 660px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
}
.department-panel, .tab-panel {
  min-width: 0;
  padding: 14px;
  background: var(--el-fill-color-extra-light);
  border-right: 1px solid var(--el-border-color-lighter);
  overflow: auto;
}
.tab-panel { background: var(--el-bg-color); }
.pool-entry-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 12px;
}
.pool-entry-card:hover {
  border-color: var(--el-color-primary-light-3);
  background: var(--el-color-primary-light-9);
}
.pool-entry-card.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  box-shadow: 0 0 0 1px var(--el-color-primary);
}
.pool-entry-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pool-icon {
  font-size: 20px;
  color: var(--el-color-primary);
}
.pool-entry-title {
  display: flex;
  flex-direction: column;
}
.pool-entry-title strong {
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.pool-entry-title span {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.panel-divider-line {
  height: 1px;
  background: var(--el-border-color-lighter);
  margin: 14px 0 12px;
}
.panel-title, .detail-title, .section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.panel-title > div:first-child, .detail-title > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.panel-title span, .detail-title span, .section-title span, .panel-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.department-tree {
  margin-top: 12px;
  background: transparent;
}
.department-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-right: 8px;
}
.tab-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.panel-tip {
  margin: -5px 0 10px;
}
.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 8px;
  margin-bottom: 6px;
  border: 1px solid transparent;
  border-radius: 7px;
  cursor: pointer;
}
.tab-item:hover {
  background: var(--el-fill-color-light);
}
.tab-item.active {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
}
.tab-item-tags {
  display: flex;
  align-items: center;
  gap: 4px;
}
.tab-name {
  min-width: 0;
  flex: 1;
}
.tab-name strong, .tab-name code {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tab-drag {
  flex: none;
  color: var(--el-text-color-placeholder);
  cursor: grab;
}
.tab-detail {
  min-width: 0;
  padding: 20px;
  overflow: auto;
}
.two-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.field-section {
  padding-top: 18px;
  margin: 8px 0 18px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.empty-field-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.field-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.field-options .el-checkbox {
  width: 100%;
  margin: 0;
}
.referencing-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.dept-ref-tag {
  cursor: pointer;
  transition: opacity 0.2s;
}
.dept-ref-tag:hover {
  opacity: 0.8;
}
.text-secondary {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  padding: 8px 0;
}
.delete-btn {
  margin-top: 14px;
}
code {
  color: var(--el-text-color-placeholder);
  font-family: Consolas, monospace;
  font-size: 11px;
}
.empty-detail {
  display: grid;
  place-items: center;
}
.dept-status-sort-row {
  display: grid;
  grid-template-columns: 140px 1.2fr 1fr;
  gap: 14px;
  align-items: center;
  margin-bottom: 18px;
}
.dept-status-sort-row .status-item,
.dept-status-sort-row .sort-field-item,
.dept-status-sort-row .sort-order-item {
  margin-bottom: 0;
  width: 100%;
}
.dept-status-sort-row :deep(.el-form-item__content) {
  min-width: 0;
}
</style>
