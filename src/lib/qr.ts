/**
 * Zero-dependency QR code encoder (ISO/IEC 18004), byte mode, error
 * correction level L, versions 1–40 with automatic version selection.
 *
 * Built for issue #7 (Option C): pairing codes are deflate→base64url blobs
 * (see net/sdpCodec.ts) of roughly 650–700 characters, which lands on
 * version 18-L (capacity 718 bytes). Auto-selection up to version 40
 * (2953 bytes) leaves ample headroom for devices with many network
 * interfaces / ICE candidates. Level L is deliberate: screen-to-screen
 * scanning is a high-contrast, glare-free environment, and the lower EC
 * overhead keeps the symbol several versions smaller — easier to scan on
 * small phone screens than a denser, more redundant one.
 *
 * The only export consumers need is `encodeQR(text)`, which returns the
 * finished module matrix (`true` = dark). `matrixToSvgPath` turns that into
 * one SVG path string at unit module scale for crisp vector rendering.
 */

/** Finished QR symbol: square matrix of modules, `matrix[row][col]`. */
export type QRMatrix = boolean[][];

// ---------------------------------------------------------------------------
// GF(256) arithmetic for Reed-Solomon (primitive polynomial x^8+x^4+x^3+x^2+1)
// ---------------------------------------------------------------------------

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/**
 * Generator polynomial for `degree` error-correction codewords, returned
 * highest-degree coefficient first so `gen[0]` is the leading term (always 1)
 * and `gen[1..degree]` are the taps `rsComputeEC` subtracts. The product
 * (x−α⁰)(x−α¹)… is built up constant-term-first, so it is reversed on the way
 * out to match that convention.
 */
function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], GF_EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly.reverse();
}

/** Reed-Solomon remainder of `data` against the degree-`ecLen` generator. */
function rsComputeEC(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const res = new Uint8Array(ecLen);
  for (const byte of data) {
    const factor = byte ^ res[0];
    res.copyWithin(0, 1);
    res[ecLen - 1] = 0;
    if (factor === 0) continue;
    const logF = GF_LOG[factor];
    for (let j = 0; j < ecLen; j++) {
      // gen[0] is always 1; remainder taps use gen[1..].
      const g = gen[j + 1];
      if (g !== 0) res[j] ^= GF_EXP[GF_LOG[g] + logF];
    }
  }
  return res;
}

// ---------------------------------------------------------------------------
// Version tables (error correction level L only)
// ---------------------------------------------------------------------------

/**
 * Block structure per version at level L (ISO/IEC 18004 table 9):
 * [ecCodewordsPerBlock, [blockCount, dataCodewordsPerBlock][]].
 * Index 0 = version 1.
 */
const BLOCKS_L: Array<[number, Array<[number, number]>]> = [
  [7, [[1, 19]]],
  [10, [[1, 34]]],
  [15, [[1, 55]]],
  [20, [[1, 80]]],
  [26, [[1, 108]]],
  [18, [[2, 68]]],
  [20, [[2, 78]]],
  [24, [[2, 97]]],
  [30, [[2, 116]]],
  [18, [[2, 68], [2, 69]]],
  [20, [[4, 81]]],
  [24, [[2, 92], [2, 93]]],
  [26, [[4, 107]]],
  [30, [[3, 115], [1, 116]]],
  [22, [[5, 87], [1, 88]]],
  [24, [[5, 98], [1, 99]]],
  [28, [[1, 107], [5, 108]]],
  [30, [[5, 120], [1, 121]]],
  [28, [[3, 113], [4, 114]]],
  [28, [[3, 107], [5, 108]]],
  [28, [[4, 116], [4, 117]]],
  [28, [[2, 111], [7, 112]]],
  [30, [[4, 121], [5, 122]]],
  [30, [[6, 117], [4, 118]]],
  [26, [[8, 106], [4, 107]]],
  [28, [[10, 114], [2, 115]]],
  [30, [[8, 122], [4, 123]]],
  [30, [[3, 117], [10, 118]]],
  [30, [[7, 116], [7, 117]]],
  [30, [[5, 115], [10, 116]]],
  [30, [[13, 115], [3, 116]]],
  [30, [[17, 115]]],
  [30, [[17, 115], [1, 116]]],
  [30, [[13, 115], [6, 116]]],
  [30, [[12, 121], [7, 122]]],
  [30, [[6, 121], [14, 122]]],
  [30, [[17, 122], [4, 123]]],
  [30, [[4, 122], [18, 123]]],
  [30, [[20, 117], [4, 118]]],
  [30, [[19, 118], [6, 119]]],
];

/** Alignment pattern centre coordinates per version (index 0 = version 1). */
const ALIGNMENT: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
];

function dataCodewords(version: number): number {
  const [, groups] = BLOCKS_L[version - 1];
  return groups.reduce((sum, [count, size]) => sum + count * size, 0);
}

/** Byte-mode data capacity in bytes for a version at level L. */
function byteCapacity(version: number): number {
  // 4 bits mode indicator + 8/16-bit length field.
  const overheadBits = version < 10 ? 12 : 20;
  return Math.floor((dataCodewords(version) * 8 - overheadBits) / 8);
}

/** Smallest version whose byte-mode capacity fits `length` bytes. */
function pickVersion(length: number): number {
  for (let v = 1; v <= 40; v++) {
    if (byteCapacity(v) >= length) return v;
  }
  throw new Error(`QR payload too large: ${length} bytes (max ${byteCapacity(40)})`);
}

// ---------------------------------------------------------------------------
// Bit stream → codewords → interleaved final sequence
// ---------------------------------------------------------------------------

/** Byte-mode segment + terminator + padding, per the spec. */
function buildDataCodewords(bytes: Uint8Array, version: number): Uint8Array {
  const capacity = dataCodewords(version);
  const out = new Uint8Array(capacity);
  let bitPos = 0;
  const push = (value: number, bits: number) => {
    for (let i = bits - 1; i >= 0; i--) {
      if ((value >> i) & 1) out[bitPos >> 3] |= 0x80 >> (bitPos & 7);
      bitPos++;
    }
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);

  // Terminator (up to 4 zero bits) + pad to byte boundary: the buffer is
  // zero-initialised, so advancing bitPos is enough.
  bitPos = Math.min(bitPos + 4, capacity * 8);
  bitPos = (bitPos + 7) & ~7;

  // Alternating pad codewords fill the remaining capacity.
  const pads = [0xec, 0x11];
  for (let i = 0; bitPos < capacity * 8; i++, bitPos += 8) {
    out[bitPos >> 3] = pads[i % 2];
  }
  return out;
}

/** Split into RS blocks, compute EC, and interleave both per the spec. */
function buildFinalSequence(data: Uint8Array, version: number): Uint8Array {
  const [ecPerBlock, groups] = BLOCKS_L[version - 1];
  const dataBlocks: Uint8Array[] = [];
  let offset = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i++) {
      dataBlocks.push(data.subarray(offset, offset + size));
      offset += size;
    }
  }
  const ecBlocks = dataBlocks.map((block) => rsComputeEC(block, ecPerBlock));

  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
  const out = new Uint8Array(data.length + ecPerBlock * dataBlocks.length);
  let pos = 0;
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) out[pos++] = block[i];
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) out[pos++] = block[i];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Matrix construction
// ---------------------------------------------------------------------------

/** Module grid under construction: null = still free for data bits. */
type Grid = Array<Array<boolean | null>>;

function placeFinderPatterns(grid: Grid, size: number): void {
  const corners: Array<[number, number]> = [[0, 0], [0, size - 7], [size - 7, 0]];
  for (const [top, left] of corners) {
    // 7×7 finder plus its 1-module separator ring.
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        const inFinder = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const dark =
          inFinder &&
          (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        grid[row][col] = dark;
      }
    }
  }
}

function placeTimingPatterns(grid: Grid, size: number): void {
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    if (grid[6][i] === null) grid[6][i] = dark;
    if (grid[i][6] === null) grid[i][6] = dark;
  }
}

function placeAlignmentPatterns(grid: Grid, version: number): void {
  const centres = ALIGNMENT[version - 1];
  for (const row of centres) {
    for (const col of centres) {
      // Skip the three positions that would overlap finder patterns.
      if (grid[row][col] !== null) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          grid[row + r][col + c] =
            Math.max(Math.abs(r), Math.abs(c)) !== 1;
        }
      }
    }
  }
}

/** Reserve format-info (and version-info for v≥7) areas so data skips them. */
function reserveInfoAreas(grid: Grid, size: number, version: number): void {
  for (let i = 0; i < 9; i++) {
    if (grid[8][i] === null) grid[8][i] = false;
    if (grid[i][8] === null) grid[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (grid[8][size - 1 - i] === null) grid[8][size - 1 - i] = false;
    if (grid[size - 1 - i][8] === null) grid[size - 1 - i][8] = false;
  }
  grid[size - 8][8] = true; // dark module
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const a = Math.floor(i / 3);
      const b = (i % 3) + size - 11;
      grid[a][b] = false;
      grid[b][a] = false;
    }
  }
}

/** The eight mask predicates (true = invert the data module). */
function maskAt(pattern: number, r: number, c: number): boolean {
  switch (pattern) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default: return (((r * c) % 3) + ((r + c) % 2)) % 2 === 0;
  }
}

/** Zigzag data placement (bottom-right, upward/downward column pairs). */
function placeData(grid: Grid, size: number, codewords: Uint8Array, mask: number): void {
  let byteIndex = 0;
  let bitIndex = 7;
  let upward = true;
  let row = size - 1;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // vertical timing pattern column is skipped whole
    for (;;) {
      for (let c = 0; c < 2; c++) {
        if (grid[row][col - c] !== null) continue;
        // Bits beyond the codeword stream (remainder bits) are zero.
        let dark = false;
        if (byteIndex < codewords.length) {
          dark = ((codewords[byteIndex] >> bitIndex) & 1) === 1;
        }
        if (maskAt(mask, row, col - c)) dark = !dark;
        grid[row][col - c] = dark;
        if (--bitIndex === -1) {
          byteIndex++;
          bitIndex = 7;
        }
      }
      row += upward ? -1 : 1;
      if (row < 0 || row >= size) {
        row += upward ? 1 : -1;
        upward = !upward;
        break;
      }
    }
  }
}

/** BCH(15,5) format information for level L (bits 01) and the given mask. */
function formatBits(mask: number): number {
  const data = (0b01 << 3) | mask;
  let rem = data << 10;
  for (let i = 4; i >= 0; i--) {
    if (rem & (1 << (i + 10))) rem ^= 0b10100110111 << i;
  }
  return ((data << 10) | rem) ^ 0b101010000010010;
}

/** BCH(18,6) version information for versions ≥ 7. */
function versionBits(version: number): number {
  let rem = version << 12;
  for (let i = 5; i >= 0; i--) {
    if (rem & (1 << (i + 12))) rem ^= 0b1111100100101 << i;
  }
  return (version << 12) | rem;
}

function placeFormatInfo(grid: Grid, size: number, mask: number): void {
  const bits = formatBits(mask);
  for (let i = 0; i < 15; i++) {
    const dark = ((bits >> i) & 1) === 1;
    // Copy around the top-left finder.
    if (i < 6) grid[i][8] = dark;
    else if (i < 8) grid[i + 1][8] = dark;
    else grid[size - 15 + i][8] = dark;
    // Second copy split across the top-right / bottom-left finders.
    if (i < 8) grid[8][size - 1 - i] = dark;
    else if (i < 9) grid[8][7] = dark;
    else grid[8][14 - i] = dark;
  }
  grid[size - 8][8] = true; // dark module, always
}

function placeVersionInfo(grid: Grid, size: number, version: number): void {
  if (version < 7) return;
  const bits = versionBits(version);
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >> i) & 1) === 1;
    const a = Math.floor(i / 3);
    const b = (i % 3) + size - 11;
    grid[a][b] = dark;
    grid[b][a] = dark;
  }
}

// ---------------------------------------------------------------------------
// Mask evaluation (the four penalty rules of the spec)
// ---------------------------------------------------------------------------

function penaltyScore(m: QRMatrix): number {
  const size = m.length;
  let score = 0;

  // Rule 1: runs of ≥5 same-coloured modules in a row/column.
  for (let axis = 0; axis < 2; axis++) {
    for (let i = 0; i < size; i++) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        const cur = axis === 0 ? m[i][j] : m[j][i];
        const prev = axis === 0 ? m[i][j - 1] : m[j - 1][i];
        if (cur === prev) {
          run++;
        } else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  }

  // Rule 2: 2×2 blocks of the same colour.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
    }
  }

  // Rule 3: finder-like pattern 1011101 with 4 light modules on either side.
  const isPattern = (get: (k: number) => boolean | undefined, j: number): boolean => {
    const core = [true, false, true, true, true, false, true];
    for (let k = 0; k < 7; k++) if (get(j + k) !== core[k]) return false;
    const lightBefore = [0, 1, 2, 3].every((k) => get(j - 4 + k) === false);
    const lightAfter = [0, 1, 2, 3].every((k) => get(j + 7 + k) === false);
    return lightBefore || lightAfter;
  };
  for (let i = 0; i < size; i++) {
    for (let j = 0; j <= size - 7; j++) {
      if (isPattern((k) => m[i][k], j)) score += 40;
      if (isPattern((k) => m[k]?.[i], j)) score += 40;
    }
  }

  // Rule 4: dark-module proportion deviation from 50%.
  let dark = 0;
  for (const row of m) for (const v of row) if (v) dark++;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encode `text` (UTF-8, byte mode, EC level L) into a QR module matrix.
 * Version is auto-selected; all eight masks are trialled and the one with
 * the lowest penalty score wins, as the spec prescribes.
 * Throws if the payload exceeds version 40 capacity (2953 bytes).
 */
export function encodeQR(text: string): QRMatrix {
  const bytes = new TextEncoder().encode(text);
  const version = pickVersion(bytes.length);
  const size = version * 4 + 17;

  const codewords = buildFinalSequence(buildDataCodewords(bytes, version), version);

  // Function patterns are identical for every mask — build them once.
  const base: Grid = Array.from({ length: size }, () => new Array<boolean | null>(size).fill(null));
  placeFinderPatterns(base, size);
  placeAlignmentPatterns(base, version);
  placeTimingPatterns(base, size);
  reserveInfoAreas(base, size, version);
  placeVersionInfo(base, size, version);

  let best: QRMatrix | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const grid: Grid = base.map((row) => row.slice());
    placeData(grid, size, codewords, mask);
    placeFormatInfo(grid, size, mask);
    const matrix = grid as QRMatrix; // every module is now decided
    const score = penaltyScore(matrix);
    if (score < bestScore) {
      bestScore = score;
      best = matrix;
    }
  }
  return best!;
}

/**
 * One SVG path covering all dark modules at unit scale (module = 1×1 at
 * integer coordinates). Render inside a viewBox that adds the 4-module
 * quiet zone, with `shape-rendering: crispEdges` for clean squares.
 * Horizontal runs are merged to keep the path string compact.
 */
export function matrixToSvgPath(matrix: QRMatrix): string {
  const parts: string[] = [];
  for (let r = 0; r < matrix.length; r++) {
    let c = 0;
    while (c < matrix.length) {
      if (!matrix[r][c]) {
        c++;
        continue;
      }
      let run = 1;
      while (c + run < matrix.length && matrix[r][c + run]) run++;
      parts.push(`M${c} ${r}h${run}v1h-${run}z`);
      c += run;
    }
  }
  return parts.join("");
}
