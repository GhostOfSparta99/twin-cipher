export async function embedDataInImage(
  coverImage: File,
  realFileData: ArrayBuffer,
  decoyFileData: ArrayBuffer,
  realFileName: string,
  decoyFileName: string
): Promise<Blob> {
  const img = await loadImage(coverImage);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  
  // Optimization: Hint to browser that we will read pixel data frequently
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');

  // FIX 1: Fill with black first to prevent transparency corruption
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  // FIX 2: Force full opacity (Alpha = 255)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i + 3] = 255;
  }

  const realBytes = new Uint8Array(realFileData);
  const decoyBytes = new Uint8Array(decoyFileData);

  const realFileNameBytes = new TextEncoder().encode(realFileName);
  const decoyFileNameBytes = new TextEncoder().encode(decoyFileName);

  const headerBytes = new Uint8Array([
    ...intToBytes(realFileNameBytes.length, 2),
    ...realFileNameBytes,
    ...intToBytes(realBytes.length, 4),
    ...intToBytes(decoyFileNameBytes.length, 2),
    ...decoyFileNameBytes,
    ...intToBytes(decoyBytes.length, 4),
  ]);

  const totalData = new Uint8Array([
    ...headerBytes,
    ...realBytes,
    ...decoyBytes,
  ]);

  const maxCapacity = Math.floor((pixels.length / 4) * 3);
  if (totalData.length > maxCapacity) {
    throw new Error(
      `Image too small. Need ${totalData.length} bytes but only ${maxCapacity} bytes available.`
    );
  }

  let byteIndex = 0;
  let bitIndex = 0;

  for (let i = 0; i < pixels.length && byteIndex < totalData.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      if (byteIndex >= totalData.length) break;

      const currentByte = totalData[byteIndex];
      const bit = (currentByte >> (7 - bitIndex)) & 1;

      pixels[i + channel] = (pixels[i + channel] & 0xfe) | bit;

      bitIndex++;
      if (bitIndex === 8) {
        bitIndex = 0;
        byteIndex++;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      },
      'image/png'
    );
  });
}

export async function extractDataFromImage(
  stegoImage: File
): Promise<{
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

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  let byteIndex = 0;
  let bitIndex = 0;

  const extractBytes = (count: number) => {
    const bytes: number[] = [];
    for (let i = 0; i < count; i++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const pixelIndex = Math.floor((byteIndex * 8 + bitIndex) / 3) * 4;
        const channelIndex = (byteIndex * 8 + bitIndex) % 3;

        if (pixelIndex >= pixels.length) {
          throw new Error('Unexpected end of data: The image does not contain valid data.');
        }

        const lsb = pixels[pixelIndex + channelIndex] & 1;
        byte = (byte << 1) | lsb;

        bitIndex++;
        if (bitIndex === 8) {
          bitIndex = 0;
          byteIndex++;
        }
      }
      bytes.push(byte);
    }
    return bytes;
  };

  try {
    const realFileNameLengthBytes = extractBytes(2);
    const realFileNameLength = bytesToInt(realFileNameLengthBytes);

    if (realFileNameLength <= 0 || realFileNameLength > 2000) {
       throw new Error(`Invalid real filename length: ${realFileNameLength}`);
    }

    const realFileNameBytes = extractBytes(realFileNameLength);
    const realFileName = new TextDecoder().decode(new Uint8Array(realFileNameBytes));

    const realFileSizeBytes = extractBytes(4);
    const realFileSize = bytesToInt(realFileSizeBytes);

    const decoyFileNameLengthBytes = extractBytes(2);
    const decoyFileNameLength = bytesToInt(decoyFileNameLengthBytes);

    if (decoyFileNameLength <= 0 || decoyFileNameLength > 2000) {
       throw new Error(`Invalid decoy filename length: ${decoyFileNameLength}`);
    }

    const decoyFileNameBytes = extractBytes(decoyFileNameLength);
    const decoyFileName = new TextDecoder().decode(new Uint8Array(decoyFileNameBytes));

    const decoyFileSizeBytes = extractBytes(4);
    const decoyFileSize = bytesToInt(decoyFileSizeBytes);

    const realFileData = new Uint8Array(extractBytes(realFileSize));
    const decoyFileData = new Uint8Array(extractBytes(decoyFileSize));

    return {
      realFile: { name: realFileName, data: realFileData.buffer },
      decoyFile: { name: decoyFileName, data: decoyFileData.buffer },
    };
  } catch (err) {
    console.error("Extraction error:", err);
    throw err;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// *** CRITICAL FIX HERE: Changed .unshift() to .push() ***
function intToBytes(num: number, byteCount: number): number[] {
  const bytes: number[] = [];
  for (let i = byteCount - 1; i >= 0; i--) {
    bytes.push((num >> (i * 8)) & 0xff); 
  }
  return bytes;
}

function bytesToInt(bytes: number[]): number {
  let num = 0;
  for (let i = 0; i < bytes.length; i++) {
    num = (num << 8) | bytes[i];
  }
  return num >>> 0;
}