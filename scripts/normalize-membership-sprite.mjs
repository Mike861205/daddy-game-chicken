import { resolve } from 'node:path';
import sharp from 'sharp';

const [inputArgument, outputArgument] = process.argv.slice(2);

if (!inputArgument || !outputArgument) {
  throw new Error('Uso: node scripts/normalize-membership-sprite.mjs <entrada> <salida>');
}

const input = resolve(inputArgument);
const output = resolve(outputArgument);
const columns = 3;
const rows = 2;
const frameSize = 512;
const padding = 18;
const metadata = await sharp(input).metadata();

if (!metadata.width || !metadata.height) {
  throw new Error(`No fue posible leer las dimensiones de ${input}`);
}

const cellWidth = Math.floor(metadata.width / columns);
const cellHeight = Math.floor(metadata.height / rows);
const frames = [];

for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const left = column * cellWidth;
    const top = row * cellHeight;
    const width = column === columns - 1 ? metadata.width - left : cellWidth;
    const height = row === rows - 1 ? metadata.height - top : cellHeight;
    const extractedCell = await sharp(input)
      .extract({ left, top, width, height })
      .png()
      .toBuffer();
    const frame = await sharp(extractedCell)
      .trim({ background: '#00ff00', threshold: 42 })
      .resize(frameSize - padding * 2, frameSize - padding * 2, {
        fit: 'contain',
        background: '#00ff00',
      })
      .png()
      .toBuffer();

    frames.push({
      input: frame,
      left: column * frameSize + padding,
      top: row * frameSize + padding,
    });
  }
}

await sharp({
  create: {
    width: columns * frameSize,
    height: rows * frameSize,
    channels: 3,
    background: '#00ff00',
  },
})
  .composite(frames)
  .png()
  .toFile(output);
