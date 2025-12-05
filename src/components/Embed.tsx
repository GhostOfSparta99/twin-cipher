import { useState } from 'react';
import { Upload, Image as ImageIcon, FileText, Lock, Key } from 'lucide-react';
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

  const handleEmbed = async () => {
    if (!coverImage || !secretFile || !decoyFile || !realPassword || !duressPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (realPassword === duressPassword) {
      setError('Real and duress passwords must be different');
      return;
    }

    setError('');
    setLoading(true);
    setSuccess(false);

    try {
      const secretData = await secretFile.arrayBuffer();
      const decoyData = await decoyFile.arrayBuffer();

      // 1. Generate unique ID for this transaction
      const imageId = crypto.randomUUID();

      // 2. Encrypt Files
      const { encrypted: encReal, salt: realSalt, iv: realIv } = await encryptData(secretData, realPassword);
      const { encrypted: encDecoy, salt: duressSalt, iv: duressIv } = await encryptData(decoyData, duressPassword);

      // 3. Embed Data (Includes the imageId now!)
      const stegoBlob = await embedDataInImage(
        coverImage, encReal, encDecoy, secretFile.name, decoyFile.name, imageId
      );

      // 4. Upload & Save Metadata
      const filename = `stego_${Date.now()}.png`;
      const storagePath = `${user!.id}/${filename}`;

      const { error: uploadError } = await supabase.storage.from('stego-images').upload(storagePath, stegoBlob);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('stego_images').insert({
        id: imageId, // Explicitly set the ID we generated
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
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {coverImage && (
              <p className="mt-2 text-sm text-slate-400">{coverImage.name}</p>
            )}
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
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-600 file:text-white hover:file:bg-green-700 file:cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-600"
              />
              {secretFile && (
                <p className="mt-2 text-sm text-slate-400">{secretFile.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                <FileText className="inline w-4 h-4 mr-2" />
                Decoy File (Duress)
              </label>
              <input
                type="file"
                onChange={(e) => setDecoyFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-amber-600 file:text-white hover:file:bg-amber-700 file:cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              {decoyFile && (
                <p className="mt-2 text-sm text-slate-400">{decoyFile.name}</p>
              )}
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
                className="w-full px-4 py-3 bg-slate-900/50 border border-green-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-600"
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
                className="w-full px-4 py-3 bg-slate-900/50 border border-amber-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-600"
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
                Files successfully embedded! Check your vault to download the stego
                image.
              </p>
            </div>
          )}

          <button
            onClick={handleEmbed}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {loading ? 'Embedding...' : 'Embed Files'}
          </button>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-400 mb-2">
          How it works
        </h3>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>• Your secret and decoy files are encrypted separately in your browser</li>
          <li>• Both encrypted files are hidden in the cover image using LSB steganography</li>
          <li>• Real password reveals your secret file, duress password reveals the decoy</li>
          <li>• No one can tell which password you used or that multiple files exist</li>
        </ul>
      </div>
    </div>
  );
}
