# DshAgentPresetForPlugin

专门用于开发 DeepSeek Harness 插件的 Agent 预设(agent preset)。在 `standard`(标准模式)全部功能之上,叠加动态 Cordis 插件工具集与两套随预设携带的插件开发技能,并内置一层去重 shim,使其可与 shipped `cordis`(创造模式)预设在同一进程内共存。

## 特性

- ✅ **标准模式全部功能**:shell(bash/pwsh)、文件系统读写与检索、后台任务、goals、计划模式、对话压缩、subagent/subagent_fork(含 Codex / Claude Code 可选行)、workflow、ralph、ask-user、todo、web 搜索。
- 🔧 **动态 Cordis 插件工具集**:`cordis_define` / `cordis_run` / `cordis_inspect_list` / `cordis_inspect_query` / `cordis_inspect_self` / `cordis_stop` / `cordis_undefine`,在会话内即可设计、运行、调试、回滚插件。
- 🧠 **两套技能随预设携带**:
  - `cordis-plugin-development` — 动态 Cordis 插件开发全流程(平台选择、Inspect 查询、define/run 生命周期、审批与修复);
  - `editing-cordis-compositions` — 编写与修改 Cordis 组合 / Agent 预设(平面判定、isolate realm、挂载验证)。
- 🤝 **与 `cordis` 预设同进程共存**:内置 `cordis-inspect-shim`,对 Inspect provider 的重复注册去重,并把 `list`/`query` 代理到宿主 registry,修复 `Host Cordis inspect provider ... is already registered` 导致的挂载失败。

## 目录结构

```
DshAgentPresetForPlugin/
├── agent.cordis.yml                          # 预设组合(全部插件行)
├── preset.yml                                # 显示名与描述
├── plugins/
│   └── cordis-inspect-shim.mjs               # 去重 shim,解决与 cordis 预设的共存冲突
└── skills/
    ├── cordis-plugin-development/SKILL.md    # 动态插件开发技能
    └── editing-cordis-compositions/SKILL.md  # 组合 / 预设编写技能
```

## 安装

1. 将本仓库克隆或复制到预设根目录,目录名即预设 id:

   ```
   $DSH_HOME/.agent-presets/dsh-agent-preset-for-plugin/
   ```

   Windows 默认为 `C:\Users\<用户名>\.dsh\.agent-presets\`,Linux / macOS 为 `~/.dsh/.agent-presets/`。

2. 重启 DSH 进程(或在新的 DSH 进程里)新建会话,在预设选择器中选择 **DshAgentPresetForPlugin**。
3. 也可以在任一 DSH 会话中通过 roster 的 `copy(from: 'cordis', id: 'dsh-agent-preset-for-plugin')` 生成同名预设后,再用本仓库文件覆盖。

## 与 shipped `cordis`(创造模式)预设的关系

- 本预设 = `standard` 全部行 + `cordis` 的动态插件工具集与两套技能 + 一项共存修复。
- `tool-cordis` 会把 first-party Inspect provider(`Service` / `Event` / `Builtin` / `Tool`)注册进宿主进程全局的 `cordisInspect` registry;若两个预设都携带它,后挂载者会因重名抛错,导致会话创建 / resume 失败。
- 本预设把 `tool-cordis` 与 `cordis-inspect-shim` 放进一个 `isolate: { cordisInspect: true }` 的 realm 组:shim 把 `register` 转发给宿主 registry、仅容忍预期的 `already registered` 错误,`list` / `query` 完全代理——因此无论挂载顺序如何,两个预设都能在同一进程内正常共存。

## 版本兼容性

当前版本同步自 **DSH 0.1.5-rc.2** 的 shipped `cordis` 预设,已包含该版本的组合变更:

- `persona` 行改用 `prefix`(必填)+ `suffix`;0.1.0 的 `text` 字段已移除,旧写法会直接导致挂载失败(`invalid config: $.prefix missing required value`);
- 新增 `command-goal`(`/goal` 命令)与 `present`(`present` 工具)两行;
- `tool-subagent`(spawn)新增 `modelSelectionSettings: true`;Codex / Claude Code 两行由 `enableRunInBackground: false` 改为 `backgroundMode: one-shot`;
- `tool-web` 由 `fetch: false` 改为 `fetch: true`;
- 技能 `editing-cordis-compositions` 同步至新版文本(`cordis-plugin-development` 无变化)。

DSH 升级后建议对照新版 shipped `cordis` 预设重新同步组合行:各行的配置 schema 会随版本变化,过期的旧字段会导致预设整体挂载失败(进而使会话创建 / resume 报错)。同步时保留 `cordis-tools` 组与 `plugins/cordis-inspect-shim.mjs` 即可维持与 `cordis` 预设的共存能力。

## 注意事项

- 依赖宿主平面的 `dynamicCordisRunner` / `cordisInspect` 服务(随 DSH web 部署自带);在不提供 host runner 的部署里,`tool-cordis` 相关行会处于等待状态。
- 组合中的相对路径(`./plugins/...`)从预设目录解析,因此整个仓库目录可整体迁移;裸包名(`@deepseek-ai/*`)从宿主安装解析。
- 技能文本源自 DSH 随附的 `cordis` 预设,随本仓库分发以便预设自包含。
- 预设目录同时就是仓库根目录,`git clone` 后即可直接使用。

## License

[MIT](./LICENSE)
