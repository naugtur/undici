'use strict'

const { test } = require('tap')
const { Client } = require('..')
const { createServer } = require('http')
const { kConnect } = require('../lib/symbols')

test('pipeline pipelining', (t) => {
  t.plan(6)

  const server = createServer((req, res) => {
    t.strictDeepEqual(req.headers['transfer-encoding'], undefined)
    res.end()
  })

  t.teardown(server.close.bind(server))
  server.listen(0, () => {
    const client = new Client(`http://localhost:${server.address().port}`, {
      pipelining: 2
    })
    t.teardown(client.close.bind(client))

    client.on('disconnect', () => {
      t.fail()
    })

    client[kConnect](() => {
      t.strictEqual(client.running, 0)
      client.pipeline({
        method: 'GET',
        path: '/'
      }, ({ body }) => body).end().resume()
      t.strictEqual(client.busy, false)
      client.pipeline({
        method: 'GET',
        path: '/'
      }, ({ body }) => body).end().resume()
      t.strictEqual(client.busy, true)
      t.strictEqual(client.running, 2)
    })
  })
})

test('pipeline pipelining retry', (t) => {
  t.plan(6)

  let count = 0
  const server = createServer((req, res) => {
    if (count++ === 0) {
      res.destroy()
    } else {
      res.end()
    }
  })

  t.teardown(server.close.bind(server))
  server.listen(0, () => {
    const client = new Client(`http://localhost:${server.address().port}`, {
      pipelining: 3
    })
    t.teardown(client.destroy.bind(client))

    client.once('disconnect', () => {
      t.pass()
      client.on('disconnect', () => {
        t.fail()
      })
    })

    client[kConnect](() => {
      client.pipeline({
        method: 'GET',
        path: '/'
      }, ({ body }) => body)
        .on('error', (err) => {
          t.ok(err)
        })
        .end()
        .resume()
      t.strictDeepEqual(client.running, 1)

      client.pipeline({
        method: 'GET',
        path: '/'
      }, ({ body }) => body).end().resume()
      t.strictDeepEqual(client.running, 2)

      client.pipeline({
        method: 'GET',
        path: '/'
      }, ({ body }) => body).end().resume()
      t.strictDeepEqual(client.running, 3)

      client.close(() => {
        t.pass()
      })
    })
  })
})
