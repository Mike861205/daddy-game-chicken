import { resolve } from 'node:path';
import sharp from 'sharp';

const [inputArgument, outputArgument] = process.argv.slice(2);

if (!inputArgument || !outputArgument) {
  throw new Error('Uso: node scripts/normalize-membership-pose.mjs <entrada> <salida>');
}

const input = resolve(inputArgument);
const output = resolve(outputArgument);
const frameSize = 512;
const padding = 12;

const character = await sharp(input)
  .trim({ background: '#00ff00', threshold: 42 })
  .resize(frameSize - padding * 2, frameSize - padding * 2, {
    fit: 'contain',
    background: '#00ff00',
  })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: frameSize,
    height: frameSize,
    channels: 3,
    background: '#00ff00',
  },
})
  .composite([{ input: character, left: padding, top: padding }])
  .png()
  .toFile(output);
