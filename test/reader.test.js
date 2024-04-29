// tests to verify results from hand-parsing:
// https://protobuf.dev/programming-guides/encoding/

// queries are better, but some utils are also exposed, and you can use em, if you want

/* global test expect */

import { getTree, readPackedVarint, readString } from '../src/reader.js'

test('A Simple Message', () => {
  /*
    1: 150
  */
  const tree = getTree([0x08, 0x96, 0x01])
  expect(tree.parts.length).toEqual(1)
  expect(tree.parts[0].byteRange).toEqual([0, 3])
  expect(tree.parts[0].index).toEqual(1)
  expect(tree.parts[0].type).toEqual(0)
  expect(tree.parts[0].value).toEqual(150)
})

test('Length-Delimited Records', () => {
  /*
    2: {"testing"}
  */
  const tree = getTree([0x12, 0x07, 0x74, 0x65, 0x73, 0x74, 0x69, 0x6e, 0x67])
  expect(tree.parts.length).toEqual(1)
  expect(tree.parts[0].index).toEqual(2)
  expect(tree.parts[0].type).toEqual(2)
  expect(readString(tree.parts[0])).toEqual('testing')
})

test('Submessages', () => {
  /*
    3: {1: 150}
  */
  const tree = getTree([0x1a, 0x03, 0x08, 0x96, 0x01])
  expect(tree.parts.length).toEqual(1)
  expect(tree.parts[0].index).toEqual(3)
  expect(tree.parts[0].type).toEqual(2)

  const s = getTree(tree.parts[0].value)
  expect(s.parts.length).toEqual(1)
  expect(s.parts[0].byteRange).toEqual([0, 3])
  expect(s.parts[0].type).toEqual(0)
  expect(s.parts[0].index).toEqual(1)
  expect(s.parts[0].value).toEqual(150)
})

test('Repeated Elements', () => {
  /*
    4: {"hello"}
    5: 1
    5: 2
    5: 3
  */
  const tree = getTree([0x22, 0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x28, 0x01, 0x28, 0x02, 0x28, 0x03])
  expect(tree.parts.length).toEqual(4)
  expect(tree.parts[0].index).toEqual(4)
  expect(readString(tree.parts[0])).toEqual('hello')
  expect(tree.parts[1].index).toEqual(5)
  expect(tree.parts[1].value).toEqual(1)
  expect(tree.parts[2].index).toEqual(5)
  expect(tree.parts[2].value).toEqual(2)
  expect(tree.parts[3].index).toEqual(5)
  expect(tree.parts[3].value).toEqual(3)
})

test('Packed Repeated Fields', () => {
  /*
    6: {5 270 86942}
  */
  const tree = getTree([0x32, 0x06, 0x05, 0x8e, 0x02, 0x9e, 0xa7, 0x05])
  expect(tree.parts.length).toEqual(1)
  expect(tree.parts[0].index).toEqual(6)
  expect(tree.parts[0].type).toEqual(2)
  expect(readPackedVarint(tree.parts[0])).toEqual([5, 270, 86942])
})
