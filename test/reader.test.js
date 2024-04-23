/* global describe test expect */

import reader, { readPackedVarint, readString } from '../src/reader.js'

// tests to verify results from hand-parsing:
// https://protobuf.dev/programming-guides/encoding/

/*
0 VARINT  int32, int64, uint32, uint64, sint32, sint64, bool, enum
1 I64 fixed64, sfixed64, double
2 LEN string, bytes, embedded messages, packed repeated fields
3 SGROUP  group start (deprecated)
4 EGROUP  group end (deprecated)
5 I32 fixed32, sfixed32, float
*/

describe('basic tests from parsing docs', () => {
  /*
  1: 150
  */
  test('A Simple Message', () => {
    const b = new Uint8Array([0x08, 0x96, 0x01])
    for (const { fieldNumber, wireType, dataByteLength, data } of reader(b)) {
      expect(fieldNumber).toEqual(1)
      expect(wireType).toEqual(0)
      expect(dataByteLength).toEqual(2)
      // type is 0 (varint) and dataByteLength is <= 4 (int32) so it's safe to read as number (int53)
      expect(Number(data)).toEqual(150)
    }
  })

  test('Length-Delimited Records', () => {
    /*
    2: {"testing"}
    */
    const b = new Uint8Array([0x12, 0x07, 0x74, 0x65, 0x73, 0x74, 0x69, 0x6e, 0x67])
    for (const { fieldNumber, wireType, dataByteLength, data } of reader(b)) {
      expect(fieldNumber).toEqual(2)
      expect(wireType).toEqual(2)
      expect(dataByteLength).toEqual(8)
      // wiretype is 2 (len) and I know it's a "string" so parse it like that
      expect(readString(data)).toEqual('testing')
    }
  })

  test('Submessages', () => {
    /*
    3: {1: 150}
    */
    const b = new Uint8Array([0x1a, 0x03, 0x08, 0x96, 0x01])
    for (const { fieldNumber, wireType, dataByteLength, data } of reader(b)) {
      expect(fieldNumber).toEqual(3)
      expect(wireType).toEqual(2)
      expect(dataByteLength).toEqual(4)
      // we know this is a sub-message, so parse it
      for (const s of reader(data)) {
        expect(s.fieldNumber).toEqual(1)
        expect(s.wireType).toEqual(0)
        expect(s.dataByteLength).toEqual(2)
        // type is 0 (varint) and dataByteLength is <= 4 (int32) so it's safe to read as number (int53)
        expect(Number(s.data)).toEqual(150)
      }
    }
  })

  test('Repeated Elements', () => {
    /*
    4: {"hello"}
    5: 1
    5: 2
    5: 3
    */
    const b = new Uint8Array([0x22, 0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x28, 0x01, 0x28, 0x02, 0x28, 0x03])
    const counts = { 4: 0, 5: 0 }
    for (const { fieldNumber, wireType, dataByteLength, data } of reader(b)) {
      counts[fieldNumber]++
      if (fieldNumber === 5) {
        expect(wireType).toEqual(0)
      }
      if (fieldNumber === 4) {
        expect(wireType).toEqual(2)
        expect(dataByteLength).toEqual(6)
        expect(readString(data)).toEqual('hello')
      }
    }
    expect(counts[4]).toEqual(1)
    expect(counts[5]).toEqual(3)
  })

  test('Packed Repeated Fields', () => {
    /*
    6: {3 270 86942}
    */
    const b = new Uint8Array([0x32, 0x06, 0x03, 0x8e, 0x02, 0x9e, 0xa7, 0x05])
    for (const { fieldNumber, wireType, dataByteLength, data, position } of reader(b)) {
      expect(fieldNumber).toEqual(6)
      // format can't be guessed (it could be any wiretype:2) but I include helpers to get values
      const values = readPackedVarint(b, position)
      expect(values).toEqual([3, 270, 86942])
    }
  })
})
