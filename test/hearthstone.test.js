// tests that show how to actually parse some tree-proto

/* global test expect */

import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { readFile } from 'fs/promises'
import { getTree, query } from '../src/reader.js'

// build an initial array of the data I want to look at
// do this, and you can use getPath() to get values
const pb = await readFile(join(dirname(fileURLToPath(import.meta.url)), 'hearthstone.bin'))
const tree = getTree(pb)

// since all is off of 1.2.4, this will optimize to pull from there, "raw" is default type
const appTree = getTree(query(tree, '1.2.4:bytes').pop())

test('Get bytes of a sub-message with query', () => {
  const matches = query(tree, '1.2.4:bytes')
  expect(matches.length).toEqual(1)
  expect(matches[0].length).toEqual(15241)
})

test('Get id with query', () => {
  expect(query(appTree, '1:string').pop()).toEqual('com.blizzard.wtcg.hearthstone')
})

test('Get title with query', () => {
  expect(query(appTree, '5:string').pop()).toEqual('Hearthstone')
})

// TODO: this should return several types/url
test('media fields', () => {
  /*
  // this gets more but is till not right
  const medias = query(appTree, '10:bytes').map(i => {
    const t = getTree(i)
    return {
      type: query(t, '1:var'),
      url: query(t, '5:string')
    }
  })
  console.log(medias)
  */
  const types = query(appTree, '10.1:var')
  const urls = query(appTree, '10.5:string')
  console.log(types, urls)
})
