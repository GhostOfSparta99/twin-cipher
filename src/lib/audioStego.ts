// Helper: Convert UUID to bytes
function uuidToBytes(uuid: string): Uint8Array {
    return new TextEncoder().encode(uuid);
}

// Helper: Convert Number to Bytes
function intToBytes(num: number, byteCount: number): number[] {
    const bytes: number[] = [];
    for (let i = byteCount - 1; i >= 0; i--) bytes.push((num >> (i * 8)) & 0xff);
    return bytes;
}

// Helper: Convert Bytes to Number
function bytesToInt(bytes: number[]): number {
    let num = 0;
    for (let i = 0; i < bytes.length; i++) num = (num << 8) | bytes[i];
    return num >>> 0;
}

// Helper: Find the 'data' chunk in a WAV file
function findDataChunk(view: DataView): { start: number; size: number } {
    let offset = 12; // Skip RIFF header
    while (offset < view.byteLength) {
        const chunkId = String.fromCharCode(
            view.getUint8(offset), view.getUint8(offset + 1),
            view.getUint8(offset + 2), view.getUint8(offset + 3)
        );
        const chunkSize = view.getUint32(offset + 4, true); // WAV is Little Endian

        if (chunkId === 'data') {
            return { start: offset + 8, size: chunkSize };
        }
        offset += 8 + chunkSize;
    }
    throw new Error('Invalid WAV file: No data chunk found');
}

export async function embedInAudio(
    coverAudio: File,
    realFileData: ArrayBuffer,
    decoyFileData: ArrayBuffer,
    realFileName: string,
    decoyFileName: string,
    fileId: string
): Promise<Blob> {
    const buffer = await coverAudio.arrayBuffer();
    const view = new DataView(buffer);
    const { start, size } = findDataChunk(view);

    // We work with a Uint8Array of the entire file to modify bytes
    const bytes = new Uint8Array(buffer);

    // Prepare Payload
    const realBytes = new Uint8Array(realFileData);
    const decoyBytes = new Uint8Array(decoyFileData);
    const realNameBytes = new TextEncoder().encode(realFileName);
    const decoyNameBytes = new TextEncoder().encode(decoyFileName);
    const idBytes = uuidToBytes(fileId);

    const payload = new Uint8Array([
        ...idBytes,
        ...intToBytes(realNameBytes.length, 2), ...realNameBytes,
        ...intToBytes(realBytes.length, 4),
        ...intToBytes(decoyNameBytes.length, 2), ...decoyNameBytes,
        ...intToBytes(decoyBytes.length, 4),
        ...realBytes,
        ...decoyBytes
    ]);

    // Capacity Check (16-bit audio = 2 bytes per sample. We use LSB of the LOWER byte)
    // This means we have 1 bit per sample, or 1 bit per 2 bytes of data.
    // Capacity in bytes = (AudioDataSize / 2) / 8
    const maxCapacity = Math.floor((size / 2) / 8);

    if (payload.length > maxCapacity) {
        throw new Error(`Audio file too short. Need ${payload.length} bytes, have ${maxCapacity} bytes capacity.`);
    }

    // Embed
    let payloadBitIndex = 0;
    let payloadByteIndex = 0;

    // Loop through audio data (16-bit samples -> skip 2 bytes at a time)
    // We modify the EVEN byte (Low Byte) to change LSB without audible distortion
    for (let i = start; i < start + size; i += 2) {
        if (payloadByteIndex >= payload.length) break;

        const bit = (payload[payloadByteIndex] >> (7 - payloadBitIndex)) & 1;

        // Clear LSB and set new bit
        bytes[i] = (bytes[i] & 0xfe) | bit;

        payloadBitIndex++;
        if (payloadBitIndex === 8) {
            payloadBitIndex = 0;
            payloadByteIndex++;
        }
    }

    return new Blob([bytes], { type: 'audio/wav' });
}

export async function extractFromAudio(stegoAudio: File): Promise<{
    fileId: string;
    realFile: { name: string; data: ArrayBuffer };
    decoyFile: { name: string; data: ArrayBuffer };
}> {
    const buffer = await stegoAudio.arrayBuffer();
    const view = new DataView(buffer);
    const { start, size } = findDataChunk(view);
    const bytes = new Uint8Array(buffer);

    let readIndex = start; // Position in WAV data

    // Helper to read N bytes from the LSBs
    const readBytes = (count: number) => {
        const result: number[] = [];
        for (let i = 0; i < count; i++) {
            let value = 0;
            for (let b = 0; b < 8; b++) {
                if (readIndex >= start + size) throw new Error('Unexpected end of audio data');

                const bit = bytes[readIndex] & 1;
                value = (value << 1) | bit;

                readIndex += 2; // Jump to next 16-bit sample
            }
            result.push(value);
        }
        return result;
    };

    try {
        // 1. Read UUID (36 bytes)
        const idBytes = readBytes(36);
        const fileId = new TextDecoder().decode(new Uint8Array(idBytes));

        // 2. Read Real File Info
        const realNameLen = bytesToInt(readBytes(2));
        const realName = new TextDecoder().decode(new Uint8Array(readBytes(realNameLen)));
        const realSize = bytesToInt(readBytes(4));

        // 3. Read Decoy File Info
        const decoyNameLen = bytesToInt(readBytes(2));
        const decoyName = new TextDecoder().decode(new Uint8Array(readBytes(decoyNameLen)));
        const decoySize = bytesToInt(readBytes(4));

        // 4. Read Data
        const realData = new Uint8Array(readBytes(realSize)).buffer;
        const decoyData = new Uint8Array(readBytes(decoySize)).buffer;

        return {
            fileId,
            realFile: { name: realName, data: realData },
            decoyFile: { name: decoyName, data: decoyData }
        };
    } catch (err) {
        throw new Error('Failed to extract from audio. File may be corrupted or not a valid StegoVault audio.');
    }
}
