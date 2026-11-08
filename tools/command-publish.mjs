// `/publish` — a host slash command that starts the release workflow WITHOUT
// sending a chat message.
//
// Why a goal instead of `agent.followup(userMessage)`: any user message becomes a
// bubble in the transcript and is re-sent to the model every turn, while the UI
// for a command only renders one compact line (the same way `/compact` and
// `/goal` behave). The goal objective reaches the agent through its system prompt
// on the next turn, and the durable history stays clean.
//
// Dependency-free on purpose: this file lives outside the harness tree, so it
// must not import any `@deepseek-ai/*` package.

export const name = 'command-publish'
export const inject = ['commands', 'goals']

function buildObjective(rawInput) {
  const request = rawInput.trim()
  return [
    '发版任务(由 /publish 触发):按 `plugin-release` 技能执行发版。',
    request.length > 0
      ? `- 版本参数:${request}`
      : '- 未给版本参数:自行判断补丁 / 小版本 / 大版本(major 必须先问我确认)',
    '- 结束时报告:版本号、tag、发布结果(如适用)、本地是否生效',
    '- 技能不可用时:按 package.json + CHANGELOG 的常规发版流程执行,不要跳测试',
    '- 全部完成后用 update_goal 把本目标标记为 complete;中途受阻则标记 blocked 并写明原因',
  ].join('\n')
}

export function apply(ctx) {
  ctx.commands.register({
    definitionId: 'dsh-agent-preset-for-plugin/command-publish',
    name: 'publish',
    description: '发布新版本:流程见 plugin-release 技能(设置为会话目标,不占用对话历史)',
    input: { hint: '[patch|minor|major|<x.y.z>] [发布说明]' },
    handler: (invocation) => {
      const current = ctx.goals.get(invocation.agent)
      if (current !== undefined && current.phase !== 'complete') {
        return {
          kind: 'error',
          text: `已有一个进行中的目标(${current.phase});请先完成它或 /goal clear,再发版。`,
        }
      }
      ctx.goals.create(invocation.agent, { objective: buildObjective(invocation.rawInput ?? '') })
      const request = (invocation.rawInput ?? '').trim()
      return {
        kind: 'success',
        text: request.length > 0
          ? `已开始发版(参数:${request});流程见 plugin-release 技能`
          : '已开始发版(版本由 agent 判断,major 前会先问你);流程见 plugin-release 技能',
      }
    },
  })
}
