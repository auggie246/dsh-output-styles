import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

test('Settings waits for the remote bridge before its first load', async () => {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  let definition
  let bridgeEffect
  let loadEffect
  let pageRenderer
  let remoteTarget
  let mountedContribution
  let getCalls = 0
  const loadErrors = []
  let hookIndex = 0

  const React = {
    createElement(type, props, ...children) {
      return { type, props, children }
    },
    useState(initial) {
      const index = hookIndex++
      return [initial, (value) => {
        if (index === 1) loadErrors.push(value)
      }]
    },
    useEffect(callback) {
      loadEffect = callback
    },
  }

  vm.runInNewContext(source, {
    window: {
      __ModuleLoader__: {
        load(value) {
          definition = value
        },
      },
    },
    console,
    Promise,
    setTimeout,
    clearTimeout,
  })

  const plugin = definition.factory((name) => {
    if (name === 'react') return React
    throw new Error(`unexpected browser dependency: ${name}`)
  })

  const ctx = {
    get(name) {
      if (name === 'remote.outputStyles') return remoteTarget
      return undefined
    },
    effect(callback) {
      bridgeEffect = callback
    },
    remote: {
      async $mount(contribution) {
        mountedContribution = contribution
        remoteTarget = {
          get() {
            getCalls += 1
            return Promise.resolve({
              ok: true,
              value: { selectedId: 'default', presets: [], userStyles: [] },
            })
          },
        }
        return async () => {}
      },
    },
    slots: {
      inject(_name, callback) {
        callback()
      },
      register(_descriptor, renderer) {
        pageRenderer = renderer
      },
    },
  }

  plugin.apply(ctx)
  const page = pageRenderer()
  hookIndex = 0
  page.type()

  loadEffect()
  await Promise.resolve()
  await Promise.resolve()

  assert.deepEqual(loadErrors, [], 'the initial load must not fail while the bridge mounts')
  assert.equal(getCalls, 0)

  await bridgeEffect()
  await Promise.resolve()
  await Promise.resolve()

  assert.deepEqual(loadErrors, [])
  assert.equal(getCalls, 1)
  assert.equal(mountedContribution.descriptors.some((descriptor) => descriptor.method === 'remove'), false)
  assert.equal(mountedContribution.descriptors.some((descriptor) => descriptor.method === 'deleteStyle'), true)
})
