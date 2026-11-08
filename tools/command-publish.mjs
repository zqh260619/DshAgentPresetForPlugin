// `/publish` — a human-facing slash command that starts the release workflow.
//
// Why a plugin row rather than a preset child row: preset child rows resolve
// package names from the harness install, which cannot see this bundle, while
// profile-level rows resolve them from the installing profile.
//
// The injected message stays SHORT on purpose: it is a durable user message that
// stays in the transcript and is re-sent to the model every turn, so the full
// procedure lives in the `plugin-release` skill and is loaded on demand.
//
// Dependency-free on purpose: this file lives outside the harness tree, so it
// must not import any `@deepseek-ai/*` package. The injected user message is the
// same shape `createUserMessage()` produces (fresh id, `role: 'user'`,
// `source.kind: 'user'`).

import { randomUUID } from 'node:crypto'

export const name = 'command-publish'
export const inject = ['commands']

const USAGE = '[patch|minor|major|<x.y.z>] [发布说明]'

function buildPrompt(rawInput) {
  const request = rawInput.trim()
  const versionLine = request.length > 0
    ? `版本参数:\`${request}\``
    : '未给版本参数:自行判断补丁 / 小版本 / 大版本(major 必须先问我确认)'
  return [
    '发版任务(由 /publish 触发):按 `plugin-release` 技能执行发版。',
    `- ${versionLine}`,
    '- 结束时报告:版本号、tag、发布结果(如适用)、本地是否生效',
    '- 技能不可用时:按 package.json + CHANGELOG 的常规发版流程执行,不要跳测试',
  ].join('\n')
}

export function apply(ctx) {
  ctx.commands.register({
    definitionId: 'dsh-agent-preset-for-plugin/command-publish',
    name: 'publish',
    description: '发布新版本(流程见 plugin-release 技能)',
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
          ? `已开始发版(参数:${request}),流程见 plugin-release 技能`
          : '已开始发版(版本由 agent 判断,major 前会先问你)',
      }
    },
  })
}
