// src/lib/steganography.ts

// Helper: Convert UUID string to byte array
function uuidToBytes(uuid: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(uuid); // UUID is 36 bytes
}

export async function embedDataInImage(
  coverImage: File,
  realFileData: ArrayBuffer,
  decoyFileData: ArrayBuffer,
  realFileName: string,
  decoyFileName: string,
  imageId: string // <--- NEW: We embed the Database ID
): Promise<Blob> {
  const img = await loadImage(coverImage);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');

  // Sanitize canvas
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  // Force opacity
  for (let i = 0; i < pixels.length; i += 4) pixels[i + 3] = 255;

  const realBytes = new Uint8Array(realFileData);
  const decoyBytes = new Uint8Array(decoyFileData);
  const realFileNameBytes = new TextEncoder().encode(realFileName);
  const decoyFileNameBytes = new TextEncoder().encode(decoyFileName);
  const uuidBytes = uuidToBytes(imageId); // 36 bytes

  // Header Structure: [UUID (36)] + [RealNameLen(2)] + [RealName] + [RealSize(4)] + ...
  const headerBytes = new Uint8Array([
    ...uuidBytes,
    ...intToBytes(realFileNameBytes.length, 2),
    ...realFileNameBytes,
    ...intToBytes(realBytes.length, 4),
    ...intToBytes(decoyFileNameBytes.length, 2),
    ...decoyFileNameBytes,
    ...intToBytes(decoyBytes.length, 4),
  ]);

  const totalData = new Uint8Array([...headerBytes, ...realBytes, ...decoyBytes]);

  const maxCapacity = Math.floor((pixels.length / 4) * 3);
  if (totalData.length > maxCapacity) {
    throw new Error(`Image too small. Required: ${totalData.length} bytes, Available: ${maxCapacity} bytes.`);
  }

  // Embed Data
  let byteIndex = 0;
  let bitIndex = 0;

  for (let i = 0; i < pixels.length && byteIndex < totalData.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      if (byteIndex >= totalData.length) break;
      const bit = (totalData[byteIndex] >> (7 - bitIndex)) & 1;
      pixels[i + channel] = (pixels[i + channel] & 0xfe) | bit;
      bitIndex++;
      if (bitIndex === 8) {
        bitIndex = 0;
        byteIndex++;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), 'image/png'));
}

export async function extractDataFromImage(stegoImage: File): Promise<{
  imageId: string; // <--- Returns the ID to fetch metadata
  realFile: { name: string; data: ArrayBuffer };
  decoyFile: { name: string; data: ArrayBuffer };
}> {
  const img = await loadImage(stegoImage);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(img, 0, 0);

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let byteIndex = 0;
  let bitIndex = 0;

  const readBytes = (count: number) => {
    const bytes: number[] = [];
    for (let i = 0; i < count; i++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const pixelIdx = Math.floor((byteIndex * 8 + bitIndex) / 3) * 4;
        const channel = (byteIndex * 8 + bitIndex) % 3;
        if (pixelIdx >= pixels.length) throw new Error('Image corrupted or data missing');

        if (pixels[pixelIdx + channel] & 1) byte |= (1 << (7 - bit));

        bitIndex++;
        if (bitIndex === 8) { bitIndex = 0; byteIndex++; }
      }
      bytes.push(byte);
    }
    return bytes;
  };

  try {
    // 1. Read UUID (First 36 bytes)
    const uuidBytes = readBytes(36);
    const imageId = new TextDecoder().decode(new Uint8Array(uuidBytes));

    // 2. Read Real File Info
    const realNameLen = bytesToInt(readBytes(2));
    const realName = new TextDecoder().decode(new Uint8Array(readBytes(realNameLen)));
    const realSize = bytesToInt(readBytes(4));

    // 3. Read Decoy File Info
    const decoyNameLen = bytesToInt(readBytes(2));
    const decoyName = new TextDecoder().decode(new Uint8Array(readBytes(decoyNameLen)));
    const decoySize = bytesToInt(readBytes(4));

    // 4. Read File Data
    const realData = new Uint8Array(readBytes(realSize)).buffer;
    const decoyData = new Uint8Array(readBytes(decoySize)).buffer;

    return {
      imageId,
      realFile: { name: realName, data: realData },
      decoyFile: { name: decoyName, data: decoyData }
    };
  } catch (err) {
    throw new Error("Failed to read steganography data. Image might be invalid.");
  }
}

// Helpers
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function intToBytes(num: number, byteCount: number): number[] {
  const bytes: number[] = [];
  for (let i = byteCount - 1; i >= 0; i--) bytes.push((num >> (i * 8)) & 0xff);
  return bytes;
}

function bytesToInt(bytes: number[]): number {
  let num = 0;
  for (let i = 0; i < bytes.length; i++) num = (num << 8) | bytes[i];
  return num >>> 0;
}
