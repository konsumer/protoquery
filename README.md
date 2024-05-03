> [!CAUTION]
> This has been depracated, in favor of [rawproto](https://github.com/konsumer/rawproto), where I did similar, but improved the query-engine a bit. You should use that.

Very small raw protobuf query-parser.

This is similar to [rawprotoparse](https://github.com/konsumer/rawprotoparse), but allows you to run queries that just parse what you want to read. I will probably merge these all, at some point.

## query language

Queries are a series of field-numbers to traverse, then the desired output value. The reason for this is that every protobuf wiretype can actually be several different formats. That is sort of the purpose of this library, since guessing will only get you so far, but pulling with queries, you can get any data you want, in the correct format.

There are a couple rules:

- Start your query at the top of the root. You can send a sub-root, but then all the queries start there.
- End your query with the type you want.

Here are soem examples:

```
1.2.4.1:string
1.2.4.5:string
1.2.4:bytes
1.2.4:raw
```

### types

There are these wire-types in protobuf:

```
VARINT: 0,
FIXED64: 1,
LENGTH_DELIMITED: 2,
FIXED32: 5
```

these correspond to these type-selectors:

```
VARINT - var
FIXED64 - i64, u64, double
LEN - string, bytes, packedvar, packed32, packed64
FIXED32 - i32, u32, bool, f32
```

These types will probly be different in the future (combining float/int/uint types and more to simplify.)

### cli

You can use it to introspect the format and pull fields out.

```
# just print the wire-structure (no query)
cat test/hearthstone.bin | npx -y protoquery

1: LEN
  2: LEN
    4: LEN
       1: LEN
       ...
       5: LEN
...


# once you know the structure, you can query it (this gets id & title from google play detail record)
cat test/hearthstone.bin | npx -y protoquery '1.2.4.1:string' '1.2.4.5:string'

1:
  2:
    4:
      1: com.blizzard.wtcg.hearthstone
      5: Hearthstone
```

### library

It's used in 2 pieces.

- Build a tree with `getTree`
- Query the tree with `getPath`

Here is an example:

```js
import { readFile } from 'fs/promises'
import { getTree, getPath } from 'protoquery'

const data = await readFile('somebinaryproto.pb')

// build the tree
const tree = getTree(data)

// query some stuff, all output is arrays because there could be multiple matches
console.log(getPath(tree, '1.2.4.1:string').pop())
console.log(getPath(raw, '1.2.4.5:string').pop())
```

These queries correspond to a proto SDL that looks something like this:

```proto
message Root {
  Level2 level2 = 1;
}

message Level2 {
  Level3 level3 = 2;
}
message Level3 {
  Level4 level4 = 4;
}

message Level4 {
  string id = 1;
  string title = 5;
}
```

Now, pretend we don't know the structure, this is just reversed from the shape of the data (`1.2.4.1` is `id` for example.)

You can get the structure of the data with another library (like [rawprotoparse](https://github.com/konsumer/rawprotoparse)) or just look at the tree:

```
{
  parts: [
    {
      type: 2,
      index: 1,
      byteRange: [Array],
      value: <Buffer 12 ab 79 22 89 77 0a 1d 63 6f 6d 2e 62 6c 69 7a 7a 61 72 64 2e 77 74 63 67 2e 68 65 61 72 74 68 73 74 6f 6e 65 12 1d 63 6f 6d 2e 62 6c 69 7a 7a 61 72 ... 15484 more bytes>
    },
    { type: 2, index: 5, byteRange: [Array], value: <Buffer 08 6d> },
    {
      type: 2,
      index: 9,
      byteRange: [Array],
      value: <Buffer 08 12 9a 01 19 0a 13 08 9c 92 cb fa fd e0 84 03 15 8b 44 05 00 1d bb 2d 05 8d 10 01 20 00>
    }
  ],
  leftOver: <Buffer >
}
```

You can use that `type`/`index` to figure it out, and `value` includes the sub-root for 2 (`LEN`) fields, as binary (so you can use `getTree` on it.)
