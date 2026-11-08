// `/publish` as a CLIENT-OWNED slash command: unlike a host command, a client
// contribution carries its own menu face (localized label, description, icon),
// so the row looks exactly like the built-in `/goal`, `/compact`, …
//
// Loaded by the dsh web client as a classic script (same shape as the first-party
// client packages): `require` is provided by the client runtime, and the module
// publishes `name`, `inject` and `apply`.
//
// The row sends the release prompt through the conversation service of the
// picked session, which is the same path the composer itself uses.
var module = { exports: {} }
var exports = module.exports

var React = require('react')

// Short on purpose: the durable user message stays in the transcript, so the
// full procedure lives in the `plugin-release` skill and loads on demand.
var PROMPT = [
  '发版任务(由 /publish 触发):按 `plugin-release` 技能执行发版。',
  '- 未给版本参数:自行判断补丁 / 小版本 / 大版本(major 必须先问我确认)',
  '- 结束时报告:版本号、tag、发布结果(如适用)、本地是否生效',
  '- 技能不可用时:按 package.json + CHANGELOG 的常规发版流程执行,不要跳测试',
].join('\n')

// Upload / ship glyph, drawn inline so this bundle needs no icon package.
function PublishIcon(props) {
  var size = (props && props.size) || 16
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
    React.createElement('path', { d: 'M8 10.5V2.5' }),
    React.createElement('path', { d: 'M5 5.5 8 2.5l3 3' }),
    React.createElement('path', { d: 'M3 11v1.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V11' }),
  )
}

function apply(ctx) {
  ctx.inject(['commandUi', 'sessions'], (scope) => {
    scope.effect(
      () =>
        scope.commandUi.register({
          name: 'publish',
          label: () => '发布',
          description: () => '发布新版本(流程见 plugin-release 技能)',
          icon: PublishIcon,
          available: () => true,
          ui: {
            kind: 'action',
            run: (session) => {
              const conversation = scope.sessions.scope(session.sessionId)?.get('conversation')
              if (conversation === undefined) return
              conversation.send(PROMPT)
            },
          },
        }),
      'preset-for-plugin: /publish client command',
    )
  })
}

exports.name = 'command-publish-client'
exports.inject = ['sessions']
exports.apply = apply
