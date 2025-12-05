export async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(
  data: ArrayBuffer,
  password: string,
  salt?: Uint8Array,
  iv?: Uint8Array
): Promise<{
  encrypted: ArrayBuffer;
  salt: Uint8Array;
  iv: Uint8Array;
}> {
  const actualSalt = salt || crypto.getRandomValues(new Uint8Array(16));
  const actualIv = iv || crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(password, actualSalt);

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: actualIv,
    },
    key,
    data
  );

  return {
    encrypted,
    salt: actualSalt,
    iv: actualIv,
  };
}

export async function decryptData(
  encryptedData: ArrayBuffer,
  password: string,
  salt: Uint8Array,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  const key = await deriveKey(password, salt);

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encryptedData
    );
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed: Invalid password or corrupted data');
  }
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function uint8ArrayToBase64(arr: Uint8Array): string {
  return arrayBufferToBase64(arr.buffer);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(base64ToArrayBuffer(base64));
}
