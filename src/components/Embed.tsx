import { useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, FileText, Lock, Key, AlertTriangle, HardDrive } from 'lucide-react';
import { encryptData, uint8ArrayToBase64 } from '../lib/crypto';
import { embedDataInImage } from '../lib/steganography';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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

  // Capacity State
  const [capacity, setCapacity] = useState({ total: 0, used: 0, percent: 0 });

  // Effect: Recalculate capacity whenever files change
  useEffect(() => {
    calculateCapacity();
  }, [coverImage, secretFile, decoyFile]);

  const calculateCapacity = async () => {
    if (!coverImage) {
      setCapacity({ total: 0, used: 0, percent: 0 });
      return;
    }

    // 1. Calculate Total Capacity from Image Dimensions
    // Formula: (Width * Height * 3 channels) / 8 bits = Max Bytes
    const img = new Image();
    img.src = URL.createObjectURL(coverImage);
    await img.decode();

    // We use 3 bits per pixel (RGB)
    const totalBytes = Math.floor((img.width * img.height * 3) / 8);

    // 2. Calculate Used Space
    // Header overhead is approx 100-150 bytes (UUID + filenames + sizes)
    const overhead = 150;
    const secretSize = secretFile ? secretFile.size : 0;
    const decoySize = decoyFile ? decoyFile.size : 0;
    const usedBytes = overhead + secretSize + decoySize;

    const percent = (usedBytes / totalBytes) * 100;
    setCapacity({ total: totalBytes, used: usedBytes, percent });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleEmbed = async () => {
    if (!coverImage || !secretFile || !decoyFile || !realPassword || !duressPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (realPassword === duressPassword) {
      setError('Real and duress passwords must be different');
      return;
    }
    if (capacity.percent > 100) {
      setError('Files are too large for this image! Use the Tools tab to compress them.');
      return;
    }

    setError('');
    setLoading(true);
    setSuccess(false);

    try {
      const secretData = await secretFile.arrayBuffer();
      const decoyData = await decoyFile.arrayBuffer();
      const imageId = crypto.randomUUID();

      const { encrypted: encReal, salt: realSalt, iv: realIv } = await encryptData(secretData, realPassword);
      const { encrypted: encDecoy, salt: duressSalt, iv: duressIv } = await encryptData(decoyData, duressPassword);

      const stegoBlob = await embedDataInImage(
        coverImage, encReal, encDecoy, secretFile.name, decoyFile.name, imageId
      );

      const filename = `stego_${Date.now()}.png`;
      const storagePath = `${user!.id}/${filename}`;

      const { error: uploadError } = await supabase.storage.from('stego-images').upload(storagePath, stegoBlob);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('stego_images').insert({
        id: imageId,
        user_id: user!.id,
        filename,
        original_filename: coverImage.name,
        storage_path: storagePath,
        file_size: stegoBlob.size,
        real_salt: uint8ArrayToBase64(realSalt),
        real_iv: uint8ArrayToBase64(realIv),
        duress_salt: uint8ArrayToBase64(duressSalt),
        duress_iv: uint8ArrayToBase64(duressIv),
      });

      if (dbError) throw dbError;

      setSuccess(true);
      setCoverImage(null); setSecretFile(null); setDecoyFile(null);
      setRealPassword(''); setDuressPassword('');
      setCapacity({ total: 0, used: 0, percent: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Embedding failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-6">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Upload className="w-6 h-6 text-blue-400" />
          Hide Files in Image
        </h2>

        {/* --- NEW: CAPACITY METER --- */}
        {coverImage && (
          <div className="mb-8 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-300 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                Storage Capacity
              </span>
              <span className={capacity.percent > 100 ? "text-red-400 font-bold" : "text-slate-400"}>
                {formatBytes(capacity.used)} / {formatBytes(capacity.total)}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-out ${capacity.percent > 100 ? 'bg-red-500' :
                    capacity.percent > 80 ? 'bg-amber-500' : 'bg-cyan-500'
                  }`}
                style={{ width: `${Math.min(capacity.percent, 100)}%` }}
              />
            </div>

            {capacity.percent > 100 && (
              <div className="mt-2 flex items-center gap-2 text-xs text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Capacity exceeded! Please use a larger image or compress your files in the <b>Tools</b> tab.</span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              <ImageIcon className="inline w-4 h-4 mr-2" />
              Cover Image (PNG)
            </label>
            <input
              type="file"
              accept="image/png"
              onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white file:bg-blue-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-lg cursor-pointer"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                <Lock className="inline w-4 h-4 mr-2" />
                Secret File (Real)
              </label>
              <input
                type="file"
                onChange={(e) => setSecretFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white file:bg-green-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                <FileText className="inline w-4 h-4 mr-2" />
                Decoy File (Duress)
              </label>
              <input
                type="file"
                onChange={(e) => setDecoyFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white file:bg-amber-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-lg cursor-pointer"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                <Key className="inline w-4 h-4 mr-2 text-green-400" />
                Real Password
              </label>
              <input
                type="password"
                value={realPassword}
                onChange={(e) => setRealPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-green-600 rounded-lg text-white"
                placeholder="Password for secret file"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                <Key className="inline w-4 h-4 mr-2 text-amber-400" />
                Duress Password
              </label>
              <input
                type="password"
                value={duressPassword}
                onChange={(e) => setDuressPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-amber-600 rounded-lg text-white"
                placeholder="Password for decoy file"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4">
              <p className="text-green-400">
                Files successfully embedded! Check your vault.
              </p>
            </div>
          )}

          <button
            onClick={handleEmbed}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-6 rounded-lg transition-all disabled:opacity-50 shadow-lg hover:shadow-xl"
          >
            {loading ? 'Embedding...' : 'Embed Files'}
          </button>
        </div>
      </div>
    </div>
  );
}
