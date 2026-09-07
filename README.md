# ZiMoFrontend

ZiMo 管理系统前端，基于 RuoYi-Vue3 3.9.2，使用 Vue 3、Element Plus 和 Vite。项目在若依的系统管理、权限控制和监控功能上，扩展了动态字段设计器及通用数据管理组件。

## 技术栈

| 类别 | 当前使用 |
| --- | --- |
| 页面与构建 | Vue 3.5、JavaScript、Vite 6 |
| UI 与表格 | Element Plus 2、VXE Table 4 |
| 路由与状态 | Vue Router 4、Pinia 3 |
| 网络与图表 | Axios、ECharts 5 |
| 字段排序与富文本 | vuedraggable、Vue Quill |
| 样式 | Sass |

具体依赖版本见 `package.json`。Vue、Vue Router 和 Pinia 的常用 API 通过 `vite/plugins/auto-import.js` 自动导入。

配套项目为 `ZiMoBackend`，使用 Java 21、Spring Boot 3、MyBatis、PostgreSQL 和 Redis。

## 本地运行

本次构建和回归测试使用 Node.js 24.14.1、npm 11.19.1。

在项目根目录执行：

```bash
npm install
npm run dev
```

开发服务默认使用 80 端口并自动打开浏览器，访问地址为 `http://localhost`。需要其他端口时：

```bash
npm run dev -- --port 5173
```

完整登录和业务操作需要先启动配套后端，以及后端依赖的 PostgreSQL、Redis。开发代理目标在 `vite.config.js` 的 `baseUrl` 中配置，当前为 `http://localhost:8080`：

- `/dev-api/**` 转发至后端，并去掉 `/dev-api` 前缀。
- `/v3/api-docs/**` 转发至后端接口文档服务。

更换后端地址后，重新启动 Vite。登录账号以所连接后端的数据为准。

当前 `.gitignore` 忽略了 `package-lock.json` 和 `yarn.lock`，首次安装使用 `npm install`；本地有匹配的 npm 锁文件时可使用 `npm ci`。

## 环境配置

| 文件 | 用途 | API 前缀 |
| --- | --- | --- |
| `.env.development` | 本地开发 | `/dev-api` |
| `.env.staging` | 测试环境构建 | `/stage-api` |
| `.env.production` | 生产环境构建 | `/prod-api` |

主要变量：

- `VITE_APP_TITLE`：页面标题，当前默认“若依管理系统”。
- `VITE_APP_ENV`：环境标识。
- `VITE_APP_BASE_API`：Axios 请求和文件访问使用的 API 前缀。
- `VITE_BUILD_COMPRESS`：构建压缩配置，测试和生产环境当前启用 gzip。

个人环境覆盖可放在对应的 `.env.<mode>.local` 文件中，`*.local` 已被 Git 忽略。Vite 环境变量在启动或构建时读取，修改后需要重新启动或构建；`VITE_` 变量会进入前端产物，不要放入服务端密钥。

## 常用命令与部署

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务 |
| `npm test` | 执行动态选项缓存和权限初始化回归测试 |
| `npm run build:stage` | 按测试环境配置构建 |
| `npm run build:prod` | 按生产环境配置构建 |
| `npm run preview` | 本地预览已构建的产物 |

构建输出至 `dist/`。测试使用 Node.js 内置测试工具和 VM 模块，执行时会出现 VM 实验特性提示，无需额外安装测试框架。测试替换网络和浏览器依赖，不连接真实后端。目前没有配置 ESLint 检查脚本。

部署时需要由 Web 服务提供静态资源、将对应环境的 API 前缀转发至后端，并去掉该前缀。路由使用 History 模式，业务页面刷新时需要回退至 `index.html`。例如生产环境的 Nginx 配置片段：

```nginx
server {
    listen 80;
    server_name _;
    root /srv/zimo/dist;
    index index.html;

    location /prod-api/ {
        proxy_pass http://127.0.0.1:8080/;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

按实际部署位置调整静态目录和后端地址。测试环境将代理前缀改为 `/stage-api/`。开发代理位于 `server.proxy`，生产部署及 `npm run preview` 不会自动获得该代理配置；预览中的接口调用也需要相应代理服务。

## 目录结构

```text
src/
├── api/                     # 登录、菜单及各业务接口
│   └── system/dynamicTable.js
├── assets/                  # 样式、SVG 图标和图片
├── components/              # 上传、分页、字典标签等公共组件
│   └── DynamicField/        # 动态表单、表格和单元格编辑器
├── directive/               # 按钮权限、复制等指令
├── layout/                  # 侧栏、顶部导航、页签及整体布局
├── plugins/                 # 弹窗、下载、缓存、权限工具
├── router/                  # 公共路由及本地权限路由
├── store/modules/           # 用户、权限、布局和页签状态
├── utils/                   # 请求封装、字典和动态选项数据源
├── views/
│   ├── system/              # 系统管理及动态字段设计器
│   ├── monitor/             # 日志、任务和服务监控
│   └── tool/                # 表单构建、代码生成及接口文档
├── main.js                  # 应用入口和全局组件注册
└── permission.js            # 登录检查与动态路由守卫
tests/                       # 自动化回归测试
vite/plugins/                # 自动导入、SVG、压缩等构建插件
```

## 动态字段与数据管理

入口为 `src/views/system/dynamicTable/index.vue`。菜单由后端下发，组件路径配置为 `system/dynamicTable/index`，并由用户角色授权。

主要功能：

- 创建和编辑动态表，配置表编码、状态、序号列及默认排序。
- 配置字段类型、输入组件、默认值、展示顺序、查询和排序能力。
- 配置必填规则、颜色标记及同行字段互斥校验。
- 使用静态选项、系统字典或 API 接口作为选项来源。
- 预览表单和列表，通过通用数据管理组件查询、新增、编辑和删除记录。

组件分工：

| 文件 | 职责 |
| --- | --- |
| `DynamicForm.vue` | 根据字段模型生成表单及查询控件 |
| `DynamicTable.vue` | 列表渲染、排序、标签展示及编辑交互 |
| `DynamicCellEditor.vue` | 按字段类型渲染单元格编辑控件 |
| `DynamicDataManager.vue` | 分页查询、草稿行、单元格保存及记录删除 |
| `src/utils/dynamicSource.js` | 获取、映射和缓存 API 选项 |

API 选项支持配置请求地址、GET/POST 方法、参数、数据路径、标签字段和取值字段。数据路径支持点号访问嵌套属性。缓存按请求配置、数据路径和字段映射区分；`fetchApiOptions(config, true)` 强制刷新，`clearApiOptionsCache()` 清空内存缓存。

动态表配置接口位于 `/system/dynamic/table`，业务记录接口位于 `/system/dynamic/record/{tableCode}`。记录更新和删除使用版本号参与并发控制。

动态表初始化及菜单 SQL 位于配套后端的 `sql/dynamic_table_field_postgresql.sql`。后端使用“一份动态表配置对应一张 PostgreSQL 物理表”的存储方式，配置元数据和业务数据分开维护，详见后端 `docs/dynamic-table-physical-storage.md`。

## 权限与请求流程

登录成功后获取用户信息，再通过菜单接口生成可访问路由。菜单或用户信息加载失败时，守卫清理登录状态、结束进度条并跳转登录页，保留目标地址用于重新登录后返回；退出接口失败也会清理本地会话。

- `src/utils/request.js`：API 前缀、令牌、超时、重复提交与统一错误处理。
- `src/store/modules/permission.js`：转换后端菜单并维护导航状态。
- `src/permission.js`：登录、锁屏和动态路由初始化。
- `v-hasPermi` / `v-hasRole`：控制按钮展示，业务权限由后端接口继续校验。

动态表配置权限使用 `system:dynamic:*` 系列标识，数据操作使用 `system:dynamic:data:*` 系列标识。若入口或按钮缺失，应检查后端菜单配置和角色授权。

## 开源说明

项目基于 RuoYi-Vue3 开发，保留若依的 MIT 许可证，详见 `LICENSE`。
