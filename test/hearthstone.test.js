// tests that show how to actually parse some raw-proto

import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { readFile } from 'fs/promises'
import { getTree, getPath, readString } from '../src/reader.js'

// build an initial array of the data I want to look at
const pb = await readFile(join(dirname(fileURLToPath(import.meta.url)), 'hearthstone.bin'))
const raw = getTree(pb)

test('Get id with getPath', () => {
  expect(getPath(raw, pb, '1.2.4.1:string')).toEqual('com.blizzard.wtcg.hearthstone')
})

test('Get title with getPath', () => {
  expect(getPath(raw, pb, '1.2.4.5:string')).toEqual('Hearthstone')
})

test('Get bytes of a sub-message with getPath', () => {
  expect(getPath(raw, pb, '1.2.4:bytes').length).toEqual(15241)
})

test('Get raw sub-message, including meta, with getPath', () => {
  const d = getPath(raw, pb, '1.2.4:raw')
  expect(d.fieldNumber).toEqual(4)
  expect(d.dataByteLength).toEqual(15243)
  expect(d.sub.length).toEqual(42)
})