import { useState } from 'react';
import { Download, Unlock, Key, FileText, CheckCircle, ShieldAlert } from 'lucide-react';
import { decryptData, base64ToUint8Array } from '../lib/crypto';
import { extractDataFromImage } from '../lib/steganography';
import { supabase } from '../lib/supabase';

export default function Extract() {
  const [stegoImage, setStegoImage] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extractedFile, setExtractedFile] = useState<{ name: string; data: ArrayBuffer; type: 'real' | 'decoy' } | null>(null);

  const handleExtract = async () => {
    if (!stegoImage || !password) {
      setError('Please select an image and enter a password');
      return;
    }

    setError('');
    setLoading(true);
    setExtractedFile(null);

    try {
      // 1. Read the image pixels to find the Hidden ID and Encrypted Blobs
      const { imageId, realFile, decoyFile } = await extractDataFromImage(stegoImage);

      // 2. Fetch the "Keys" (Salts/IVs) from the Vault using the ID
      // This is the "Zero Knowledge" check. If the server wiped the data, this fails.
      const { data: metadata, error: dbError } = await supabase
        .from('stego_images')
        .select('real_salt, real_iv, duress_salt, duress_iv')
        .eq('id', imageId)
        .single();

      if (dbError || !metadata) {
        throw new Error('Security check failed: This file has been burned or is invalid.');
      }

      let decryptedData: ArrayBuffer | null = null;
      let filename = '';
      let type: 'real' | 'decoy' = 'real';

      // 3. AUTOMATICALLY TRY: Is it the Real Password?
      try {
        decryptedData = await decryptData(
          realFile.data,
          password,
          base64ToUint8Array(metadata.real_salt),
          base64ToUint8Array(metadata.real_iv)
        );
        filename = realFile.name;
        type = 'real';
      } catch (e) {
        // If Real failed, silently fail and try Duress
      }

      // 4. AUTOMATICALLY TRY: Is it the Duress Password?
      if (!decryptedData) {
        try {
          decryptedData = await decryptData(
            decoyFile.data,
            password,
            base64ToUint8Array(metadata.duress_salt),
            base64ToUint8Array(metadata.duress_iv)
          );
          filename = decoyFile.name;
          type = 'decoy';
        } catch (e) {
          // Both failed
        }
      }

      if (!decryptedData) {
        throw new Error('Invalid password.');
      }

      setExtractedFile({ name: filename, data: decryptedData, type });

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!extractedFile) return;
    const blob = new Blob([extractedFile.data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = extractedFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-6">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Unlock className="w-6 h-6 text-blue-400" />
          Extract Hidden Files
        </h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              <FileText className="inline w-4 h-4 mr-2" />
              Stego Image
            </label>
            <input
              type="file"
              accept="image/png"
              onChange={(e) => setStegoImage(e.target.files?.[0] || null)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              <Key className="inline w-4 h-4 mr-2" />
              Enter Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Enter either Real or Duress password..."
            />
            <p className="mt-2 text-xs text-slate-500">
              The system will automatically detect which file to unlock.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {extractedFile && (
            <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-green-400 font-medium mb-1">
                    Success! Unlocked {extractedFile.type === 'real' ? 'Primary' : 'Decoy'} File.
                  </p>
                  <p className="text-sm text-slate-300">{extractedFile.name}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleExtract}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-6 rounded-lg transition-all disabled:opacity-50 shadow-lg"
            >
              {loading ? 'Verifying & Decrypting...' : 'Unlock File'}
            </button>

            {extractedFile && (
              <button
                onClick={handleDownload}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-4 px-6 rounded-lg transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
