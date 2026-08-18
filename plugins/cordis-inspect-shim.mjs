// Dedupe-tolerant `cordisInspect` shim for presets that carry `tool-cordis`.
//
// `tool-cordis` registers first-party Inspect providers (Service, Event,
// Builtin, Tool) into the host's process-global registry, and that registry
// throws when a provider id already exists. When the shipped `cordis` preset
// already stands in the same process, that throw kills this preset's mount
// and every session on it fails to resume. This shim is provided behind an
// `isolate` realm (see agent.cordis.yml) and forwards every call to the host
// registry, tolerating only the expected duplicate-registration error.
export default {
  name: 'cordis-inspect-shim',
  inject: ['dynamicCordisRunner'],
  apply(ctx) {
    const runner = ctx.dynamicCordisRunner
    const host = runner === undefined || runner === null ? undefined : runner.inspectRegistry
    if (host === undefined) {
      throw new Error('cordis-inspect-shim: dynamicCordisRunner.inspectRegistry is unavailable')
    }
    ctx.provide('cordisInspect', {
      register(registration) {
        try {
          return host.register(registration)
        } catch (error) {
          if (error instanceof Error && /already registered/.test(error.message)) {
            return () => {}
          }
          throw error
        }
      },
      list() {
        return host.list()
      },
      query(...args) {
        return host.query(...args)
      },
    })
  },
}