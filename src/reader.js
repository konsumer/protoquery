const _dec = new TextDecoder()

export class BufferReader {
  constructor (buffer) {
    this.buffer = buffer
    this.offset = 0
  }

  readVarInt () {
    let result = 0
    let shift = 0
    let byte

    do {
      if (this.offset >= this.buffer.byteLength) {
        throw new Error('Buffer overflow while reading varint')
      }
      byte = this.buffer[this.offset++]
      result |= (byte & 0x7f) << shift
      shift += 7
    } while (byte >= 0x80)
    return result
  }

  readBuffer (length) {
    this.checkByte(length)
    const result = this.buffer.slice(this.offset, this.offset + length)
    this.offset += length
    return result
  }

  // gRPC has some additional header - remove it
  trySkipGrpcHeader () {
    const backupOffset = this.offset
    if (this.buffer[this.offset] === 0 && this.leftBytes() >= 5) {
      this.offset++
      const length = (new DataView(this.buffer)).getInt32(this.offset, false)
      this.offset += 4

      if (length > this.leftBytes()) {
        // Something is wrong, revert
        this.offset = backupOffset
      }
    }
  }

  leftBytes () {
    return this.buffer.length - this.offset
  }

  checkByte (length) {
    const bytesAvailable = this.leftBytes()
    if (length > bytesAvailable) {
      throw new Error(
        'Not enough bytes left. Requested: ' +
          length +
          ' left: ' +
          bytesAvailable
      )
    }
  }

  checkpoint () {
    this.savedOffset = this.offset
  }

  resetToCheckpoint () {
    this.offset = this.savedOffset
  }
}

export const TYPES = {
  VARINT: 0,
  FIXED64: 1,
  LENDELIM: 2,
  GROUPSTART: 3,
  GROUPEND: 4,
  FIXED32: 5
}

export function getTree (buffer) {
  const reader = new BufferReader(buffer)
  const parts = []

  reader.trySkipGrpcHeader()

  try {
    while (reader.leftBytes() > 0) {
      reader.checkpoint()

      const byteRange = [reader.offset]
      const indexType = parseInt(reader.readVarInt())
      const out = { type: indexType & 0b111, index: indexType >> 3, byteRange }
      if (out.type === TYPES.VARINT) {
        out.value = reader.readVarInt()
      } else if (out.type === TYPES.LENDELIM) {
        const length = parseInt(reader.readVarInt())
        out.value = reader.readBuffer(length)
      } else if (out.type === TYPES.FIXED32) {
        out.value = reader.readBuffer(4)
      } else if (out.type === TYPES.FIXED64) {
        out.value = reader.readBuffer(8)
      } else {
        throw new Error('Unknown type: ' + out.type)
      }
      byteRange.push(reader.offset)

      parts.push(out)
    }
  } catch (err) {
    reader.resetToCheckpoint()
  }

  return {
    parts,
    leftOver: reader.readBuffer(reader.leftBytes())
  }
}

const bytes2int32 = b => (b[3] << 24) | (b[2] << 16) | (b[1] << 8) | b[0]
const bytes2int64 = b => (b[7] << 56) | (b[6] << 48) | (b[5] << 40) | (b[4] << 32) | (b[3] << 24) | (b[2] << 16) | (b[1] << 8) | b[0]

// utilities for processing treebranches

// this will read a packed array of varints (which will be encoded in a wiretype:2)
export function readPackedVarint (treebranch) {
  if (treebranch.type !== 2) {
    throw new Error('Wiretype must be 2 for packed varints.')
  }
  const values = []
  const b = new BufferReader(treebranch.value)

  while (b.offset < treebranch.value.length) {
    values.push(b.readVarInt())
  }
  return values
}

// this will read a packed array of fixed32s (which will be encoded in a wiretype:2)
export function readPackedInt32 (treebranch) {
  if (treebranch.type !== 2) {
    throw new Error('Wiretype must be 2 for packed varints.')
  }
  const values = []
  const b = new BufferReader(treebranch.value)

  while (b.offset < treebranch.value.length) {
    values.push(bytes2int32(b.readBuffer(4)))
  }
  return values
}

// this will read a packed array of fixed64s (which will be encoded in a wiretype:2)
export function readPackedInt64 (treebranch) {
  if (treebranch.type !== 2) {
    throw new Error('Wiretype must be 2 for packed varints.')
  }
  const values = []
  const b = new BufferReader(treebranch.value)

  while (b.offset < treebranch.value.length) {
    values.push(bytes2int64(b.readBuffer(8)))
  }
  return values
}

// this will read a string (which will be encoded in a wiretype:2)
export function readString (treebranch) {
  if (treebranch.type !== 2) {
    throw new Error('Wiretype must be 2 for strings.')
  }
  return _dec.decode(new Uint8Array(treebranch.value))
}

const wireMap = {}
wireMap[TYPES.VARINT] = ['var']
wireMap[TYPES.FIXED64] = ['i64', 'u64', 'double']
wireMap[TYPES.LENDELIM] = ['string', 'bytes', 'packedvar', 'packed32', 'packed64']
wireMap[TYPES.GROUPSTART] = []
wireMap[TYPES.GROUPEND] = []
wireMap[TYPES.FIXED32] = ['i32', 'u32', 'bool', 'f32']

function handleField (current, t) {
  if (!wireMap[current.type].includes(t) && t !== 'raw') {
    throw new Error(`Type ${current.type} does not support ${t}. It should be one of these: raw, ${wireMap[current.type].join(', ')}`)
  }

  switch (t) {
    case 'raw':
      return current
    case 'u32':
    case 'u64':
    case 'var':
    case 'bytes':
      return current.value

    case 'i32':
      return new DataView(current.value).getInt32(0, true)

    case 'bool':
      return !!current.value

    case 'i64':
      return new DataView(current.value).getBigInt64(0, true)

    case 'f32':
      return new DataView(current.value).getFloat32(0, true)

    case 'double':
      return new DataView(current.value).getFloat64(0, true)

    case 'string':
      return readString(current)

    case 'packedvar':
      return readPackedVarint(current)

    case 'packed32':
      return readPackedInt32(current)

    case 'packed64':
      return readPackedInt64(current)
  }
}

// lazily evaluate query on a tree
export function query (tree, path, choices = {}, prefix = '') {
  if (typeof choices === 'string') {
    if (!prefix) {
      prefix = choices
      choices = {}
    } else {
      throw new Error('Usage: query(tree, choices={}, path="X.X.X") or query(tree, path="X.X.X")')
    }
  }

  // this allows you to override type in path, but also will apply type-choice & prefix
  let [p, type] = path.split(':')
  if (!type) {
    if (prefix) {
      p = `${prefix}.${p}`
    }
    if (choices[p]) {
      type = choices[p]
    } else {
      type = 'raw'
    }
  }

  // now type is the type of value to pull, and p is the path, from the top

  let current = tree
  const out = []
  const pp = p.split('.')
  const pl = pp.length - 1

  for (const l in pp) {
    const pc = parseInt(l)
    const n = parseInt(pp[pc])

    if (current.parts) {
      for (const c of current.parts.filter((v) => v.index === n)) {
        if (pc === pl) {
          out.push(handleField(c, type))
        } else {
          current = getTree(c.value)
        }
      }
    }
  }

  return out
}
