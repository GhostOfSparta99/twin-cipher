import { useState, useEffect } from 'react';
import { Upload, HardDrive, Lock, Key, FileText, AlertTriangle } from 'lucide-react';
import { encryptData, uint8ArrayToBase64 } from '../lib/crypto';
import { embedDataInImage } from '../lib/steganography';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DragDropZone from './DragDropZone'; // IMPORT THIS

export default function Embed() {
  const { user } = useAuth();
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [secretFile, setSecretFile] = useState<File | null>(null);
  const [decoyFile, setDecoyFile] = useState<File | null>(null);
  const [realPassword, setRealPassword] = useState('');
  const [duressPassword, setDuressPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [capacity, setCapacity] = useState({ total: 0, used: 0, percent: 0 });

  // Recalculate capacity when files change
  useEffect(() => {
    const calc = async () => {
      if (!coverImage) { setCapacity({ total: 0, used: 0, percent: 0 }); return; }
      const img = new Image();
      img.src = URL.createObjectURL(coverImage);
      await img.decode();

      const totalBytes = Math.floor((img.width * img.height * 3) / 8);
      const overhead = 200; // Header bytes
      const usedBytes = overhead + (secretFile?.size || 0) + (decoyFile?.size || 0);

      setCapacity({
        total: totalBytes,
        used: usedBytes,
        percent: (usedBytes / totalBytes) * 100
      });
    };
    calc();
  }, [coverImage, secretFile, decoyFile]);

  const formatBytes = (b: number) => {
    if (b === 0) return '0 B';
    const i = Math.floor(Math.log(b) / Math.log(1024));
    return `${(b / Math.pow(1024, i)).toFixed(2)} ${['B', 'KB', 'MB', 'GB'][i]}`;
  };

  const handleEmbed = async () => {
    if (!coverImage || !secretFile || !decoyFile || !realPassword || !duressPassword) {
      setError('Please fill in all fields'); return;
    }
    if (realPassword === duressPassword) {
      setError('Passwords must be different'); return;
    }
    if (capacity.percent > 100) {
      setError('Files too large for this image'); return;
    }

    setError(''); setLoading(true); setSuccess(false);

    try {
      const secretData = await secretFile.arrayBuffer();
      const decoyData = await decoyFile.arrayBuffer();
      const imageId = crypto.randomUUID();

      const { encrypted: encReal, salt: s1, iv: i1 } = await encryptData(secretData, realPassword);
      const { encrypted: encDecoy, salt: s2, iv: i2 } = await encryptData(decoyData, duressPassword);

      const stegoBlob = await embedDataInImage(coverImage, encReal, encDecoy, secretFile.name, decoyFile.name, imageId);

      const filename = `stego_${Date.now()}.png`;
      const path = `${user!.id}/${filename}`;

      const { error: upErr } = await supabase.storage.from('stego-images').upload(path, stegoBlob);
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from('stego_images').insert({
        id: imageId, user_id: user!.id, filename, original_filename: coverImage.name,
        storage_path: path, file_size: stegoBlob.size,
        real_salt: uint8ArrayToBase64(s1), real_iv: uint8ArrayToBase64(i1),
        duress_salt: uint8ArrayToBase64(s2), duress_iv: uint8ArrayToBase64(i2)
      });
      if (dbErr) throw dbErr;

      setSuccess(true);
      setCoverImage(null); setSecretFile(null); setDecoyFile(null);
      setRealPassword(''); setDuressPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-6 space-y-8">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Upload className="w-6 h-6 text-blue-400" /> Hide Files in Image
      </h2>

      {/* Capacity Meter */}
      {coverImage && (
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
          <div className="flex justify-between text-sm mb-2 text-slate-400">
            <span><HardDrive className="inline w-4 h-4 mr-2 text-cyan-400" />Capacity</span>
            <span className={capacity.percent > 100 ? "text-red-400" : "text-slate-300"}>
              {formatBytes(capacity.used)} / {formatBytes(capacity.total)}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${capacity.percent > 100 ? 'bg-red-500' : 'bg-cyan-500'}`}
              style={{ width: `${Math.min(capacity.percent, 100)}%` }}
            />
          </div>
          {capacity.percent > 100 && <p className="text-xs text-red-400 mt-2 flex items-center"><AlertTriangle className="w-3 h-3 mr-1" /> Image is too small!</p>}
        </div>
      )}

      {/* Drag & Drop Inputs */}
      <div className="space-y-6">
        <DragDropZone
          label="Upload Cover Image (PNG)"
          accept="image/png"
          file={coverImage}
          onFileSelect={setCoverImage}
          color="blue"
        />

        <div className="grid md:grid-cols-2 gap-6">
          <DragDropZone
            label="Secret File (Real)"
            file={secretFile}
            onFileSelect={setSecretFile}
            color="green"
          />
          <DragDropZone
            label="Decoy File (Duress)"
            file={decoyFile}
            onFileSelect={setDecoyFile}
            color="amber"
          />
        </div>
      </div>

      {/* Passwords */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2"><Key className="inline w-4 h-4 mr-2 text-green-400" />Real Password</label>
          <input
            type="password"
            value={realPassword}
            onChange={(e) => setRealPassword(e.target.value)}
            className="w-full px-4 py-3 bg-slate-900/50 border border-green-900/50 focus:border-green-500 rounded-lg text-white outline-none focus:ring-1 focus:ring-green-500 transition-all"
            placeholder="Protects secret file"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2"><Key className="inline w-4 h-4 mr-2 text-amber-400" />Duress Password</label>
          <input
            type="password"
            value={duressPassword}
            onChange={(e) => setDuressPassword(e.target.value)}
            className="w-full px-4 py-3 bg-slate-900/50 border border-amber-900/50 focus:border-amber-500 rounded-lg text-white outline-none focus:ring-1 focus:ring-amber-500 transition-all"
            placeholder="Protects decoy file"
          />
        </div>
      </div>

      {error && <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-500/10 border border-green-500/50 rounded-lg text-green-400 text-sm">Success! File saved to Vault.</div>}

      <button
        onClick={handleEmbed}
        disabled={loading}
        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50"
      >
        {loading ? 'Processing Encryption & Steganography...' : 'Secure & Embed Files'}
      </button>
    </div>
  );
}
