// Host half of the `/publish` client command.
//
// The web client collects a package's `dsh.client` artifact only for packages
// that are part of the composition, so this (intentionally empty) module exists
// to give the bundle a host row. All behavior lives in `lib/client.js`.
//
// Dependency-free on purpose: this file lives outside the harness tree, so it
// must not import any `@deepseek-ai/*` package.
export function apply() {}
