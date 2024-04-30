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
test('field with groups (media)', () => {
  // this gets more but is till not right
  const medias = query(appTree, '10:bytes').map(i => {
    const t = getTree(i)
    return {
      type: query(t, '1:var').pop(),
      url: query(t, '5:string').pop()
    }
  })
  expect(medias.length).toEqual(10)
  const icon = medias.find(m => m.type === 4).url
  const screenshots = medias.filter(m => m.type === 1).map(m => m.url)
  const videos = medias.filter(m => m.type === 3).map(m => m.url)
  const videoThumbs = medias.filter(m => m.type === 13).map(m => m.url)

  expect(icon).toEqual('https://play-lh.googleusercontent.com/qTt7JkhZ-U0kevENyTChyUijNUEctA3T5fh7cm8yzKUG0UAnMUgOMpG_9Ln7D24NbQ')
  expect(screenshots.length).toEqual(6)
  expect(screenshots[0]).toEqual('https://play-lh.googleusercontent.com/m-S0SqOv428DZcm46NJlyv0pffYpfsNjWz6iyf9LVM1TCWbzWs3clWaugjfzXXnCTbY')
  expect(videos).toEqual(['https://youtu.be/XT7YEb9_Muw'])
  expect(videoThumbs).toEqual(['https://i.ytimg.com/vi/XT7YEb9_Muw/hqdefault.jpg'])

  /*
  // I should be able to query liek this, but it does not find the repeatsss correctly
  const types = query(appTree, '10.1:var')
  const urls = query(appTree, '10.5:string')
  console.log(types, urls)
  */
})
