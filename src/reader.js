const WIRE_TYPES = {
  VARINT: 0,
  FIXED64: 1,
  LENGTH_DELIMITED: 2,
  FIXED32: 5
}

const _dec = new TextDecoder()

// this will read wireetype:0 (or any other varint, which is used in wiretype:2 for example)
export function readVarint(buffer, position) {
  let result = 0
  let shift = 0
  let byte,
    offset = position.offset

  do {
    if (offset >= buffer.byteLength) {
      throw new Error('Buffer overflow while reading varint')
    }
    byte = buffer[offset++]
    result |= (byte & 0x7f) << shift
    shift += 7
  } while (byte >= 0x80)

  position.offset = offset
  return result
}

// this will read wiretype:1 as uint64
export function readFixed64(buffer, position) {
  if (position.offset + 8 > buffer.byteLength) {
    throw new Error('Buffer overflow while reading fixed64')
  }
  const value = new Number(new DataView(buffer.slice(position.offset, position.offset + 8)).getBigUint64())
  position.offset += 8
  return value
}

// this will read wiretype:5 as uint32
export function readFixed32(buffer, position) {
  if (position.offset + 4 > buffer.byteLength) {
    throw new Error('Buffer overflow while reading fixed32')
  }
  const value = new DataView(buffer.slice(position.offset, position.offset + 4)).getUint32()
  position.offset += 4
  return value
}

// this will read wiretype:2
export function readLengthDelimited(buffer, position) {
  const length = readVarint(buffer, position)
  if (position.offset + length > buffer.byteLength) {
    throw new Error('Buffer overflow while reading length-delimited data')
  }
  const value = buffer.slice(position.offset, position.offset + length)
  position.offset += length
  return value
}

// this will read a packed array of varints (which will be encoded in a wiretype:2)
export function readPackedVarint(buffer, position) {
  const length = readVarint(buffer, position)
  let endPosition = position.offset + length
  const values = []
  while (position.offset < endPosition) {
    values.push(readVarint(buffer, position))
  }
  return values
}

// this will read a packed array of fixed32s (which will be encoded in a wiretype:2)
export function readPackedFixed32(buffer, position) {
  const length = readVarint(buffer, position)
  let endPosition = position.offset + length
  const values = []
  while (position.offset < endPosition) {
    values.push(readFixed32(buffer, position))
  }
  return values
}

// this will read a packed array of fixed64s (which will be encoded in a wiretype:2)
export function readPackedFixed64(buffer, position) {
  const length = readVarint(buffer, position)
  let endPosition = position.offset + length
  const values = []
  while (position.offset < endPosition) {
    values.push(readFixed64(buffer, position))
  }
  return values
}

export function readString(buffer) {
  return _dec.decode(buffer)
}

export default function* reader(buf) {
  const buffer = new Uint8Array(buf)
  let position = { offset: 0 }

  while (position.offset < buffer.byteLength) {
    const tag = readVarint(buffer, position)
    const fieldNumber = tag >> 3
    const wireType = tag & 0x07
    const p = position.offset

    switch (wireType) {
      case WIRE_TYPES.VARINT:
        yield { fieldNumber, wireType, data: readVarint(buffer, position), position: { offset: p }, dataByteLength: position.offset - p }
        break
      case WIRE_TYPES.FIXED64:
        yield { fieldNumber, wireType, data: readFixed64(buffer, position), position: { offset: p }, dataByteLength: position.offset - p }
        break
      case WIRE_TYPES.LENGTH_DELIMITED:
        yield { fieldNumber, wireType, data: readLengthDelimited(buffer, position), position: { offset: p }, dataByteLength: position.offset - p }
        break
      case WIRE_TYPES.FIXED32:
        yield { fieldNumber, wireType, data: readFixed32(buffer, position), position: { offset: p }, dataByteLength: position.offset - p }
        break
      default:
        throw new Error(`Unsupported wire type: ${wireType}`)
    }
  }
}

// builds a first pass tree with initial values
export function getTree(buf) {
  const out = []
  for (const f of reader(buf)) {
    if (f.wireType === 2) {
      try {
        f.sub = getTree(f.data)
      } catch (e) {}
    }
    out.push(f)
  }
  return out
}

const wireMap = {}
wireMap[WIRE_TYPES.VARINT] = ['var']
wireMap[WIRE_TYPES.FIXED64] = ['i64', 'u64', 'double']
wireMap[WIRE_TYPES.LENGTH_DELIMITED] = ['string', 'bytes', 'packedvar', 'packed32', 'packed64']
wireMap[WIRE_TYPES.FIXED32] = ['i32', 'u32', 'bool', 'f32']

/*
This will parse paths to get values from a tree (use getTree())
Some examples:

1.2.4.5:string
4.4.4:f32

path should start at top of raw-tree
value-type must be at end of path

possible value-types:

raw
var, i32, u32, bool, f32
i64, u64, double
string, bytes, packedvar, packed32, packed64
*/
export function getPath(raw, bytes, path) {
  let current = raw
  for (const l of path.split('.')) {
    let [n, t] = l.split(':')
    n = parseInt(n)
    // TODO: need to process multiple paths here, since repeats are valid
    const c = current.find((v) => v.fieldNumber === n)
    if (!t) {
      current = c.sub
    } else {
      current = c
      if (!wireMap[current.wireType].includes(t) && t !== 'raw') {
        throw new Error(`Type wireType ${current.wireType} does not support ${t}. It should be one of these: ${wireMap[current.wireType].join(', ')}`)
      }
      switch (t) {
        case 'raw':
          return current
        case 'u32':
        case 'u64':
        case 'varint':
        case 'bytes':
          return current.data

        case 'i32':
          return new DataView(current.data).getInt32(current.position.offset, true)

        case 'bool':
          return !!current.data

        case 'i64':
          return new DataView(current.data).getBigInt64(current.position.offset, true)

        case 'f32':
          return new DataView(current.data).getFloat32(current.position.offset, true)

        case 'double':
          return new DataView(current.data).getFloat64(current.position.offset, true)

        case 'string':
          return readString(current.data)

        case 'packedvar':
          return readPackedVarint(bytes, current.position)

        case 'packed32':
          return readPackedFixed32(bytes, current.position)

        case 'packed64':
          return readPackedFixed64(bytes, current.position)
      }
    }
  }
}
