import { useState } from 'react';
import { Music, Wand2 } from 'lucide-react';
import { encryptData, uint8ArrayToBase64 } from '../lib/crypto';
import { embedInAudio } from '../lib/audioStego';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DragDropZone from './DragDropZone';

export default function AudioEmbed() {
    const { user } = useAuth();
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [secretFile, setSecretFile] = useState<File | null>(null);
    const [decoyFile, setDecoyFile] = useState<File | null>(null);

    const [realPassword, setRealPassword] = useState('');
    const [duressPassword, setDuressPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const generatePassword = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let pass = '';
        const randomValues = new Uint32Array(16);
        crypto.getRandomValues(randomValues);
        for (let i = 0; i < 16; i++) pass += chars[randomValues[i] % chars.length];
        return pass;
    };

    const handleEmbed = async () => {
        if (!audioFile || !secretFile || !decoyFile || !realPassword || !duressPassword) {
            setError('Please fill in all fields'); return;
        }
        if (realPassword === duressPassword) {
            setError('Passwords must be different'); return;
        }

        setLoading(true); setError(''); setSuccess(false);

        try {
            const fileId = crypto.randomUUID();
            const secretData = await secretFile.arrayBuffer();
            const decoyData = await decoyFile.arrayBuffer();

            // Encrypt
            const { encrypted: encReal, salt: s1, iv: i1 } = await encryptData(secretData, realPassword);
            const { encrypted: encDecoy, salt: s2, iv: i2 } = await encryptData(decoyData, duressPassword);

            // Embed into Audio
            const stegoBlob = await embedInAudio(audioFile, encReal, encDecoy, secretFile.name, decoyFile.name, fileId);

            // Upload
            const filename = `audio_${Date.now()}.wav`;
            const path = `${user!.id}/${filename}`;

            const { error: upErr } = await supabase.storage.from('stego-images').upload(path, stegoBlob);
            if (upErr) throw upErr;

            const { error: dbErr } = await supabase.from('stego_images').insert({
                id: fileId, user_id: user!.id, filename, original_filename: audioFile.name,
                storage_path: path, file_size: stegoBlob.size,
                real_salt: uint8ArrayToBase64(s1), real_iv: uint8ArrayToBase64(i1),
                duress_salt: uint8ArrayToBase64(s2), duress_iv: uint8ArrayToBase64(i2)
            });
            if (dbErr) throw dbErr;

            setSuccess(true);
            setAudioFile(null); setSecretFile(null); setDecoyFile(null);
            setRealPassword(''); setDuressPassword('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Audio embedding failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-slate-700 p-6 space-y-6 shadow-sm transition-colors duration-300">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Music className="w-6 h-6 text-purple-500 dark:text-purple-400" /> Audio Steganography
            </h2>

            <DragDropZone label="Upload Carrier Audio (WAV)" accept=".wav" file={audioFile} onFileSelect={setAudioFile} color="purple" />

            <div className="grid md:grid-cols-2 gap-6">
                <DragDropZone label="Secret File" file={secretFile} onFileSelect={setSecretFile} color="green" />
                <DragDropZone label="Decoy File" file={decoyFile} onFileSelect={setDecoyFile} color="amber" />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <div className="flex justify-between mb-2">
                        <label className="text-sm text-gray-700 dark:text-slate-300">Real Password</label>
                        <button onClick={() => setRealPassword(generatePassword())} className="text-xs text-blue-500 dark:text-blue-400 flex items-center gap-1"><Wand2 className="w-3 h-3" /> Suggest</button>
                    </div>
                    <input
                        type="password"
                        value={realPassword}
                        onChange={(e) => setRealPassword(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl outline-none transition-all duration-300 bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 dark:bg-slate-900/50 dark:border-slate-600 dark:text-white dark:focus:ring-purple-500/20 placeholder-gray-400 dark:placeholder-slate-500"
                    />
                </div>
                <div>
                    <div className="flex justify-between mb-2">
                        <label className="text-sm text-gray-700 dark:text-slate-300">Duress Password</label>
                        <button onClick={() => setDuressPassword(generatePassword())} className="text-xs text-blue-500 dark:text-blue-400 flex items-center gap-1"><Wand2 className="w-3 h-3" /> Suggest</button>
                    </div>
                    <input
                        type="password"
                        value={duressPassword}
                        onChange={(e) => setDuressPassword(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl outline-none transition-all duration-300 bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 dark:bg-slate-900/50 dark:border-slate-600 dark:text-white dark:focus:ring-purple-500/20 placeholder-gray-400 dark:placeholder-slate-500"
                    />
                </div>
            </div>

            {error && <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>}
            {success && <div className="p-4 bg-green-500/10 border border-green-500/50 rounded-lg text-green-600 dark:text-green-400 text-sm">Audio secure! Check your vault.</div>}

            <button onClick={handleEmbed} disabled={loading} className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50">
                {loading ? 'Processing Audio...' : 'Hide Data in Audio'}
            </button>
        </div>
    );
}
