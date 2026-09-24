# DshAgentPresetForPlugin

专门用于开发 DeepSeek Harness 插件(plugin / UI 扩展 / MCP 连接)的 Agent 预设。在 `standard`(标准模式)全部功能之上,叠加 **Plugin Manager 持久化插件管理**、**只读运行时 API 发现**与三套随包携带的插件开发技能。

自 DSH **0.1.7-rc.1** 起,Agent 预设不再是 `$DSH_HOME/.agent-presets/<id>/` 目录,而是由 **bundle patch 中的 `@deepseek-ai/dsh-agent-preset` 声明行**承载——因此本仓库现在就是一个**可安装的 bundle**:`cordis.patch.yml` 声明预设,`skills/` 随包分发。

## 特性

- ✅ **标准模式全部功能**:shell(bash/pwsh)、文件系统读写与检索、后台任务、goals、计划模式、对话压缩、subagent/subagent_fork(含 Codex / Claude Code 可选行)、workflow、ask-user、todo、`present`、web 搜索。
- 🔌 **Plugin Manager 持久化插件管理**(`plugin_manager`):`list_plugins` / `list_bundles` / `install_bundle` / `set_plugin` / `set_bundle` / `remove_bundle`。在工作区以普通文件编写 Bundle(`package.json` + `cordis.patch.yml` + Host / Client 入口),安装后按 profile 生效、跨会话共享、重启后保留。
- 🔎 **只读运行时 API 发现**:`cordis_inspect_list` / `cordis_inspect_query`,可在写代码前读取确切的 Host / Client Service、Event、Tool、Theme token 与 Slot 契约(只读,不触发业务方法)。
- 🧠 **三套技能随包携带**(`skills/`):
  - `cordis-plugin-development` — 持久化插件(含 Client UI 插件)与 MCP 连接的完整流程,附 `references/` 与可直接复制的 `templates/`;
  - `cordis-composition-reference` — Loader patch 方言(insert / id 覆盖 / group / disabled / isolate / `!!js`)与可安装插件包清单;
  - `editing-cordis-compositions` — 预设与组件的声明、迁移与验证。

## 目录结构

```
DshAgentPresetForPlugin/
├── package.json                              # bundle 清单(dsh.bundle.patch → cordis.patch.yml)
├── cordis.patch.yml                          # 预设声明:preset-dsh-agent-preset-for-plugin
├── skills/                                   # 随包分发的三套技能(含 references / templates)
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

### DSH 0.1.7-rc.1(当前)

- **目录式预设被声明行取代**:`$DSH_HOME/.agent-presets/<id>/`(`agent.cordis.yml` + `preset.yml`)**已不再被读取**,旧目录已删除;预设改为 `cordis.patch.yml` 中的声明:`config: { id, plugins, name, description, order }`,Loader 行 id 约定为 `preset-<id>`。
- **Inspect provider 注册上移**:`@deepseek-ai/dsh-tool-cordis/host` 在宿主平面注册一次,预设内的 `tool-cordis` 只消费(`cordis_inspect_list` / `cordis_inspect_query`),不再产生重名冲突。
- **技能改由包分发**:`skill-filesystem` 的 `customSkillDirs` 指向本包 `skills/`(0.1.7 的 shipped 预设则指向已安装的 `@deepseek-ai/dsh-agent-preset` 包)。
- **`cordis-composition-reference` 为新增技能**;`cordis-plugin-development` 与 `editing-cordis-compositions` 均已重写。

### 历史版本对齐内容

- 0.1.6-alpha.2:移除动态定义/运行工具(`cordis_define` / `cordis_run` / `cordis_stop` / `cordis_undefine` / `cordis_inspect_self`),改为 Plugin Manager 持久化模型;`workflow-worker-thread` → `workflow-ptc`;`tool-ralph` 默认 `disabled: true`;新增 `tool-plugin-manager`。
- 0.1.5-rc.2:`persona` 使用 `prefix` + `suffix`;新增 `command-goal`、`present`;`tool-subagent` 的 `modelSelectionSettings`;Codex / Claude Code 行改用 `backgroundMode: one-shot`;`tool-web` 的 `fetch: true`。

## 升级同步建议

DSH 每次升级后:

1. 读新版 shipped 预设 `@deepseek-ai/dsh-web-app/presets/cordis.patch.yml`,把 `plugins` 列表同步到本仓库的 `cordis.patch.yml`(包改名 / 移除与配置 schema 变化都会导致预设无法组装会话);
2. 把 `@deepseek-ai/dsh-agent-preset/skills/` 重新复制到本仓库 `skills/`;
3. 重新安装 bundle(`install_bundle`)使改动生效——已运行会话与其子会话保持各自启动时的版本,改动在新会话中验证。

## 注意事项

- `plugin_manager` 的每个动作都需要 Full access 或单次批准:它安装的是在宿主进程内、工作区沙箱之外运行的持久化代码;授予某次调用不会改变会话的权限模式。
- 声明里**技能目录**用 `!!js` 从 `baseUrl`(本 patch 所在目录)解析,因此整个仓库目录可整体迁移;插件行里的裸包名(`@deepseek-ai/*`)从宿主安装解析。
- 若某个插件行激活失败,该 `preset-<id>` 行会留在 roster 上并带诊断信息,在修好并重装 bundle 之前无法组装会话。
- 本包不含任何可执行插件代码,只声明预设并分发技能文本;技能文本源自 DSH 随附的 `@deepseek-ai/dsh-agent-preset` 包。

## License

[MIT](./LICENSE)
