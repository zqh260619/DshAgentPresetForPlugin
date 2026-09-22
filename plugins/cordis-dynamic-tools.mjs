// Dynamic Cordis Plugin tools, restored on top of the host runner.
//
// DSH 0.1.6-alpha.2 removed the five model-facing tools that used to expose
// `dynamicCordisRunner` from `@deepseek-ai/dsh-tool-cordis` (which now serves
// only the read-only `cordis_inspect_list` / `cordis_inspect_query` pair). The
// host composition still mounts `@deepseek-ai/dsh-cordis-host-runner` and still
// provides `dynamicCordisRunner` with the same define/run/stop/undefine and
// inspection surface, so this plugin re-registers that model-facing half.
//
// Ported from @deepseek-ai/dsh-tool-cordis 0.1.0-rc.6, minus the custom call
// cards and the `@pluginId` context injection. TRUST: `cordis_define` records
// model-written JavaScript and `cordis_run` evaluates it against the live
// runtime — treat a session on this preset as shell access.
//
// This file is deliberately dependency-free: a plugin loaded from a preset or
// workspace directory resolves its own bare imports by walking up from its real
// path, which never reaches the harness's node_modules. Hence raw JSON Schemas
// instead of `defineTool`, and plain strings instead of the ID brand helpers
// (`CordisDynamicPluginId` is the identity function).
export const name = 'cordis-dynamic-tools'

export const inject = ['dynamicCordisRunner', 'tools', 'systemPrompt']

const SECTION = [
  'Dynamic Cordis Plugins extend THIS running process from the current session.',
  '',
  'They complement the persistent-bundle path (`plugin_manager`): use a dynamic Plugin to try an API, prototype a Host or Client behavior, or verify a fix immediately; use a workspace Bundle when the capability must survive restart and cover every session of the profile.',
  '',
  '- Query `cordis_inspect_list` and `cordis_inspect_query` for the exact Service, Event, Builtin, Slot, Theme, and Tool contracts before writing code. Never infer an API from a name.',
  '- `cordis_define` records an immutable Package: `plugin.kind: "new"` with a 3-6 letter `idPrefix`, or `kind: "existing"` with the exact `pluginId` to append a version without overwriting older ones. Supply at least one of `code.host` and `code.client`, each a plain JavaScript function body returning a Cordis Plugin — no TypeScript, JSX, or import transformation. Define only validates and records: it does not run, request approval, or change version pointers.',
  '- `cordis_run` activates one exact Package. Use `mode: "run"` for a first activation, a restart, or a rollback, and `mode: "update"` to switch current to a different Package. A Client Package needs approval: the result may be `awaiting-approval` or `starting`, and the final outcome arrives through state and steering, never inside the Tool.',
  '- `cordis_inspect_self` lists the Plugins of this session, one Plugin\u2019s version pointers and Packages, or one exact Package\u2019s source and diagnostics. After a technical failure, read diagnostics with it, correct the SAME Plugin, and retry autonomously.',
  '- `cordis_stop` disables a Plugin while retaining every Package; `cordis_undefine` removes it permanently.',
  '',
  'Dynamic Plugins are process-local and vanish on restart. Never report a capability as delivered before observing its effect.',
].join('\n')

/** Build one registry-ready tool definition without importing the harness helpers. */
function define(name, description, parameters, render, execute) {
  return {
    name,
    description,
    parameters,
    output: { schema: { type: 'object' }, render },
    execute,
  }
}

export function apply(ctx) {
  ctx.systemPrompt.section({ name: 'tool:cordis-dynamic', order: 115, text: SECTION })

  ctx.tools.register(define(
    'cordis_inspect_self',
    'Inspect dynamic Cordis objects owned by the current Session at increasing levels of detail. With no IDs, list only Plugin summaries. With pluginId alone, return version pointers, the latest Run, and every Package summary. Only pluginId plus packageId returns that immutable Package\'s Host/Client source and runtime diagnostics. packageId cannot be supplied alone. Query an exact Package before repairing an asynchronous failure or defining an updated version. This Tool is read-only: it neither executes code nor changes version pointers.',
    {
      type: 'object',
      properties: {
        pluginId: {
          type: 'string',
          description: 'Stable Plugin ID returned by cordis_define; omit it to list every current Plugin.',
        },
        packageId: {
          type: 'string',
          description: 'Exact immutable Package ID owned by pluginId; when specified, source and diagnostics are returned.',
        },
      },
    },
    (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    (args, exec) => {
      const agent = requireAgent(exec)
      if (args.packageId !== undefined && args.pluginId === undefined) throw new Error('cordis_inspect_self packageId requires pluginId')
      if (args.pluginId === undefined) {
        return Promise.resolve({
          mode: 'plugins',
          plugins: ctx.dynamicCordisRunner.listPlugins(agent).map((reference) => selfSummary(reference)),
        })
      }
      if (args.packageId === undefined) {
        const plugin = ctx.dynamicCordisRunner.inspectPlugin(agent, args.pluginId)
        return Promise.resolve({
          mode: 'plugin',
          ...selfSummary(plugin),
          packages: plugin.packages.map((pkg) => ({
            ...pkg,
            packageId: String(pkg.packageId),
            isCurrent: pkg.packageId === plugin.currentPackageId,
            isNext: pkg.packageId === plugin.nextPackageId,
          })),
        })
      }
      return Promise.resolve(inspectSelfPackage(ctx, agent, args.pluginId, args.packageId))
    },
  ))

  ctx.tools.register(define(
    'cordis_define',
    'Define an immutable Cordis Package. For a new Plugin, use kind:"new" and provide only a semantic prefix of 3-6 lowercase English letters; the Host returns the final pluginId and packageId. To modify an existing Plugin, use kind:"existing" with its exact pluginId to append a Package without overwriting older versions. Provide at least one of code.host and code.client. Each value is a plain JavaScript function body that returns a Cordis Plugin; no TypeScript, JSX, or import transformation occurs. Query Inspect before depending on a Service, Event, Builtin, Slot, or token. Define only validates parameters and syntax and records source: it does not request approval, execute apply, or change currentPackageId. On success, call cordis_run with the returned IDs.',
    {
      type: 'object',
      properties: {
        plugin: {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: { type: 'string', const: 'new' },
                idPrefix: {
                  type: 'string',
                  description: 'Suggested semantic prefix of 3-6 lowercase English letters; the Host adds a unique numeric suffix.',
                },
              },
              required: ['kind', 'idPrefix'],
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: { type: 'string', const: 'existing' },
                pluginId: {
                  type: 'string',
                  description: 'Exact ID of an existing Plugin; the new Package is appended to that instance.',
                },
              },
              required: ['kind', 'pluginId'],
            },
          ],
        },
        name: { type: 'string', description: 'Short, readable Package name.' },
        purpose: { type: 'string', description: 'One-sentence, user-facing description of the Package purpose.' },
        code: {
          type: 'object',
          additionalProperties: false,
          properties: {
            host: { type: 'string', description: 'Plain JavaScript function body that returns the Host-half Cordis Plugin.' },
            client: { type: 'string', description: 'Plain JavaScript function body that returns the browser Client-half Cordis Plugin.' },
          },
        },
      },
      required: ['plugin', 'name', 'purpose', 'code'],
    },
    (_args, value) => [{
      type: 'text',
      text: `Defined ${value.pluginId}/${value.packageId} (${value.name}); it is not running yet. Use cordis_run to activate this Package.`,
    }],
    (args, exec) => {
      const plugin = args.plugin.kind === 'new'
        ? { kind: 'new', idPrefix: args.plugin.idPrefix }
        : { kind: 'existing', pluginId: args.plugin.pluginId }
      const receipt = ctx.dynamicCordisRunner.define({
        sessionId: requireAgent(exec).id,
        plugin,
        name: args.name,
        purpose: args.purpose,
        code: {
          ...args.code.host === undefined ? {} : { host: args.code.host },
          ...args.code.client === undefined ? {} : { client: args.code.client },
        },
      })
      return Promise.resolve({
        ...receipt,
        pluginId: String(receipt.pluginId),
        packageId: String(receipt.packageId),
      })
    },
  ))

  ctx.tools.register(define(
    'cordis_run',
    'Activate one exact Package of a dynamic Plugin. Use mode:"run" for the first activation, restarting currentPackageId, or rollback. When current exists, use mode:"update" to switch to a different Package, even if the Plugin is currently stopped. An unauthorized Client Package creates an approval request and returns awaiting-approval; an authorized Package returns starting and continues asynchronously in the browser. Neither result waits for the final outcome inside the Tool. currentPackageId changes only after complete success; on failure, the old current and target next remain. Asynchronous success, rejection, or technical failure is reported through state and steering. After a technical failure, read diagnostics with cordis_inspect_self, correct the same Plugin, and retry autonomously. Do not request approval again after the user rejects it.',
    {
      type: 'object',
      properties: {
        pluginId: { type: 'string', description: 'Stable Plugin ID returned by cordis_define.' },
        packageId: { type: 'string', description: 'Exact immutable Package ID to activate under that Plugin.' },
        mode: {
          type: 'string',
          enum: ['run', 'update'],
          description: 'Use run for the first activation, restarting current, or rollback; use update to switch from current to a different Package.',
        },
      },
      required: ['pluginId', 'packageId', 'mode'],
    },
    (_args, value) => {
      const status = value === null || typeof value !== 'object' ? undefined : value.status
      const where = `${String(value?.pluginId)}/${String(value?.packageId)}`
      return [{
        type: 'text',
        text: status === 'awaiting-approval'
          ? `${where} is awaiting user approval (${String(value.pluginRunId)}).`
          : status === 'starting'
            ? `${where} is starting asynchronously (${String(value.pluginRunId)}).`
            : `${where} is running (${String(value.pluginRunId)}).`,
      }]
    },
    async (args, exec) => {
      const agent = requireAgent(exec)
      const receipt = await ctx.dynamicCordisRunner.run(agent, args.pluginId, args.packageId, args.mode, exec.signal)
      if (!receipt.ok) throw new Error(receipt.message)
      if (receipt.status !== 'running') {
        return {
          status: receipt.status,
          pluginId: args.pluginId,
          packageId: args.packageId,
          pluginRunId: String(receipt.pluginRunId),
          mode: receipt.mode,
          ...receipt.currentPackageId === undefined ? {} : { currentPackageId: String(receipt.currentPackageId) },
          nextPackageId: String(receipt.nextPackageId),
        }
      }
      const row = ctx.dynamicCordisRunner.snapshot(agent).find((candidate) => candidate.pluginId === args.pluginId)
      const fiber = row?.activeRun?.pluginRunId === receipt.pluginRunId ? row.activeRun.fiber : undefined
      return {
        status: 'running',
        pluginId: args.pluginId,
        packageId: args.packageId,
        pluginRunId: String(receipt.pluginRunId),
        currentPackageId: String(receipt.currentPackageId),
        ...receipt.nextPackageId === undefined ? {} : { nextPackageId: String(receipt.nextPackageId) },
        host: {
          status: fiber === undefined ? 'absent' : missingServices(ctx, fiber).length === 0 ? 'running' : 'waiting',
          provides: fiber === undefined ? [] : providedServices(ctx, fiber),
          waitingFor: fiber === undefined ? [] : missingServices(ctx, fiber),
        },
        client: {
          status: receipt.clientWaitingFor === undefined ? 'absent' : receipt.clientWaitingFor.length === 0 ? 'running' : 'waiting',
          waitingFor: [...receipt.clientWaitingFor ?? []],
        },
      }
    },
  ))

  ctx.tools.register(define(
    'cordis_stop',
    'Stop the current Run of a dynamic Plugin and cancel unfinished approval or activation requests. Retain the Plugin, every immutable Package, grants, currentPackageId, and nextPackageId so it can later run or update directly. Stopping an already stopped Plugin succeeds idempotently. Use this Tool to disable effects temporarily; use cordis_undefine for permanent removal.',
    {
      type: 'object',
      properties: {
        pluginId: { type: 'string', description: 'Stable dynamic Plugin ID to stop.' },
      },
      required: ['pluginId'],
    },
    (_args, value) => [{
      type: 'text',
      text: `Dynamic Plugin ${String(value?.pluginId)} is stopped; its definition and versions remain.`,
    }],
    async (args, exec) => {
      const receipt = await ctx.dynamicCordisRunner.stop(requireAgent(exec), args.pluginId)
      if (!receipt.ok && receipt.reason !== 'not-running') throw new Error(receipt.message)
      return { pluginId: args.pluginId }
    },
  ))

  ctx.tools.register(define(
    'cordis_undefine',
    'Permanently remove a dynamic Plugin owned by the current Session. If it is running or awaiting approval, first stop it and cancel the request, then delete every Package, grant, and version pointer. After this returns, its pluginId, packageIds, and Package business views are invalid. Do not call this Tool when versions must remain available for restart or rollback; use cordis_stop instead.',
    {
      type: 'object',
      properties: {
        pluginId: { type: 'string', description: 'Stable dynamic Plugin ID to remove permanently.' },
      },
      required: ['pluginId'],
    },
    (_args, value) => [{
      type: 'text',
      text: `Removed dynamic Plugin ${String(value?.pluginId)} and all of its Packages.`,
    }],
    async (args, exec) => {
      const receipt = await ctx.dynamicCordisRunner.undefine(requireAgent(exec), args.pluginId)
      if (!receipt.ok) throw new Error(receipt.message)
      return { pluginId: args.pluginId, wasRunning: receipt.wasRunning }
    },
  ))
}

function requireAgent(exec) {
  if (exec.agent === undefined) throw new Error('Cordis dynamic tools require an Agent-backed session')
  return exec.agent
}

/** The live service registrations, read from the reflect store. */
function liveImpls(ctx) {
  const store = ctx.reflect.store
  return Object.getOwnPropertySymbols(store).map((key) => store[key]).filter((impl) => impl !== undefined)
}

/** Whether a fiber is `root` itself or is mounted anywhere inside its subtree. */
function withinFiber(fiber, root) {
  let current = fiber
  while (true) {
    if (current === root) return true
    const parent = current.parent.fiber
    if (parent === current) return false
    current = parent
  }
}

/** Service names provided by one mount's fiber subtree. */
function providedServices(ctx, fiber) {
  return liveImpls(ctx).filter((impl) => withinFiber(impl.fiber, fiber)).map((impl) => impl.name).sort()
}

/** Services a fiber declared in `inject` that do not exist yet. */
function missingServices(ctx, fiber) {
  return Object.keys(fiber.inject).filter((service) => ctx.get(service) === undefined)
}

function selfSummary(reference) {
  const latest = reference.latestRun
  return {
    pluginId: String(reference.pluginId),
    name: reference.name,
    packageCount: reference.packages?.length ?? 1,
    state: selfState(reference),
    ...reference.currentPackageId === undefined ? {} : { currentPackageId: String(reference.currentPackageId) },
    ...reference.nextPackageId === undefined ? {} : { nextPackageId: String(reference.nextPackageId) },
    ...reference.activeRun === undefined ? {} : {
      activeRun: {
        pluginRunId: String(reference.activeRun.pluginRunId),
        packageId: String(reference.activeRun.packageId),
      },
    },
    ...latest?.status !== 'awaiting-approval' ? {} : {
      pendingApproval: {
        pluginRunId: String(latest.pluginRunId),
        packageId: String(latest.packageId),
        mode: latest.mode,
      },
    },
  }
}

function selfState(reference) {
  const status = reference.latestRun?.status
  if (status === 'awaiting-approval') return 'awaiting-approval'
  if (status === 'client-pending' || status === 'starting-host') return 'client-pending'
  if (status === 'failed' || status === 'rejected' || status === 'cancelled') return 'failed'
  if (status === 'waiting') return 'waiting'
  if (status === 'running') return 'running'
  if (reference.activeRun !== undefined) return 'running'
  return reference.currentPackageId === undefined ? 'defined' : 'stopped'
}

function inspectSelfPackage(ctx, agent, pluginId, packageId) {
  const inspected = ctx.dynamicCordisRunner.inspectPackage(agent, pluginId, packageId)
  const row = ctx.dynamicCordisRunner.snapshot(agent).find((candidate) => candidate.pluginId === pluginId)
  const pkg = row?.packages.find((candidate) => candidate.packageId === packageId)
  const active = row?.activeRun?.packageId === packageId ? row.activeRun : undefined
  const latest = inspected.latestRun?.packageId === packageId ? inspected.latestRun : undefined
  const hostWaiting = active?.fiber === undefined ? [...latest?.host.waitingFor ?? []] : missingServices(ctx, active.fiber)
  const hostStatus = pkg?.hasHostHalf !== true
    ? 'absent'
    : latest?.host.status ?? (active === undefined ? 'stopped' : hostWaiting.length === 0 ? 'running' : 'waiting')
  const clientStatus = pkg?.hasClientHalf !== true ? 'absent' : latest?.client.status ?? 'stopped'
  return {
    mode: 'package',
    plugin: selfSummary(inspected),
    packageId: String(packageId),
    name: inspected.name,
    purpose: inspected.purpose,
    code: inspected.code,
    runtime: {
      state: selfState(inspected),
      host: {
        status: hostStatus,
        provides: active?.fiber === undefined ? [] : providedServices(ctx, active.fiber),
        waitingFor: hostWaiting,
        handlers: active?.handlers ?? [],
        ...latest?.host.error === undefined ? {} : { error: latest.host.error },
      },
      client: {
        status: clientStatus,
        waitingFor: [...latest?.client.waitingFor ?? []],
        ...latest?.client.error === undefined ? {} : { error: latest.client.error },
        ...active?.renderFailure === undefined ? {} : { renderFailure: active.renderFailure },
      },
    },
  }
}
