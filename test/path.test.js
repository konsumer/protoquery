// same tests as reader, but using trees/paths and verifying differnt kinds of path calls

/* global test expect */

import { getTree, query } from '../src/reader.js'

test('A Simple Message', () => {
  /*
    1: 150
  */
  const tree = getTree([0x08, 0x96, 0x01])
  expect(query(tree, '1:var')).toEqual([150])
})

test('A Simple Message: choices', () => {
  /*
    1: 150
  */
  const tree = getTree([0x08, 0x96, 0x01])
  expect(query(tree, '1', { 1: 'var' })).toEqual([150])
})

test('A Simple Message: choices & prefix', () => {
  /*
    3: {1: 150}
  */
  const tree = getTree([0x1a, 0x03, 0x08, 0x96, 0x01])
  expect(query(tree, '1', { 3.1: 'var' }, '3')).toEqual([150])
})

test('Length-Delimited Records', () => {
  /*
    2: {"testing"}
  */
  const tree = getTree([0x12, 0x07, 0x74, 0x65, 0x73, 0x74, 0x69, 0x6e, 0x67])
  expect(query(tree, '2:string')).toEqual(['testing'])
})

test('Submessages', () => {
  /*
    3: {1: 150}
  */
  const tree = getTree([0x1a, 0x03, 0x08, 0x96, 0x01])
  expect(query(tree, '3.1:var')).toEqual([150])
})

test('Repeated Elements', () => {
  /*
    4: {"hello"}
    5: 1
    5: 2
    5: 3
  */
  const tree = getTree([0x22, 0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x28, 0x01, 0x28, 0x02, 0x28, 0x03])
  expect(query(tree, '5:var')).toEqual([1, 2, 3])
  expect(query(tree, '4:string')).toEqual(['hello'])
})

test('Packed Repeated Fields', () => {
  /*
    6: {3 270 86942}
  */
  const tree = getTree([0x32, 0x06, 0x03, 0x8e, 0x02, 0x9e, 0xa7, 0x05])
  expect(query(tree, '6:packedvar')).toEqual([[3, 270, 86942]])
})
