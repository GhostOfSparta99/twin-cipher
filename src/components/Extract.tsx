import { useState } from 'react';
import { Download, Unlock, Key, CheckCircle, ShieldAlert } from 'lucide-react';
import { decryptData, base64ToUint8Array } from '../lib/crypto';
import { extractDataFromImage } from '../lib/steganography';
import { supabase } from '../lib/supabase';
import DragDropZone from './DragDropZone'; // Import

export default function Extract() {
  const [stegoImage, setStegoImage] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extractedFile, setExtractedFile] = useState<{ name: string; data: ArrayBuffer; type: 'real' | 'decoy' } | null>(null);

  const handleExtract = async () => {
    if (!stegoImage || !password) { setError('Missing inputs'); return; }
    setError(''); setLoading(true); setExtractedFile(null);

    try {
      // 1. Read image pixel data
      const { imageId, realFile, decoyFile } = await extractDataFromImage(stegoImage);

      // 2. Fetch keys from Vault (Zero-Knowledge Check)
      const { data: meta, error: dbErr } = await supabase
        .from('stego_images').select('real_salt, real_iv, duress_salt, duress_iv')
        .eq('id', imageId).single();

      if (dbErr || !meta) throw new Error('Security metadata not found. File may be compromised or deleted.');

      // 3. Try Real Password
      try {
        const decrypted = await decryptData(realFile.data, password, base64ToUint8Array(meta.real_salt), base64ToUint8Array(meta.real_iv));
        setExtractedFile({ name: realFile.name, data: decrypted, type: 'real' });
        return;
      } catch { }

      // 4. Try Duress Password
      try {
        const decrypted = await decryptData(decoyFile.data, password, base64ToUint8Array(meta.duress_salt), base64ToUint8Array(meta.duress_iv));
        setExtractedFile({ name: decoyFile.name, data: decrypted, type: 'decoy' });
        return;
      } catch { }

      throw new Error('Invalid password.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!extractedFile) return;
    const url = URL.createObjectURL(new Blob([extractedFile.data]));
    const a = document.createElement('a');
    a.href = url; a.download = extractedFile.name; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-6 space-y-8">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Unlock className="w-6 h-6 text-blue-400" /> Extract Hidden Files
      </h2>

      <div className="space-y-6">
        <DragDropZone
          label="Upload Stego Image (PNG)"
          accept="image/png"
          file={stegoImage}
          onFileSelect={setStegoImage}
          color="blue"
        />

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2"><Key className="inline w-4 h-4 mr-2" />Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white outline-none focus:ring-2 focus:ring-blue-600"
            placeholder="Enter Real or Duress password"
          />
        </div>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> {error}</div>}

        {extractedFile && (
          <div className={`p-4 rounded-lg border flex items-center gap-3 ${extractedFile.type === 'real' ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-amber-500/10 border-amber-500/50 text-amber-400'}`}>
            <CheckCircle className="w-5 h-5" />
            <div>
              <p className="font-bold">Unlocked {extractedFile.type === 'real' ? 'Secret' : 'Decoy'} File</p>
              <p className="text-xs opacity-80">{extractedFile.name}</p>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <button onClick={handleExtract} disabled={loading} className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50">
            {loading ? 'Decrypting...' : 'Unlock'}
          </button>
          {extractedFile && (
            <button onClick={handleDownload} className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
              <Download className="w-5 h-5" /> Download
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
