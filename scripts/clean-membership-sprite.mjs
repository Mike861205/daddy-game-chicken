import { resolve } from 'node:path';
import sharp from 'sharp';

const [inputArgument, outputArgument = inputArgument] = process.argv.slice(2);

if (!inputArgument) {
  throw new Error('Uso: node scripts/clean-membership-sprite.mjs <entrada> [salida]');
}

const input = resolve(inputArgument);
const output = resolve(outputArgument);
const frameSize = 512;
const columns = 3;
const rows = 2;
const frames = [];

for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const { data, info } = await sharp(input)
      .extract({
        left: column * frameSize,
        top: row * frameSize,
        width: frameSize,
        height: frameSize,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixelCount = info.width * info.height;
    const visited = new Uint8Array(pixelCount);
    const queue = new Int32Array(pixelCount);
    let largest = [];

    for (let start = 0; start < pixelCount; start += 1) {
      if (visited[start] || data[start * 4 + 3] <= 20) continue;
      let head = 0;
      let tail = 0;
      const component = [];
      visited[start] = 1;
      queue[tail] = start;
      tail += 1;

      while (head < tail) {
        const pixel = queue[head];
        head += 1;
        component.push(pixel);
        const x = pixel % frameSize;
        const y = Math.floor(pixel / frameSize);
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (offsetX === 0 && offsetY === 0) continue;
            const nextX = x + offsetX;
            const nextY = y + offsetY;
            if (nextX < 0 || nextX >= frameSize || nextY < 0 || nextY >= frameSize) continue;
            const next = nextY * frameSize + nextX;
            if (visited[next] || data[next * 4 + 3] <= 20) continue;
            visited[next] = 1;
            queue[tail] = next;
            tail += 1;
          }
        }
      }

      if (component.length > largest.length) largest = component;
    }

    const keep = new Uint8Array(pixelCount);
    largest.forEach((pixel) => {
      keep[pixel] = 1;
    });
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      if (keep[pixel]) continue;
      const offset = pixel * 4;
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }

    const frame = await sharp(data, {
      raw: { width: frameSize, height: frameSize, channels: 4 },
    })
      .png()
      .toBuffer();
    frames.push({
      input: frame,
      left: column * frameSize,
      top: row * frameSize,
    });
  }
}

await sharp({
  create: {
    width: columns * frameSize,
    height: rows * frameSize,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(frames)
  .png()
  .toFile(output === input ? `${output}.clean.png` : output);

if (output === input) {
  throw new Error('Para evitar sobrescrituras, indica una ruta de salida distinta.');
}

