---
name: browser-verification
description: Use when a change must be verified visually or structurally in the running Harness Web UI, or when screenshots have to be produced — driving the browser through the preset's Playwright MCP tools (navigate, snapshot, screenshot) instead of asserting styles statically.
---

# Browser verification

本预设通过 MCP 客户端挂载了 **Playwright MCP**(`@playwright/mcp@0.0.80`),因此会话里可以直接驱动浏览器。工具名以 `mcp__playwright__` 为前缀,常用:

| 工具 | 用途 |
|---|---|
| `mcp__playwright__browser_navigate` | 打开 URL |
| `mcp__playwright__browser_snapshot` | 取无障碍树快照(结构、文本、可交互元素)——**判断结构与文案首选,比截图省 token** |
| `mcp__playwright__browser_take_screenshot` | 截图(`filename`、`fullPage`、`scale: device` 出高分辨率图) |
| `mcp__playwright__browser_click` / `browser_type` / `browser_press_key` / `browser_select_form` | 交互 |
| `mcp__playwright__browser_tabs` / `browser_resize` / `browser_wait_for` | 标签页、视口、等待 |

## 标准流程

1. `browser_navigate` 打开目标页面(本机 GUI 为 `http://127.0.0.1:3080`)。
2. `browser_snapshot` 断言结构:目标 Slot/文案/属性是否真的出现。这一步替代"静态断言 CSS 字号与 DOM 结构"。
3. `browser_take_screenshot` —— **传 `filename`,优先绝对路径**。相对名以 MCP server 的 **cwd** 为基准(MCP 的 `--output-dir` 只影响 server 自己命名的快照与日志);本预设已把该 cwd 固定为 `$DSH_HOME/cache/browser-shots`,所以相对名会落在那里,而不是 harness 进程目录。需要进仓库时再复制过去,并清理临时产物。
4. `read_image` 读回该 PNG 确认渲染结果(不要指望截图自动以内联图片进入上下文)。
5. 明暗主题、排版一致性:用 `browser_resize` 换视口分别截图对比。

## 打开本机 GUI 需要认证(重要)

DSH 的 GUI 用**启动令牌兑换签名 Cookie**保护(`dsh-client-connection`):没有 Cookie 时根文档直接返回 **401 Unauthorized**。所以:

- 匿名浏览器**打不开** `http://127.0.0.1:3080`,这不是权限或配置错误;
- 认证只需**一次**:让带启动令牌的 URL 在该浏览器里访问一次,就会种下 Cookie(默认 30 天有效),之后复用;
- 本预设的浏览器使用**专用持久 profile**(`$DSH_HOME/cache/browser-profile`),因此这一次认证会在后续会话中保留;需要重置时删掉该目录即可。

获得该 URL 的方式:

1. **推荐**:请用户把它提供给你 —— `dsh web` 启动时打印的那一行 URL(也可在用户自己浏览器的历史记录里找到带令牌的那次访问)。拿到后 `browser_navigate` 一次,随后正常截图。
2. **接入用户已登录的浏览器**:让用户以 `chrome.exe --remote-debugging-port=9222 --user-data-dir=<独立目录>` 启动 Chrome,并在其中访问 GUI;再把预设里该行的参数改为 `--cdp-endpoint http://127.0.0.1:9222`(改完需重新应用 bundle,只对之后创建的会话生效)。
3. 若两者都拿不到,就不要绕:`不要`去翻凭据库、Cookie 库、浏览器配置或历史记录里搜令牌,也不要为此临时用 shell 起浏览器。此时按静态方式验证并如实说明视觉验证不可用。

其他地址(GitHub 之外的公开页面、你自己的本地 dev server 等)不需要认证,可以直接截图。

## 其他注意事项

- 截图**不是**验证:对 mock 页面或静态 HTML 截图不算插件已可用;截图只用于确认真实运行页面。
- 同一预设版本的多个会话**共享同一个浏览器实例**(每版预设只挂一个 MCP 客户端)。用完请 `browser_tabs` 关掉自己开的标签页,别留下影响其他会话的页面状态。
- 工具列表里**没有** `mcp__playwright__*`,说明 MCP server 没起来(缺网络、`npx` 不可用、Chrome 缺失等)。会话本身不受影响,按静态方式验证并说明,不要用 shell 临时起浏览器替代。
- 视觉能力依赖当前模型路由接受图片输入;不支持时退化为 `browser_snapshot` 文本断言。
