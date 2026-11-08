// `/publish` — a human-facing slash command that hands the agent the release
// checklist this profile actually uses.
//
// Why a plugin row rather than a preset child row: preset child rows resolve
// from the harness install, which cannot see this bundle, while profile-level
// rows resolve from the installing profile. The cost is that the command shows
// up in every session of the profile; the benefit is that it needs no code
// inside the DSH deployment.
//
// Dependency-free on purpose: this file lives outside the harness tree, so it
// must not import any `@deepseek-ai/*` package. The injected user message is the
// same shape `createUserMessage()` produces (a frozen-ish plain object with a
// fresh id, `role: 'user'` and `source.kind: 'user'`).

import { randomUUID } from 'node:crypto'

export const name = 'command-publish'
export const inject = ['commands']

const USAGE = '[patch|minor|major|<x.y.z>] [发布说明]'

function buildPrompt(rawInput) {
  const request = rawInput.trim()
  const versionLine = request.length > 0
    ? `用户在调用时给出的参数是:\`${request}\`。按它决定版本(语义化版本号或 patch/minor/major);它若是发布说明而不是版本号,则据此判断版本并把说明写进 CHANGELOG。`
    : '用户没有给出版本参数:读 package.json 当前版本、CHANGELOG 未发布段落与自上个 tag 以来的提交,自行判断该升 patch / minor / major,并在动手前用一句话说明判断依据。**major 必须先经用户确认。**'

  return `# 发版任务(由 /publish 指令触发)

${versionLine}

按下面的顺序执行,每一步都用真实命令验证,不要凭印象跳过:

## 1. 前置检查
- 工作树状态(\`git status --short\`):若有不属于本次发版的改动,先问用户,不要顺手打包。
- 跑仓库既有的测试与校验(\`npm test\`、\`npm run verify\`、\`node --check\` 等,按 package.json scripts 决定)。测试不通过就停下报告,不要发版。

## 2. 版本与文档同步
- \`package.json\` 的 \`version\`;
- 有 \`package-lock.json\` 时,同步 \`version\` 与 \`packages[""].version\` 两处(这是最容易漏的地方);
- 代码里硬编码的构建标记 / 版本号(如 \`BUILD_MARK\`、设置页显示的「构建 x.y.z」);
- \`CHANGELOG.md\`:新增 \`## [x.y.z] - YYYY-MM-DD\` 段落,按 Added / Changed / Fixed 分类;
- README 里出现版本号、测试数量等事实性数字,一并核对更新(只改事实,不夸大)。
- 校验:版本号在 package.json / lock / 代码里一致;文件为无 BOM 的 UTF-8。

## 3. 提交与推送
- \`git add -A\` + \`git commit -m "chore(release): x.y.z"\`(与仓库既有风格保持一致);
- 推送 main。网络抖动时用重试循环(例如最多 40 次、每次间隔数秒),不要 force push。

## 4. 打 tag 并发布
- \`git tag vx.y.z\`,再推送该 tag(同样带重试);
- 若仓库有发布工作流(\`.github/workflows/publish.yml\` 或 npm publish 脚本):轮询该次 Actions run 直到 \`completed\`,再用 \`npm view <包名> version\` 确认 npm 上确实出现了新版本;
- 发布失败时**不要**用同一版本号重复打 tag:先确认线上到底有没有发出去,再决定补发还是升版本。

## 5. 让本机生效并验证
- 仓库是 **bundle**(\`package.json\` 里有 \`dsh.bundle\`):用 \`plugin_manager\` 对该 bundle 关再开(\`set_bundle\` off → on),确认 \`application: applied\` 且无 warnings;预设行保持 active。
- 仓库是 **npm 插件**:把 \`web\` 与 \`desktop\` 两个 profile 的依赖与安装更新到新版本(\`dsh plugin --profile <名字> add <包名>@<版本>\`),再确认两份安装目录里的版本一致。
- 最后报告:版本号、tag 是否推送成功、npm 上的版本(如适用)、本地 profile 生效情况,并说明还差什么人工确认。

## 纪律
- 不改与发版无关的文件;不做未经请求的重构;
- 任何一步失败都如实报告(退出码、报错原文),不要静默跳过或改用更弱的检查;
- 发版过程中不要关闭或重启用户的浏览器/GUI,除非该步骤确实需要。`
}

export function apply(ctx) {
  ctx.commands.register({
    definitionId: 'dsh-agent-preset-for-plugin/command-publish',
    name: 'publish',
    description: '发布新版本:测试 → 版本号/CHANGELOG → 提交推送 → tag → 发布 → 本地生效验证',
    input: { hint: USAGE },
    handler: (invocation) => {
      const prompt = buildPrompt(invocation.rawInput ?? '')
      invocation.agent.followup({
        id: randomUUID(),
        role: 'user',
        content: [{ type: 'text', text: prompt }],
        source: { kind: 'user' },
      })
      const request = (invocation.rawInput ?? '').trim()
      return {
        kind: 'success',
        text: request.length > 0
          ? `已交给 agent 执行发版流程(参数:${request})`
          : '已交给 agent 执行发版流程(版本号由 agent 判断,升 major 前会先问你)',
      }
    },
  })
}
