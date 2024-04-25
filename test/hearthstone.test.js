// tests that show how to actually parse some tree-proto

import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { readFile } from 'fs/promises'
import { getTree, getPath, readString } from '../src/reader.js'

// build an initial array of the data I want to look at
// do this, and you can use getPath() to get values
const pb = await readFile(join(dirname(fileURLToPath(import.meta.url)), 'hearthstone.bin'))
const tree = getTree(pb)

console.log(tree)

test('Should throw an error on wrong getPath', () => {
  expect(() => {
    getPath(tree, '1.2.4.1:var')
  }).toThrowError('Type wireType 2 does not support var. It should be one of these: raw, string, bytes, packedvar, packed32, packed64')
})

test('Get id with getPath', () => {
  expect(getPath(tree, '1.2.4.1:string').pop()).toEqual('com.blizzard.wtcg.hearthstone')
})

test('Get title with getPath', () => {
  expect(getPath(tree, '1.2.4.5:string').pop()).toEqual('Hearthstone')
})

test('Get bytes of a sub-message with getPath', () => {
  expect(getPath(tree, '1.2.4:bytes').pop().length).toEqual(15241)
})

test('Get tree sub-message, including meta, with getPath', () => {
  const d = getPath(tree, '1.2.4:raw').pop()
  expect(d.fieldNumber).toEqual(4)
  expect(d.dataByteLength).toEqual(15243)
  expect(d.sub.length).toEqual(42)
})

test('Get value inside another sub-object', () => {
  const d = getPath(tree, '1.2.4:raw').pop()
  expect(getPath(d, '1:string').pop()).toEqual('com.blizzard.wtcg.hearthstone')
  expect(getPath(d, '5:string').pop()).toEqual('Hearthstone')
})

test.skip('Get a repeated message', () => {
  const urls = getPath(tree, 'TODO:string')
})
