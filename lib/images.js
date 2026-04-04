const sharp = require('sharp');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

async function getImageBuffer(message, args) {
  const attachment = message.attachments.first();
  if (attachment && attachment.contentType?.startsWith('image/')) {
    const res = await fetch(attachment.url);
    return Buffer.from(await res.arrayBuffer());
  }

  const url = args.find((a) => /^https?:\/\/.+/i.test(a));
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image (HTTP ${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  if (message.reference) {
    try {
      const replied = await message.channel.messages.fetch(message.reference.messageId);
      const repliedAttachment = replied.attachments.first();
      if (repliedAttachment && repliedAttachment.contentType?.startsWith('image/')) {
        const res = await fetch(repliedAttachment.url);
        return Buffer.from(await res.arrayBuffer());
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}

async function imageToGif(buffer) {
  const size = 256;
  const numFrames = 16;
  const gif = GIFEncoder();

  for (let i = 0; i < numFrames; i++) {
    const t = i / numFrames;
    const brightness = 0.75 + 0.4 * Math.sin(t * Math.PI * 2);
    const hue = Math.round(t * 120);

    const { data } = await sharp(buffer)
      .resize(size, size, { fit: 'cover' })
      .modulate({ brightness, hue })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rgba = new Uint8Array(size * size * 4);
    for (let j = 0; j < size * size; j++) {
      rgba[j * 4] = data[j * 3];
      rgba[j * 4 + 1] = data[j * 3 + 1];
      rgba[j * 4 + 2] = data[j * 3 + 2];
      rgba[j * 4 + 3] = 255;
    }

    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, size, size, { palette, delay: 80 });
  }

  gif.finish();
  return Buffer.from(gif.bytes());
}

async function deepfryImage(buffer) {
  const jpeg = await sharp(buffer)
    .resize(512, 512, { fit: 'inside' })
    .modulate({ saturation: 3.5, brightness: 1.3 })
    .sharpen({ sigma: 5 })
    .jpeg({ quality: 3 })
    .toBuffer();

  return sharp(jpeg).modulate({ saturation: 2.5 }).sharpen({ sigma: 4 }).png().toBuffer();
}

async function invertImage(buffer) {
  return sharp(buffer).resize(512, 512, { fit: 'inside' }).negate({ alpha: false }).png().toBuffer();
}

async function blurImage(buffer) {
  return sharp(buffer).resize(512, 512, { fit: 'inside' }).blur(15).png().toBuffer();
}

async function pixelateImage(buffer) {
  return sharp(buffer)
    .resize(24, 24, { fit: 'cover' })
    .resize(512, 512, { fit: 'cover', kernel: 'nearest' })
    .png()
    .toBuffer();
}

module.exports = {
  getImageBuffer,
  imageToGif,
  deepfryImage,
  invertImage,
  blurImage,
  pixelateImage,
};
