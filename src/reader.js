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

// this will read wiretype:1
export function readFixed64(buffer, position) {
  if (position.offset + 8 > buffer.byteLength) {
    throw new Error('Buffer overflow while reading fixed64')
  }
  const value = buffer.slice(position.offset, position.offset + 8)
  position.offset += 8
  return value
}

// this will read wiretype:5
export function readFixed32(buffer, position) {
  if (position.offset + 4 > buffer.byteLength) {
    throw new Error('Buffer overflow while reading fixed32')
  }
  const value = buffer.slice(position.offset, position.offset + 4)
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
