# DshAgentPresetForPlugin

专门用于开发 DeepSeek Harness 插件(plugin / UI 扩展 / MCP 连接)的 Agent 预设。在 `standard`(标准模式)全部功能之上,叠加 **Plugin Manager 持久化插件管理**、**只读运行时 API 发现**、**浏览器与截图(Playwright MCP)**与官方插件开发技能(外加一套自带的浏览器验证技能)。

自 DSH **0.1.7-rc.1** 起,Agent 预设不再是 `$DSH_HOME/.agent-presets/<id>/` 目录,而是由 **bundle patch 中的 `@deepseek-ai/dsh-agent-preset` 声明行**承载——因此本仓库现在就是一个**可安装的 bundle**:`cordis.patch.yml` 声明预设,`skills/` 随包分发。

## 特性

- ✅ **标准模式全部功能**:shell(bash/pwsh)、文件系统读写与检索、后台任务、定时提醒(`schedule_create/list/update/delete`)、时间上下文、goals、计划模式、对话压缩、subagent/subagent_fork(Codex / Claude Code provider 自 0.2.1 起拆为独立包,默认不挂载,本仓库以注释块保留)、workflow、ask-user、todo、`present`、web 搜索、插件市场行(`plugin_market` —— 条件注册:仅当 profile 安装了提供 `pluginMarket` 服务的市场 bundle,例如 `@deepseek-ai/dsh-experimental-plugin-market-bundle`,该工具才会出现)。
- 🔌 **Plugin Manager 持久化插件管理**(`plugin_manager`):`list_plugins` / `list_bundles` / `install_bundle` / `set_plugin` / `set_bundle` / `remove_bundle`。在工作区以普通文件编写 Bundle(`package.json` + `cordis.patch.yml` + Host / Client 入口),安装后按 profile 生效、跨会话共享、重启后保留。
- 🔎 **只读运行时 API 发现**:`cordis_inspect_list` / `cordis_inspect_query`,可在写代码前读取确切的 Host / Client Service、Event、Tool、Theme token 与 Slot 契约(只读,不触发业务方法)。
- 🌐 **浏览器与截图**(Playwright MCP):`mcp__playwright__*` 工具族——导航、无障碍树快照、截图、点击/输入、标签页与视口控制,让 UI 改动可以自证、截图可以自产。走已安装的 MCP 客户端挂载,无需新增 profile 依赖;浏览器不可用时只是没有这些工具,不会阻断会话。
- 🖥️ **桌面截图(OS 层)**:随包附带 `tools/screen-capture.ps1`,用会话自带的 `pwsh` 就能截**原生 toast / 系统对话框 / 托盘 / 其它应用窗口**,并支持「先开监听再触发、只留状态变化帧」的 watch 模式。默认关闭,需用户创建一次标记文件才启用(见下文)。
- 🧠 **技能**:四套官方技能从**已安装的 `@deepseek-ai/dsh-agent-preset` 包**解析(随 DSH 升级自动更新,不在本仓库留副本),外加本仓库自带的两套:
  - `cordis-plugin-development` — 持久化插件(含 Client UI 插件)与 MCP 连接的完整流程,附 `references/` 与可直接复制的 `templates/`;
  - `cordis-composition-reference` — Loader patch 方言(insert / id 覆盖 / group / disabled / isolate / `!!js`)与可安装插件包清单;
  - `editing-cordis-compositions` — 预设与组件的声明、迁移与验证;
  - `agent-experience` — 模型可见工具定义、技能与上下文加载的设计规范;
  - `browser-verification`(**本仓库自带**)— 浏览器验证与截图流程(含本机 GUI 的认证方式与边界);
  - `desktop-verification`(**本仓库自带**)— OS 层验证:toast / 系统对话框 / 托盘 / 其它应用窗口,含 watch 抓帧与隐私纪律。

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
├── skills/                                   # 自带技能(browser-verification、desktop-verification);官方四套从已安装包解析
├── tools/
│   └── screen-capture.ps1                    # OS 层截图 / watch 抓帧(门禁:默认关闭)
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

- 本预设的 `plugins` 列表**逐行镜像** shipped `cordis` 预设(以 **0.2.1-rc.1** 的 `@deepseek-ai/dsh-web-app/presets/cordis.patch.yml` 为基准),只改了 `id` / `name` / `description` / `order`,再叠加浏览器行与自带的技能目录。
- 因此它等价于「一份你自己拥有、可自由改动的创造模式」:官方升级不会覆盖它,你可以在此基础上增删行(例如按注释块启用 `tool-ralph`、Codex / Claude Code 子代理行)。
- **不再需要共存 shim**:0.1.6 时代 `tool-cordis` 会把 Inspect provider 注册进进程全局 registry,导致两个预设无法同进程共存;0.1.7-rc.1 已把这部分拆到宿主行 `@deepseek-ai/dsh-tool-cordis/host`(注释明确 "registers once per process"),根因由官方修复,本仓库随之删除了旧的 `plugins/cordis-inspect-shim.mjs`。

## 版本兼容性

### DSH 0.2.1-rc.1(当前)

- **声明整体对齐 shipped `cordis`**:`time-context`、`tool-schedule`(`schedule_create/list/update/delete`)、`tool-plugin-market`(`plugin_market`)三行补入;`persona` 去掉 `suffix`(工作目录改由运行时上下文提供);`plan-mode` 段落更新为 0.2.1 文案。其中 `plugin_market` 是**条件注册**:只有 profile 安装了提供 `pluginMarket` 服务的市场 bundle 时工具才出现(未安装时该行无副作用,会话照常组装)。
- **修掉一处硬性漂移**:`tool-subagent` 的 `backgroundMode` 字段在 0.2.1 已从配置 schema 移除,本预设的 spawn / fork 行不再带它。
- **移除过时行**:`tool-subagent-codex`、`tool-subagent-claude-code`(provider 包在 0.2.1 未随附,shipped 也不再挂载)与 `tool-ralph`(shipped 已移除)改为注释块保留,需要时按注释启用。
- 桌面端与 Web 端共用同一份仓库(desktop profile 的 `link:` 与本仓库 junction 指向同一目录),声明只维护一处。
- 不受影响:`dsh-mcp-client` 配置 schema 未变(浏览器行照旧)、技能解析表达式未变、官方技能仍为四套、`tools/screen-capture.ps1` 与 `DSH_HOME` 约定未变。

### DSH 0.2.0-rc.2

- **新增浏览器与截图行**(`browser-playwright`):经 `@deepseek-ai/dsh-mcp-client` 挂载 Playwright MCP,带来 `mcp__playwright__*` 工具族;仅本预设的会话可见,`failOnStartupError: false` 保证浏览器故障不阻断会话。
- **技能增加第四套** `browser-verification`(随包携带,说明工具用法、GUI 认证方式与验证边界)。
- **修复技能解析**:此前 `customSkillDirs` 用的是 patch 相对路径,实际**一套技能都加载不到**;现改为从已安装包解析(官方四套 + 本 bundle 自带),会话技能目录恢复正常。
- **新增桌面截图能力**:`tools/screen-capture.ps1`(每-monitor-V2 DPI 感知、区域/整屏、watch 差异筛选、默认关闭门禁)+ 技能 `desktop-verification`,补齐 Playwright 无法覆盖的 OS 层验证。

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
2. 技能无需手工同步:官方四套从已安装的 `@deepseek-ai/dsh-agent-preset` 包解析,随 DSH 升级自动更新;只需确认自带的 `browser-verification` 与 `desktop-verification` 仍与新版本相符;
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

- 默认是**接入模式**(`--cdp-endpoint`,驱动你自己已登录的 Chrome);想换成自带浏览器则用启动模式(`--headless --browser chrome --user-data-dir <DSH_HOME>/cache/browser-profile`,复用系统 Chrome 通道、不下载 Chromium、不触碰你本人的 Chrome 配置)。两种模式都只影响浏览器进程,不影响会话是否可用。
- 截图:可直接写**工作区绝对路径**——预设开了 `--allow-unrestricted-file-access`(不开时 server 只允许写自己的允许根,会报 `File access denied: … is outside allowed roots`)。相对文件名以 server 的 **cwd** 为基准,而该 cwd 与 `--output-dir` 都固定在 `$DSH_HOME/cache/browser-shots`。截图只是 PNG 落盘,要让「模型看见」还需再 `read_image` 一次。
- **本机 GUI 需要认证,预设用「接入已登录浏览器」解决**:DSH 用启动令牌兑换签名 Cookie 保护 GUI,匿名访问 `http://127.0.0.1:3080` 会得到 **401 Unauthorized**。因此 MCP server 以 `--cdp-endpoint http://127.0.0.1:9222` **接入你自己已登录的 Chrome**,复用其登录状态与标签页,**令牌全程不经过 agent、不进日志**。你只需一次性准备:

  1. 用独立 profile 启动 Chrome 并开远程调试(Chrome 不允许默认 profile 开调试):
     `chrome.exe --remote-debugging-port=9222 --user-data-dir=%USERPROFILE%\dsh-agent-chrome`
  2. 在其中打开 Harness GUI(全新 profile 需一次带令牌的访问:`dsh web` 启动时打印的那行 URL,或你浏览器历史里那次);
  3. 保持该 Chrome 运行。

  该 Chrome 未运行时 MCP server 连不上端点,浏览器工具就不出现(会话不受影响)。想改用"自带浏览器"模式,把该行的 `--cdp-endpoint …` 换成 `--headless --browser chrome --user-data-dir <DSH_HOME>/cache/browser-profile` 即可(该模式看不到已登录的 GUI)。
- 除本机 GUI 外的页面(公开站点、自建 dev server 等)无需认证,可直接截图。
- 同一预设版本的多个会话共享同一个浏览器实例;`failOnStartupError` 保持默认 `false`,浏览器起不来只是没有这些工具,**不会阻断会话创建/恢复**。
- 需要回滚:删除 `cordis.patch.yml` 里 `browser-playwright` 行并重新应用 bundle 即可。

## 桌面截图(OS 层)

`browser_take_screenshot` 只能截网页,**原生 toast、系统对话框、托盘弹窗、其它应用窗口都截不到**。这类验证用随包附带的 `tools/screen-capture.ps1`(会话自带的 `pwsh` 直接调用,无需全局安装)。

**门禁:默认关闭。** 脚本要求标记文件 `$DSH_HOME/screen-capture.enabled` 存在,否则返回 `{"error":"screen capture is disabled; …"}` 并以退出码 2 结束。启用一次:

```powershell
New-Item -ItemType File -Force "$env:DSH_HOME\screen-capture.enabled"
```

用法(坐标一律物理像素;脚本内部先声明 per-monitor-V2 DPI 感知,缩放屏也不会切边):

```powershell
$cap = '<bundle>\tools\screen-capture.ps1'

# 一次性:区域(推荐,隐私优先) / 整屏(必须显式)
powershell -NoProfile -ExecutionPolicy Bypass -File $cap -Mode capture -Clip "1520,960,400,120"
powershell -NoProfile -ExecutionPolicy Bypass -File $cap -Mode capture -Fullscreen

# watch:先开监听 → 再触发 → 只收"状态变化帧"(抓 toast 的正确姿势)
powershell -NoProfile -ExecutionPolicy Bypass -File $cap -Mode watch -Clip "1520,960,400,120" -DurationMs 15000 -IntervalMs 700 -Threshold 30
```

返回 JSON:`capture` → `{path,width,height,scale,screen,region,mimeType,bytes}`;`watch` → `{frames:[{path,at,diff,bytes}],changed,restored,captured,threshold,…,dir}`。

设计要点:

- **只有"新状态"帧会被写盘**(与基线差异够大、且与上一张入选帧不同);未入选的帧根本不保存,所以事后无需删除——隐私上比"先全存再删"更干净;
- watch 上限:`DurationMs ≤ 120000`、`IntervalMs 100–5000`、`MaxFrames ≤ 300`、单帧 ≤ 8 MB;
- 截图只是 PNG 落盘,要让「模型看见」还需 `read_image`;用完把 `dir` 整个删掉,别把帧留在仓库里(要留就放 `artifacts/`、`tmp/` 这类已 gitignore 的目录)。

> 为什么不用官方 Computer Use:`@deepseek-ai/dsh-experimental-computer-use-*` 在 0.2.0-rc.2 轨上确实有(带 native Cua SDK),但它提供的是「截图 + 鼠标键盘控制」,没有这里需要的 **watch/差异筛选**,还多出一大块输入控制面。本仓库因此选择只读的独立脚本。

## 注意事项

- `plugin_manager` 的每个动作都需要 Full access 或单次批准:它安装的是在宿主进程内、工作区沙箱之外运行的持久化代码;授予某次调用不会改变会话的权限模式。
- 声明里**技能目录必须从已安装包解析**:patch 插入的行拿到的是**接收树的 baseUrl**(harness 安装目录),**不是** patch 文件所在目录——`new URL('skills/', baseUrl)` 这种相对写法会静默解析到不存在的目录(结果是一套技能都加载不到)。本预设因此用官方同款 `createRequire(baseUrl).resolve(...)` 解析官方包,再从 `ctx.get('profileContext').dir` 解析本仓库自带的技能。
- 若某个插件行激活失败,该 `preset-<id>` 行会留在 roster 上并带诊断信息,在修好并重装 bundle 之前无法组装会话。
- 本包不含插件代码:预设声明里只引用已安装的 MCP 客户端;自带内容是两套技能与一个**默认关闭**的桌面截图脚本(以及固定浏览器地址的 `cwd`)。

## License

[MIT](./LICENSE)
