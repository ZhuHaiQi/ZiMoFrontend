import assert from 'node:assert/strict'
import test from 'node:test'
import { createModuleLoader } from './helpers/load-module.js'

async function createHarness({ menuFails = false, logoutFails = false, infoFails = false } = {}) {
  let token = 'session-token'
  let beforeEach
  let progressDone = 0
  const addedRoutes = []
  const messages = []
  const menuReloginStates = []
  const nextCalls = []
  const isRelogin = { show: false }
  const failure = new Error('菜单加载失败')
  const router = {
    addRoute: route => addedRoutes.push(route),
    beforeEach: handler => { beforeEach = handler },
    afterEach() {}
  }
  const mocks = {
    '@/plugins/auth': { default: { hasPermiOr: () => true, hasRoleOr: () => true } },
    '@/router': { default: router, constantRoutes: [], dynamicRoutes: [] },
    './router': { default: router },
    '@/api/menu': { getRouters: async () => {
      menuReloginStates.push(isRelogin.show)
      if (menuFails) throw failure
      return { data: [{ path: '/system', component: 'Layout', children: [{ path: 'data', component: 'ParentView' }] }] }
    } },
    '@/layout/index': { default: {} },
    '@/components/ParentView': { default: {} },
    '@/layout/components/InnerLink': { default: {} },
    '@/api/login': {
      login: async () => ({}),
      logout: async () => { if (logoutFails) throw new Error('退出接口不可用') },
      getInfo: async () => {
        if (infoFails) throw new Error('用户信息加载失败')
        return { user: { userId: 1, userName: 'tester' }, roles: ['admin'], permissions: ['*:*:*'] }
      }
    },
    '@/utils/auth': {
      getToken: () => token,
      setToken: value => { token = value },
      removeToken: () => { token = '' }
    },
    '@/utils/validate': {
      isHttp: value => /^https?:/.test(value),
      isEmpty: value => !value,
      isPathMatch: (pattern, path) => pattern === path
    },
    '@/store/modules/lock': { default: () => ({ isLock: false }) },
    '@/store/modules/settings': { default: () => ({ setTitle() {} }) },
    '@/assets/images/profile.jpeg': { default: 'avatar' },
    'element-plus': { ElMessageBox: {}, ElMessage: { error: message => messages.push(message) } },
    'nprogress': { default: { configure() {}, start() {}, done() { progressDone++ } } },
    'nprogress/nprogress.css': {},
    '@/utils/request': { isRelogin }
  }
  const load = createModuleLoader(mocks)
  const permissionModule = await load('src/store/modules/permission.js')
  const userModule = await load('src/store/modules/user.js')
  mocks['@/store/modules/permission'] = { default: permissionModule.default }
  mocks['@/store/modules/user'] = { default: userModule.default }
  await load('src/permission.js')
  return {
    permission: permissionModule.default(), user: userModule.default(), failure,
    addedRoutes, messages, nextCalls, isRelogin, menuReloginStates,
    token: () => token,
    progressDone: () => progressDone,
    navigate: () => beforeEach({ path: '/system/data', fullPath: '/system/data?page=2', meta: {} }, {}, next => nextCalls.push(next))
  }
}

test('菜单请求失败向调用方拒绝 Promise', { timeout: 2000 }, async () => {
  const app = await createHarness({ menuFails: true })
  await assert.rejects(app.permission.generateRoutes(), error => error === app.failure)
})

test('菜单加载成功后注册路由并继续原导航', { timeout: 2000 }, async () => {
  const app = await createHarness()
  await app.navigate()
  assert.equal(app.addedRoutes[0].path, '/system')
  assert.equal(app.permission.sidebarRouters[0].path, '/system')
  assert.equal(app.nextCalls.length, 1)
  assert.equal(app.nextCalls[0].fullPath, '/system/data?page=2')
  assert.equal(app.nextCalls[0].replace, true)
  assert.equal(app.isRelogin.show, false)
  assert.equal(app.menuReloginStates[0], true)
  assert.equal(app.messages.length, 0)
  assert.equal(app.token(), 'session-token')
})

for (const options of [
  { menuFails: true },
  { menuFails: true, logoutFails: true },
  { infoFails: true, logoutFails: true }
]) {
  test(`权限初始化失败结束导航并清理会话：${JSON.stringify(options)}`, { timeout: 2000 }, async () => {
    const app = await createHarness(options)
    await app.navigate()
    assert.equal(app.nextCalls.length, 1)
    assert.equal(app.nextCalls[0].path, '/login')
    assert.equal(app.nextCalls[0].query.redirect, '/system/data?page=2')
    assert.equal(app.token(), '')
    assert.equal(app.user.token, '')
    assert.equal(app.user.roles.length, 0)
    assert.equal(app.user.permissions.length, 0)
    assert.equal(app.isRelogin.show, false)
    if (options.menuFails) assert.equal(app.menuReloginStates[0], true)
    assert.equal(app.progressDone(), 1)
    assert.equal(app.messages[0], options.infoFails ? '用户信息加载失败' : '菜单加载失败')
    assert.equal(app.addedRoutes.length, 0)
  })
}
