#!/usr/bin/env python3
"""Extract the compact bridge head from the documented CC0 GLB.

Usage: python3 scripts/extract-bridge-head.py input.glb output.bin
"""
import hashlib
import json
import struct
import sys
from pathlib import Path

EXPECTED_SHA = 'd6f3b64cab629f6ddca9ba063811aeffd3663a8a4e49ade47cd9505dc2bbd70f'


def main(source, output):
    data = Path(source).read_bytes()
    if hashlib.sha256(data).hexdigest() != EXPECTED_SHA:
        raise SystemExit('Unexpected source GLB SHA-256')
    json_length = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20 + json_length])
    binary_offset = 20 + json_length + 8
    primitive = document['meshes'][2]['primitives'][0]

    def accessor(index):
        item = document['accessors'][index]
        view = document['bufferViews'][item['bufferView']]
        components = {'SCALAR': 1, 'VEC3': 3}[item['type']]
        component = {5126: 'f', 5123: 'H', 5125: 'I'}[item['componentType']]
        fmt = '<' + component * components
        start = binary_offset + view.get('byteOffset', 0) + item.get('byteOffset', 0)
        end = start + item['count'] * struct.calcsize(fmt)
        return [value if components > 1 else value[0]
                for value in struct.iter_unpack(fmt, data[start:end])]

    positions = accessor(primitive['attributes']['POSITION'])
    normals = accessor(primitive['attributes']['NORMAL'])
    indices = accessor(primitive['indices'])
    triangles = [indices[i:i + 3] for i in range(0, len(indices), 3)
                 if all(positions[index][1] > 1.56 for index in indices[i:i + 3])]
    vertices = sorted({index for triangle in triangles for index in triangle})
    remap = {vertex: index for index, vertex in enumerate(vertices)}
    with Path(output).open('wb') as result:
        result.write(struct.pack('<II', len(vertices), len(triangles) * 3))
        for vertex in vertices:
            x, y, z = positions[vertex]
            result.write(struct.pack('<3f', -x / .0926, (y - 1.685) / .125, -z / .1164))
        for vertex in vertices:
            x, y, z = normals[vertex]
            result.write(struct.pack('<3f', -x * .0926, y * .125, -z * .1164))
        for triangle in triangles:
            for vertex in triangle:
                result.write(struct.pack('<H', remap[vertex]))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
