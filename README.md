# DshAgentPresetForPlugin

专门用于开发 DeepSeek Harness 插件(plugin / UI 扩展 / MCP 连接)的 Agent 预设(agent preset)。在 `standard`(标准模式)全部功能之上,叠加 **Plugin Manager 持久化插件管理**、**只读运行时 API 发现**与两套随预设携带的插件开发技能,并内置一层去重 shim,使其可与 shipped `cordis`(创造模式)预设在同一进程内共存。

## 特性

- ✅ **标准模式全部功能**:shell(bash/pwsh)、文件系统读写与检索、后台任务、goals、计划模式、对话压缩、subagent/subagent_fork(含 Codex / Claude Code 可选行)、workflow、ask-user、todo、`present`、web 搜索。
- 🔌 **Plugin Manager 持久化插件管理**(`plugin_manager`):`list_plugins` / `list_bundles` / `install_bundle` / `set_plugin` / `set_bundle` / `remove_bundle`。在工作区以普通文件编写 Bundle(`package.json` + `cordis.patch.yml` + Host / Client 入口),安装后按 profile 生效、跨会话共享、重启后保留。
- 🔎 **只读运行时 API 发现**:`cordis_inspect_list` / `cordis_inspect_query`,可在写代码前读取确切的 Host / Client Service、Event、Tool、Theme token 与 Slot 契约(只读,不触发业务方法)。
- 🧠 **两套技能随预设携带**:
  - `cordis-plugin-development` — 持久化插件(含 Client UI 插件)与 MCP 连接的完整工作流:Bundle 打包、`plugin_manager` 安装、激活结果判读、浏览器验证边界、MCP server 配置;
  - `editing-cordis-compositions` — 编写与修改 Cordis 组合 / Agent 预设:平面判定、服务隔离 realm、profile 与预设的归属。
- 🤝 **与 `cordis` 预设同进程共存**:内置 `cordis-inspect-shim`,对 Inspect provider 的重复注册去重,并把 `list` / `query` 代理到宿主 registry,避免 `Host Cordis inspect provider ... is already registered` 导致的挂载失败。

## 目录结构

```
DshAgentPresetForPlugin/
├── agent.cordis.yml                          # 预设组合(全部插件行)
├── preset.yml                                # 显示名与描述
├── plugins/
│   └── cordis-inspect-shim.mjs               # 去重 shim,解决与 cordis 预设的共存冲突
└── skills/
    ├── cordis-plugin-development/SKILL.md    # 持久化插件 / MCP 开发技能
    └── editing-cordis-compositions/SKILL.md  # 组合 / 预设编写技能
```

## 安装

1. 将本仓库克隆或复制到预设根目录,目录名即预设 id:

   ```
   $DSH_HOME/.agent-presets/dsh-agent-preset-for-plugin/
   ```

   Windows 默认为 `C:\Users\<用户名>\.dsh\.agent-presets\`,Linux / macOS 为 `~/.dsh/.agent-presets/`。

2. 重启 DSH 进程(或在新的 DSH 进程里)新建会话,在预设选择器中选择 **DshAgentPresetForPlugin**。
3. 也可以从 shipped `cordis` 预设复制一份同名预设后,用本仓库文件覆盖。

## 与 shipped `cordis`(创造模式)预设的关系

- 本预设 = `standard` 全部行 + `cordis` 的 Plugin Manager / 运行时检查 / 两套技能 + 一项共存修复。
- `tool-cordis` 会把 first-party Inspect provider(`Service` / `Event` / `Builtin` / `Tool`)注册进宿主进程全局的 `cordisInspect` registry;若两个预设都携带它,后挂载者会因重名抛错,导致会话创建 / resume 失败。
- 本预设把 `tool-cordis` 与 `cordis-inspect-shim` 放进一个 `isolate: { cordisInspect: true }` 的 realm 组:shim 把 `register` 转发给宿主 registry、仅容忍预期的 `already registered` 错误,`list` / `query` 完全代理——因此无论挂载顺序如何,两个预设都能在同一进程内正常共存。

## 版本兼容性

当前版本同步自 **DSH 0.1.6-alpha.2** 的 shipped `cordis` 预设。该版本的插件开发模型有重大变化:

- **动态插件工具已移除**:`cordis_define` / `cordis_run` / `cordis_stop` / `cordis_undefine` / `cordis_inspect_self` 不再存在;`tool-cordis` 现在只提供只读的 `cordis_inspect_list` / `cordis_inspect_query`。插件改为「工作区 Bundle + `plugin_manager` 安装」的持久化模式。
- **新增 `tool-plugin-manager` 行**(`@deepseek-ai/dsh-plugin-manager/tools`),这是新模型的核心能力。
- **`workflow-worker-thread` → `workflow-ptc`**:`@deepseek-ai/dsh-workflow-worker-thread` 已被移除,沿用旧行会因找不到包而挂载失败。
- **`tool-ralph` 默认 `disabled: true`**:需要时复制本预设为新 id 并移除 `disabled`(shipped 根会遮蔽同 id 的副本)。
- **persona 大幅扩写**:新增 Plugin Manager 用法、Creator 模式 UI 插件、`cordis_inspect_*` 用法、MCP server 接入与「已安装 Bundle 优先复用」的指引。
- **两套技能重写**:以持久化插件与 MCP 为主线。

历史版本(0.1.5-rc.2)对齐的内容仍保留:`persona` 使用 `prefix` + `suffix`(0.1.0 的 `text` 已移除)、`command-goal`、`present`、`tool-subagent` 的 `modelSelectionSettings`、Codex / Claude Code 的 `backgroundMode: one-shot`、`tool-web` 的 `fetch: true`。

DSH 升级后建议对照新版 shipped `cordis` 预设重新同步组合行:包改名 / 移除与配置 schema 变化都会导致预设整体挂载失败(进而使会话创建 / resume 报错)。同步时保留 `cordis-tools` 组与 `plugins/cordis-inspect-shim.mjs` 即可维持共存能力。

## 注意事项

- 依赖宿主平面的 `dynamicCordisRunner` / `cordisInspect` 服务(随 DSH web 部署自带);在不提供 host runner 的部署里,`cordis-tools` 组内的行会处于等待状态。
- `plugin_manager` 的每个动作都需要 Full access 或单次批准:它安装的是在宿主进程内、工作区沙箱之外运行的持久化代码;授予某次调用不会改变会话的权限模式。
- 组合中的相对路径(`./plugins/...`)从预设目录解析,因此整个仓库目录可整体迁移;裸包名(`@deepseek-ai/*`)从宿主安装解析。
- 技能文本源自 DSH 随附的 `cordis` 预设,随本仓库分发以便预设自包含。
- 在 0.1.6-alpha.2 中,作者会话已无法在进程内对预设做挂载验证(动态插件工具被移除)。更新后请在实际会话里确认工具列表(`plugin_manager`、`cordis_inspect_list`、`present` 等)是否齐全。
- 预设目录同时就是仓库根目录,`git clone` 后即可直接使用。

## License

[MIT](./LICENSE)
