import { useState } from 'react';
import { Download, Unlock, Key, FileText, CheckCircle } from 'lucide-react';
import { decryptData, base64ToUint8Array } from '../lib/crypto';
import { extractDataFromImage } from '../lib/steganography';

export default function Extract() {
  const [stegoImage, setStegoImage] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extractedFile, setExtractedFile] = useState<{
    name: string;
    data: ArrayBuffer;
  } | null>(null);

  const handleExtract = async () => {
    if (!stegoImage || !password) {
      setError('Please select an image and enter a password');
      return;
    }

    setError('');
    setLoading(true);
    setExtractedFile(null);

    try {
      const { realFile, decoyFile } = await extractDataFromImage(stegoImage);

      let decrypted: ArrayBuffer | null = null;
      let fileName = '';

      try {
        const realSaltInput = prompt('Enter real salt (base64):');
        const realIvInput = prompt('Enter real IV (base64):');

        if (realSaltInput && realIvInput) {
          decrypted = await decryptData(
            realFile.data,
            password,
            base64ToUint8Array(realSaltInput),
            base64ToUint8Array(realIvInput)
          );
          fileName = realFile.name;
        }
      } catch {
        const duressSaltInput = prompt('Enter duress salt (base64):');
        const duressIvInput = prompt('Enter duress IV (base64):');

        if (duressSaltInput && duressIvInput) {
          decrypted = await decryptData(
            decoyFile.data,
            password,
            base64ToUint8Array(duressSaltInput),
            base64ToUint8Array(duressIvInput)
          );
          fileName = decoyFile.name;
        }
      }

      if (!decrypted) {
        throw new Error('Decryption failed: Invalid password or missing salt/IV');
      }

      setExtractedFile({ name: fileName, data: decrypted });
    } catch (err) {
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
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {stegoImage && (
              <p className="mt-2 text-sm text-slate-400">{stegoImage.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              <Key className="inline w-4 h-4 mr-2" />
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Enter real or duress password"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {extractedFile && (
            <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-green-400 font-medium mb-1">
                    File extracted successfully!
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
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {loading ? 'Extracting...' : 'Extract File'}
            </button>

            {extractedFile && (
              <button
                onClick={handleDownload}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-4 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-amber-400 mb-2">
          Important Notes
        </h3>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>• Enter either your real or duress password to extract the corresponding file</li>
          <li>• You will need the salt and IV values (stored in your vault metadata)</li>
          <li>• The system cannot distinguish which password you entered</li>
          <li>• All decryption happens locally in your browser</li>
        </ul>
      </div>
    </div>
  );
}
