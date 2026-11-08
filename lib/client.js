// `/publish` as a CLIENT command: only a client contribution carries a menu face
// (localized label + icon); a host command can only show its name and description.
//
// Browser artifact shape follows the harness client-module contract (see the
// vendor `cordis-plugin-development` template `templates/decoration/client.js`):
// `window.__ModuleLoader__.load({ id, factory(require) })`, with React supplied by
// the browser module table. No bundler is involved.
//
// The row sends a SHORT prompt; the full procedure lives in the `plugin-release`
// skill and loads on demand, so the durable message stays small.
window.__ModuleLoader__.load({
  id: '@local/dsh-agent-preset-for-plugin',
  factory(require) {
    const React = require('react')

    const PROMPT = [
      '发版任务(由 /publish 触发):按 `plugin-release` 技能执行发版。',
      '- 未给版本参数:自行判断补丁 / 小版本 / 大版本(major 必须先问我确认)',
      '- 结束时报告:版本号、tag、发布结果(如适用)、本地是否生效',
      '- 技能不可用时:按 package.json + CHANGELOG 的常规发版流程执行,不要跳测试',
    ].join('\n')

    // Upload / ship glyph, inlined so this artifact needs no icon package.
    function PublishIcon(props) {
      const size = (props && props.size) || 16
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

    return {
      inject: ['commandUi', 'sessions'],
      apply(ctx) {
        ctx.effect(
          () =>
            ctx.commandUi.register({
              name: 'publish',
              label: () => '发布',
              description: () => '发布新版本(流程见 plugin-release 技能)',
              icon: PublishIcon,
              available: () => true,
              ui: {
                kind: 'action',
                run: (session) => {
                  const conversation = ctx.sessions.scope(session.sessionId)?.get('conversation')
                  if (conversation === undefined) return
                  conversation.send(PROMPT)
                },
              },
            }),
          'preset-for-plugin: /publish client command',
        )
      },
    }
  },
})
