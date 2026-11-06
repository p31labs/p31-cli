/**
 * Minimal CBOR + COSE_Sign1 (RFC 8949 / RFC 9052) — no external dependencies.
 *
 * Scope is deliberately small (audit payloads only):
 *   - unsigned / negative integers (major 0/1)
 *   - byte strings (major 2), text strings (major 3)
 *   - arrays (major 4), maps (major 5)
 *   - tags (major 6) — required for COSE_Sign1 tag 18
 *   - simple values true / false / null (major 7)
 *
 * Indefinite-length items and floating point are rejected. Maps decode to
 * `Map` so integer header keys (e.g. COSE `1: alg`, `4: kid`) are preserved
 * instead of being coerced to strings by plain JS objects.
 *
 * COSE_Sign1 per RFC 9052 §4.2:
 *   COSE_Sign1 = [ protected : bstr, unprotected : map, payload : bstr, signature : bstr ]
 *   Sig_structure = [ "Signature1", body_protected : bstr, external_aad : bstr, payload : bstr ]
 */

export class CborTag {
  constructor(
    public readonly tag: number,
    public readonly value: CborValue,
  ) {}
}

export type CborMap = Map<CborValue, CborValue>;
export type CborValue =
  | number
  | string
  | Uint8Array
  | boolean
  | null
  | CborValue[]
  | CborMap
  | CborTag;

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

function encodeHead(major: number, length: number): Buffer {
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new Error(`CBOR: invalid length/value ${length}`);
  }
  const mt = (major & 0x07) << 5;
  if (length < 24) return Buffer.from([mt | length]);
  if (length <= 0xff) return Buffer.from([mt | 24, length]);
  if (length <= 0xffff) {
    const b = Buffer.alloc(3);
    b[0] = mt | 25;
    b.writeUInt16BE(length, 1);
    return b;
  }
  if (length <= 0xffffffff) {
    const b = Buffer.alloc(5);
    b[0] = mt | 26;
    b.writeUInt32BE(length, 1);
    return b;
  }
  if (length <= MAX_SAFE) {
    const b = Buffer.alloc(9);
    b[0] = mt | 27;
    b.writeBigUInt64BE(BigInt(length), 1);
    return b;
  }
  throw new Error(`CBOR: length ${length} exceeds Number.MAX_SAFE_INTEGER`);
}

export function encodeCBOR(value: CborValue): Buffer {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error(`CBOR: only safe integers are supported (got ${value})`);
    if (value >= 0) return encodeHead(0, value);
    return encodeHead(1, -1 - value);
  }

  if (value instanceof CborTag) {
    return Buffer.concat([encodeHead(6, value.tag), encodeCBOR(value.value)]);
  }

  if (value instanceof Uint8Array) {
    return Buffer.concat([encodeHead(2, value.length), Buffer.from(value)]);
  }

  if (typeof value === 'string') {
    const bytes = Buffer.from(value, 'utf8');
    return Buffer.concat([encodeHead(3, bytes.length), bytes]);
  }

  if (typeof value === 'boolean') {
    return Buffer.from([value ? 0xf5 : 0xf4]);
  }

  if (value === null) {
    return Buffer.from([0xf6]);
  }

  if (Array.isArray(value)) {
    const parts: Buffer[] = [encodeHead(4, value.length)];
    for (const item of value) parts.push(encodeCBOR(item));
    return Buffer.concat(parts);
  }

  if (value instanceof Map) {
    const parts: Buffer[] = [encodeHead(5, value.size)];
    for (const [k, v] of value.entries()) {
      parts.push(encodeCBOR(k), encodeCBOR(v));
    }
    return Buffer.concat(parts);
  }

  throw new Error(`CBOR: unsupported value type ${Object.prototype.toString.call(value)}`);
}

function readArgument(buf: Buffer, offset: number, info: number): number {
  if (info < 24) return info;
  if (info === 24) {
    if (offset + 1 > buf.length) throw new Error('CBOR: truncated uint8 argument');
    return buf[offset];
  }
  if (info === 25) {
    if (offset + 2 > buf.length) throw new Error('CBOR: truncated uint16 argument');
    return buf.readUInt16BE(offset);
  }
  if (info === 26) {
    if (offset + 4 > buf.length) throw new Error('CBOR: truncated uint32 argument');
    return buf.readUInt32BE(offset);
  }
  if (info === 27) {
    if (offset + 8 > buf.length) throw new Error('CBOR: truncated uint64 argument');
    const big = buf.readBigUInt64BE(offset);
    if (big > BigInt(MAX_SAFE)) throw new Error('CBOR: 64-bit integer exceeds Number.MAX_SAFE_INTEGER');
    return Number(big);
  }
  if (info === 31) throw new Error('CBOR: indefinite-length items are not supported');
  throw new Error(`CBOR: reserved additional information ${info}`);
}

function argumentSize(info: number): number {
  if (info < 24) return 0;
  if (info === 24) return 1;
  if (info === 25) return 2;
  if (info === 26) return 4;
  if (info === 27) return 8;
  if (info === 31) throw new Error('CBOR: indefinite-length items are not supported');
  throw new Error(`CBOR: reserved additional information ${info}`);
}

export function decodeCBOR(input: Uint8Array, startOffset = 0): { value: CborValue; bytesRead: number } {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let offset = startOffset;

  if (offset >= buf.length) throw new Error('CBOR: unexpected end of input');

  const initial = buf[offset++];
  const major = initial >> 5;
  const info = initial & 0x1f;
  const argSize = argumentSize(info);
  const arg = readArgument(buf, offset, info);
  offset += argSize;

  switch (major) {
    case 0:
      return { value: arg, bytesRead: offset - startOffset };
    case 1:
      return { value: -1 - arg, bytesRead: offset - startOffset };
    case 2: {
      if (offset + arg > buf.length) throw new Error('CBOR: truncated byte string');
      const value = buf.subarray(offset, offset + arg);
      offset += arg;
      return { value, bytesRead: offset - startOffset };
    }
    case 3: {
      if (offset + arg > buf.length) throw new Error('CBOR: truncated text string');
      const value = buf.subarray(offset, offset + arg).toString('utf8');
      offset += arg;
      return { value, bytesRead: offset - startOffset };
    }
    case 4: {
      const arr: CborValue[] = [];
      for (let i = 0; i < arg; i++) {
        const item = decodeCBOR(buf, offset);
        arr.push(item.value);
        offset += item.bytesRead;
      }
      return { value: arr, bytesRead: offset - startOffset };
    }
    case 5: {
      const map: CborMap = new Map();
      for (let i = 0; i < arg; i++) {
        const k = decodeCBOR(buf, offset);
        offset += k.bytesRead;
        const v = decodeCBOR(buf, offset);
        offset += v.bytesRead;
        map.set(k.value, v.value);
      }
      return { value: map, bytesRead: offset - startOffset };
    }
    case 6: {
      const inner = decodeCBOR(buf, offset);
      offset += inner.bytesRead;
      return { value: new CborTag(arg, inner.value), bytesRead: offset - startOffset };
    }
    case 7: {
      if (info === 20) return { value: false, bytesRead: 1 };
      if (info === 21) return { value: true, bytesRead: 1 };
      if (info === 22) return { value: null, bytesRead: 1 };
      throw new Error(`CBOR: unsupported simple/float value (info ${info})`);
    }
    default:
      throw new Error(`CBOR: unsupported major type ${major}`);
  }
}

export function decodeCBORFirst(input: Uint8Array): CborValue {
  return decodeCBOR(input).value;
}

// ─── COSE_Sign1 ─────────────────────────────────────────────────────────────

export interface COSESign1Structure {
  protectedBytes: Buffer;
  protectedHeader: CborValue;
  unprotected: CborValue;
  payload: Buffer;
  signature: Buffer;
  bytesRead: number;
}

/** Protected header map: { 1: alg, 4: kid } (alg -8 = EdDSA). */
export function encodeProtectedHeader(alg: number, kid: Uint8Array): Buffer {
  const map: CborMap = new Map<CborValue, CborValue>();
  map.set(1, alg);
  map.set(4, kid);
  return encodeCBOR(map);
}

/** RFC 9052 Sig_structure for a single signer, external_aad defaults to empty. */
export function encodeSigStructure(
  protectedBytes: Uint8Array,
  payload: Uint8Array,
  externalAad: Uint8Array = new Uint8Array(0),
): Buffer {
  return encodeCBOR([
    'Signature1',
    new Uint8Array(protectedBytes),
    new Uint8Array(externalAad),
    new Uint8Array(payload),
  ]);
}

export function encodeCOSESign1(
  protectedBytes: Uint8Array,
  unprotected: CborValue,
  payload: Uint8Array,
  signature: Uint8Array,
): Buffer {
  return encodeCBOR(
    new CborTag(18, [
      new Uint8Array(protectedBytes),
      unprotected,
      new Uint8Array(payload),
      new Uint8Array(signature),
    ]),
  );
}

export function decodeCOSESign1(input: Uint8Array): COSESign1Structure {
  const decoded = decodeCBOR(input);
  if (!(decoded.value instanceof CborTag) || decoded.value.tag !== 18) {
    throw new Error('COSE: expected CBOR tag 18 (COSE_Sign1)');
  }
  const parts = decoded.value.value;
  if (!Array.isArray(parts) || parts.length !== 4) {
    throw new Error('COSE: COSE_Sign1 must be an array of 4 elements');
  }
  const [protectedValue, unprotected, payloadValue, signatureValue] = parts;
  if (!(protectedValue instanceof Uint8Array)) throw new Error('COSE: protected header must be a byte string');
  if (!(payloadValue instanceof Uint8Array)) throw new Error('COSE: payload must be a byte string');
  if (!(signatureValue instanceof Uint8Array)) throw new Error('COSE: signature must be a byte string');
  if (!(unprotected instanceof Map) && unprotected !== null) {
    throw new Error('COSE: unprotected header must be a map or null');
  }
  return {
    protectedBytes: Buffer.from(protectedValue),
    protectedHeader: protectedValue.length === 0 ? new Map() : decodeCBORFirst(protectedValue),
    unprotected,
    payload: Buffer.from(payloadValue),
    signature: Buffer.from(signatureValue),
    bytesRead: decoded.bytesRead,
  };
}

// ─── Deterministic P31 framing ──────────────────────────────────────────────
//
// A `.cose` file produced by P31 is:
//
//   magic  : 8 bytes ASCII "P31COSE1"
//   count  : 4 bytes big-endian uint32 (number of COSE_Sign1 statements)
//   frame* : 4 bytes big-endian uint32 length, then exactly `length` bytes of
//            a standalone CBOR tag-18 COSE_Sign1 object
//
// Each frame is independently decodable by standard COSE/CBOR tooling. The
// magic + explicit count make verification deterministic and reject trailing
// or truncated data. A raw single COSE_Sign1 (starting with byte 0xD2) is also
// accepted by the verifier for third-party interoperability.

export const P31_COSE_MAGIC = Buffer.from('P31COSE1', 'ascii');

export function looksLikeP31COSE(buf: Uint8Array): boolean {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.length >= P31_COSE_MAGIC.length + 4 && b.subarray(0, P31_COSE_MAGIC.length).equals(P31_COSE_MAGIC);
}

export function encodeFramedCOSE(frames: Uint8Array[]): Buffer {
  const parts: Buffer[] = [P31_COSE_MAGIC, Buffer.alloc(4)];
  parts[1].writeUInt32BE(frames.length, 0);
  for (const frame of frames) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(frame.length, 0);
    parts.push(len, Buffer.from(frame));
  }
  return Buffer.concat(parts);
}

export function decodeFramedCOSE(buf: Uint8Array): { frames: Buffer[] } {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (!looksLikeP31COSE(b)) throw new Error('COSE: missing P31COSE1 framing marker');
  const count = b.readUInt32BE(8);
  let offset = 12;
  const frames: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 4 > b.length) throw new Error(`COSE: truncated frame ${i} length prefix`);
    const len = b.readUInt32BE(offset);
    offset += 4;
    if (offset + len > b.length) throw new Error(`COSE: truncated frame ${i} body`);
    frames.push(b.subarray(offset, offset + len));
    offset += len;
  }
  if (offset !== b.length) {
    throw new Error(`COSE: ${b.length - offset} trailing byte(s) after ${count} frame(s)`);
  }
  return { frames };
}
