# DshAgentPresetForPlugin

专门用于开发 DeepSeek Harness 插件(plugin / UI 扩展 / MCP 连接)的 Agent 预设。在 `standard`(标准模式)全部功能之上,叠加 **Plugin Manager 持久化插件管理**、**只读运行时 API 发现**、**浏览器与截图(Playwright MCP)**与官方插件开发技能(外加一套自带的浏览器验证技能)。

自 DSH **0.1.7-rc.1** 起,Agent 预设不再是 `$DSH_HOME/.agent-presets/<id>/` 目录,而是由 **bundle patch 中的 `@deepseek-ai/dsh-agent-preset` 声明行**承载——因此本仓库现在就是一个**可安装的 bundle**:`cordis.patch.yml` 声明预设,`skills/` 随包分发。

## 特性

- ✅ **标准模式全部功能**:shell(bash/pwsh)、文件系统读写与检索、后台任务、goals、计划模式、对话压缩、subagent/subagent_fork(含 Codex / Claude Code 可选行)、workflow、ask-user、todo、`present`、web 搜索。
- 🔌 **Plugin Manager 持久化插件管理**(`plugin_manager`):`list_plugins` / `list_bundles` / `install_bundle` / `set_plugin` / `set_bundle` / `remove_bundle`。在工作区以普通文件编写 Bundle(`package.json` + `cordis.patch.yml` + Host / Client 入口),安装后按 profile 生效、跨会话共享、重启后保留。
- 🔎 **只读运行时 API 发现**:`cordis_inspect_list` / `cordis_inspect_query`,可在写代码前读取确切的 Host / Client Service、Event、Tool、Theme token 与 Slot 契约(只读,不触发业务方法)。
- 🌐 **浏览器与截图**(Playwright MCP):`mcp__playwright__*` 工具族——导航、无障碍树快照、截图、点击/输入、标签页与视口控制,让 UI 改动可以自证、截图可以自产。走已安装的 MCP 客户端挂载,无需新增 profile 依赖;浏览器不可用时只是没有这些工具,不会阻断会话。
- 🧠 **技能**:四套官方技能从**已安装的 `@deepseek-ai/dsh-agent-preset` 包**解析(随 DSH 升级自动更新,不在本仓库留副本),外加本仓库自带的第五套:
  - `cordis-plugin-development` — 持久化插件(含 Client UI 插件)与 MCP 连接的完整流程,附 `references/` 与可直接复制的 `templates/`;
  - `cordis-composition-reference` — Loader patch 方言(insert / id 覆盖 / group / disabled / isolate / `!!js`)与可安装插件包清单;
  - `editing-cordis-compositions` — 预设与组件的声明、迁移与验证;
  - `agent-experience` — 模型可见工具定义、技能与上下文加载的设计规范;
  - `browser-verification`(**本仓库自带**,`skills/browser-verification/`)— 浏览器验证与截图流程(含本机 GUI 的认证方式与边界)。

## 模式说明

> 官方四个内置模式的预设卡片上提供「模式说明 / 如何使用」两个入口;这两份内容由 DSH 客户端插件内置,只覆盖 `standard` / `ptc` / `minimal` / `cordis` 四个 id,并且要求声明不带 `name`,自定义预设无法通过声明添加(渲染那段卡片 JSX 也没有插槽)。因此本预设的对应内容放在这里,结构与官方保持一致。

### 面向什么任务

本预设用于开发 DeepSeek Harness 插件:给 DSH 增加工具、服务连接或 UI 入口,接入 MCP server,也可以用来编写与维护 Agent 预设本身。

### 包含哪些能力

在标准模式全部能力之上,额外包含 Plugin Manager 持久化插件管理(安装、启用 / 禁用、卸载 bundle 与插件)、只读运行时 API 发现(`cordis_inspect_list` / `cordis_inspect_query`)、浏览器与截图工具(Playwright MCP),以及技能:插件开发与 MCP 接入、Cordis 组合与 patch 方言参考、预设编写与验证、工具与技能设计规范(以上来自官方包),外加本仓库自带的浏览器验证技能。

### 结果怎样生效

插件以工作区 bundle 的形式编写,经 `plugin_manager` 安装后按 profile 生效、跨会话共享、重启后保留;新装的 bundle 可经 HMR 立即激活,替换已安装的包则需要重启以加载新的代码版本。新建或修改的预设在下一次新建任务时可选。

## 如何使用

### 添加一个 UI

> 做一个 DSH 插件,在侧边栏加一个「项目笔记」入口,可以浏览本工作区的 Markdown 文件并预览选中的笔记。安装并验证页面能打开。

预期产出:一个已安装的插件、可用的入口与预览页,以及仍需的激活步骤(如有)。

### 添加一个工具

> 写一个插件,提供一个读取本项目测试报告并汇总失败用例的工具。注册后用一份样例报告验证。

预期产出:插件内含一个可调用的工具,并有验证过的样例调用。

### 接入 MCP server

> 配置一个 streamable-http 的 MCP server,安装后调用它的一个工具确认连通。

预期产出:一个配置型 bundle、已建立的 MCP 连接,以及一次成功的工具调用。

### 创建自己的模式

> 基于标准模式创建一个「代码评审」预设:优先指出潜在缺陷与测试缺口,引用文件路径与行号,修改文件前先询问。保存为可选预设。

预期产出:一个可在新建任务时选择的预设;这些指令约束 Agent 的行为,实际能执行哪些操作由权限设置决定。

## 目录结构

```
DshAgentPresetForPlugin/
├── package.json                              # bundle 清单(dsh.bundle.patch → cordis.patch.yml)
├── cordis.patch.yml                          # 预设声明:preset-dsh-agent-preset-for-plugin
├── skills/                                   # 自带技能(browser-verification);官方四套从已安装包解析
├── README.md
├── LICENSE
└── .gitignore
```

## 安装

```sh
git clone https://github.com/zqh260619/DshAgentPresetForPlugin <任意目录>
```

然后在 DSH 会话里用 `plugin_manager` 安装(每个动作需要 Full access 或单次批准):

```
plugin_manager  action: install_bundle  target: <克隆下来的绝对路径>
```

也可以用 CLI:`dsh plugin --profile <profile> add <克隆下来的路径>`。

安装后:

- `plugin_manager` `list_bundles` 会列出 `@local/dsh-agent-preset-for-plugin`;
- `list_plugins` 会显示 `preset-dsh-agent-preset-for-plugin` 行,`fiberPhase: active`;
- 新建会话时在预设选择器中选择 **DshAgentPresetForPlugin**(roster 顺序 `order: 10`,排在四个官方预设之后)。

## 与 shipped `cordis`(创造模式)预设的关系

- 本预设的 `plugins` 列表**逐行镜像** shipped `cordis` 预设(以 0.1.7-rc.1 的 `@deepseek-ai/dsh-web-app/presets/cordis.patch.yml` 为基准),只改了 `id` / `name` / `description` / `order`,并把技能目录指向本包自带的 `skills/`。
- 因此它等价于「一份你自己拥有、可自由改动的创造模式」:官方升级不会覆盖它,你可以在此基础上增删行(例如启用 `tool-ralph`、加 Codex 子代理行)。
- **不再需要共存 shim**:0.1.6 时代 `tool-cordis` 会把 Inspect provider 注册进进程全局 registry,导致两个预设无法同进程共存;0.1.7-rc.1 已把这部分拆到宿主行 `@deepseek-ai/dsh-tool-cordis/host`(注释明确 "registers once per process"),根因由官方修复,本仓库随之删除了旧的 `plugins/cordis-inspect-shim.mjs`。

## 版本兼容性

### DSH 0.2.0-rc.2(当前)

- **新增浏览器与截图行**(`browser-playwright`):经 `@deepseek-ai/dsh-mcp-client` 挂载 Playwright MCP,带来 `mcp__playwright__*` 工具族;仅本预设的会话可见,`failOnStartupError: false` 保证浏览器故障不阻断会话。
- **技能增加第四套** `browser-verification`(随包携带,说明工具用法、GUI 认证方式与验证边界)。
- **修复技能解析**:此前 `customSkillDirs` 用的是 patch 相对路径,实际**一套技能都加载不到**;现改为从已安装包解析(官方四套 + 本 bundle 自带),会话技能目录恢复正常。

### DSH 0.1.7-rc.1

- **目录式预设被声明行取代**:`$DSH_HOME/.agent-presets/<id>/`(`agent.cordis.yml` + `preset.yml`)**已不再被读取**,旧目录已删除;预设改为 `cordis.patch.yml` 中的声明:`config: { id, plugins, name, description, order }`,Loader 行 id 约定为 `preset-<id>`。
- **Inspect provider 注册上移**:`@deepseek-ai/dsh-tool-cordis/host` 在宿主平面注册一次,预设内的 `tool-cordis` 只消费(`cordis_inspect_list` / `cordis_inspect_query`),不再产生重名冲突。
- **技能改由包分发**:`skill-filesystem` 的 `customSkillDirs` 指向已安装的 `@deepseek-ai/dsh-agent-preset` 包(官方四套),外加从安装本 bundle 的 profile 解析出的本仓库自带技能。
- **`cordis-composition-reference` 为新增技能**;`cordis-plugin-development` 与 `editing-cordis-compositions` 均已重写。

### 历史版本对齐内容

- 0.1.6-alpha.2:移除动态定义/运行工具(`cordis_define` / `cordis_run` / `cordis_stop` / `cordis_undefine` / `cordis_inspect_self`),改为 Plugin Manager 持久化模型;`workflow-worker-thread` → `workflow-ptc`;`tool-ralph` 默认 `disabled: true`;新增 `tool-plugin-manager`。
- 0.1.5-rc.2:`persona` 使用 `prefix` + `suffix`;新增 `command-goal`、`present`;`tool-subagent` 的 `modelSelectionSettings`;Codex / Claude Code 行改用 `backgroundMode: one-shot`;`tool-web` 的 `fetch: true`。

## 升级同步建议

DSH 每次升级后:

1. 读新版 shipped 预设 `@deepseek-ai/dsh-web-app/presets/cordis.patch.yml`,把 `plugins` 列表同步到本仓库的 `cordis.patch.yml`(包改名 / 移除与配置 schema 变化都会导致预设无法组装会话);
2. 技能无需手工同步:官方四套从已安装的 `@deepseek-ai/dsh-agent-preset` 包解析,随 DSH 升级自动更新;只需确认自带的 `skills/browser-verification/` 仍与新版本相符;
3. 重新安装 bundle(`install_bundle`)使改动生效——已运行会话与其子会话保持各自启动时的版本,改动在新会话中验证。

## 浏览器与截图

预设通过**已安装的 MCP 客户端**(`@deepseek-ai/dsh-mcp-client`)挂载 **Playwright MCP**(`@playwright/mcp@0.0.80`),因此会话里出现 `mcp__playwright__*` 工具族:

| 工具 | 用途 |
|---|---|
| `mcp__playwright__browser_navigate` | 打开 URL |
| `mcp__playwright__browser_snapshot` | 无障碍树快照(结构 / 文本 / 可交互元素) |
| `mcp__playwright__browser_take_screenshot` | 截图(`filename`、`fullPage`、`scale: device`) |
| `mcp__playwright__browser_click` / `browser_type` / `browser_press_key` / `browser_select_form` | 交互 |
| `mcp__playwright__browser_tabs` / `browser_resize` / `browser_wait_for` | 标签页、视口、等待 |

要点:

- 浏览器以 `--headless --browser chrome` 启动,复用系统 Chrome 通道(不下载 Chromium);使用**本包专用的持久 profile** `$DSH_HOME/cache/browser-profile`,不触碰用户自己的 Chrome 配置,删掉该目录即可重置。
- 截图:`--output-dir` 指向 `$DSH_HOME/cache/browser-shots`,并且把 MCP server 的 **cwd** 也固定到该目录——因此**相对文件名**会落在那里(默认情况下会落到 harness 进程目录,例如用户主目录);**绝对路径仍然最可靠**。截图只是 PNG 落盘,需要「模型看见」还要再 `read_image` 一次。
- **本机 GUI 需要一次认证**:DSH 用启动令牌兑换签名 Cookie 保护 GUI,匿名浏览器访问 `http://127.0.0.1:3080` 会得到 **401 Unauthorized**。做法二选一:
  1. 把 `dsh web` 启动时打印的**带令牌 URL** 交给 agent 访问一次(也可在用户浏览器历史里找到),Cookie 默认 30 天有效,之后截图正常;
  2. 或让用户以 `chrome.exe --remote-debugging-port=9222 --user-data-dir=<独立目录>` 启动 Chrome 并访问 GUI,再把该行参数换成 `--cdp-endpoint http://127.0.0.1:9222`(接入已登录浏览器)。
- 除本机 GUI 外的页面(公开站点、自建 dev server 等)无需认证,可直接截图。
- 同一预设版本的多个会话共享同一个浏览器实例;`failOnStartupError` 保持默认 `false`,浏览器起不来只是没有这些工具,**不会阻断会话创建/恢复**。
- 需要回滚:删除 `cordis.patch.yml` 里 `browser-playwright` 行并重新应用 bundle 即可。

## 注意事项

- `plugin_manager` 的每个动作都需要 Full access 或单次批准:它安装的是在宿主进程内、工作区沙箱之外运行的持久化代码;授予某次调用不会改变会话的权限模式。
- 声明里**技能目录必须从已安装包解析**:patch 插入的行拿到的是**接收树的 baseUrl**(harness 安装目录),**不是** patch 文件所在目录——`new URL('skills/', baseUrl)` 这种相对写法会静默解析到不存在的目录(结果是一套技能都加载不到)。本预设因此用官方同款 `createRequire(baseUrl).resolve(...)` 解析官方包,再从 `ctx.get('profileContext').dir` 解析本仓库自带的技能。
- 若某个插件行激活失败,该 `preset-<id>` 行会留在 roster 上并带诊断信息,在修好并重装 bundle 之前无法组装会话。
- 本包不含可执行插件代码:只声明预设(含一个引用 MCP 客户端的工具行)并分发一套自带技能;其余技能文本来自 DSH 随附的 `@deepseek-ai/dsh-agent-preset` 包。

## License

[MIT](./LICENSE)
