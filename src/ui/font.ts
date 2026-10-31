// A 5x7 bitmap font drawn for this game. Each glyph is seven rows of five bits.
const GLYPHS: Record<string, readonly number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 14], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 27, 17], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14], '2': [14, 17, 1, 6, 8, 16, 31],
  '3': [30, 1, 1, 14, 1, 1, 30], '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8], '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], ':': [0, 12, 12, 0, 12, 12, 0],
  '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 6, 4, 0, 4], '-': [0, 0, 0, 31, 0, 0, 0],
  '+': [0, 4, 4, 31, 4, 4, 0], '/': [1, 1, 2, 4, 8, 16, 16], "'": [4, 4, 8, 0, 0, 0, 0],
  '"': [10, 10, 0, 0, 0, 0, 0], '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8],
  '%': [24, 25, 2, 4, 8, 19, 3], '#': [10, 10, 31, 10, 31, 10, 10], '*': [0, 10, 4, 31, 4, 10, 0],
  '=': [0, 0, 31, 0, 31, 0, 0], _: [0, 0, 0, 0, 0, 0, 31], '<': [2, 4, 8, 16, 8, 4, 2],
  '>': [8, 4, 2, 1, 2, 4, 8], '&': [12, 18, 20, 8, 21, 18, 13], '@': [14, 17, 23, 21, 23, 16, 15],
};

export const GLYPH_W = 6;
export const GLYPH_H = 8;

export function textWidth(text: string, scale = 1): number {
  return Math.max(0, text.length * GLYPH_W * scale - scale);
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
): void {
  ctx.fillStyle = color;
  const left = Math.round(x);
  const top = Math.round(y);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]?.toUpperCase() ?? ' ';
    if (ch === ' ') continue;
    const rows = GLYPHS[ch] ?? GLYPHS['?'] as readonly number[];
    for (let row = 0; row < 7; row++) {
      const bits = rows[row] as number;
      for (let col = 0; col < 5; col++) {
        if (bits & (1 << (4 - col))) {
          ctx.fillRect(left + (i * GLYPH_W + col) * scale, top + row * scale, scale, scale);
        }
      }
    }
  }
}

export function drawTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  color: string,
  scale = 1,
): void {
  drawText(ctx, text, cx - textWidth(text, scale) / 2, y, color, scale);
}

// Keeps text off the edge of a narrow phone screen.
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
