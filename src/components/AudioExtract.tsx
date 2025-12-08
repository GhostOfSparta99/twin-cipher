import { useState } from 'react';
import { Download, Unlock, Key, CheckCircle } from 'lucide-react';
import { decryptData, base64ToUint8Array } from '../lib/crypto';
import { extractFromAudio } from '../lib/audioStego';
import { supabase } from '../lib/supabase';
import DragDropZone from './DragDropZone';

export default function AudioExtract() {
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [extractedFile, setExtractedFile] = useState<{ name: string; data: ArrayBuffer } | null>(null);

    const handleExtract = async () => {
        if (!audioFile || !password) { setError('Missing inputs'); return; }
        setLoading(true); setError(''); setExtractedFile(null);

        try {
            // 1. Extract raw data from WAV LSBs
            const { fileId, realFile, decoyFile } = await extractFromAudio(audioFile);

            // 2. Fetch Keys
            const { data: meta, error: dbErr } = await supabase.from('stego_images').select('*').eq('id', fileId).single();
            if (dbErr || !meta) throw new Error('Metadata not found. File may be compromised.');

            // 3. Try Decrypting (Dual Password)
            let decrypted = null;
            let name = '';

            try {
                decrypted = await decryptData(realFile.data, password, base64ToUint8Array(meta.real_salt), base64ToUint8Array(meta.real_iv));
                name = realFile.name;
            } catch { }

            if (!decrypted) {
                try {
                    decrypted = await decryptData(decoyFile.data, password, base64ToUint8Array(meta.duress_salt), base64ToUint8Array(meta.duress_iv));
                    name = decoyFile.name;
                } catch { }
            }

            if (!decrypted) throw new Error('Invalid Password');
            setExtractedFile({ name, data: decrypted });
        } catch (err) {
            setError('Extraction failed or invalid password.');
        } finally {
            setLoading(false);
        }
    };

    const download = () => {
        if (!extractedFile) return;
        const url = URL.createObjectURL(new Blob([extractedFile.data]));
        const a = document.createElement('a'); a.href = url; a.download = extractedFile.name; a.click();
    };

    return (
        <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-slate-700 p-6 space-y-6 shadow-sm transition-colors duration-300">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Unlock className="w-6 h-6 text-purple-500 dark:text-purple-400" /> Extract from Audio
            </h2>

            <DragDropZone label="Upload Stego Audio (WAV)" accept=".wav" file={audioFile} onFileSelect={setAudioFile} color="purple" />

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2"><Key className="inline w-4 h-4 mr-2" />Password</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl outline-none transition-all duration-300 bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 dark:bg-slate-900/50 dark:border-slate-600 dark:text-white dark:focus:ring-purple-500/20 placeholder-gray-400 dark:placeholder-slate-500"
                />
            </div>

            {error && <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>}

            {extractedFile && (
                <div className="p-4 bg-green-500/10 border border-green-500/50 rounded-lg text-green-600 dark:text-green-400 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" /> Extracted: {extractedFile.name}
                </div>
            )}

            <div className="flex gap-4">
                <button onClick={handleExtract} disabled={loading} className="flex-1 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50">
                    {loading ? 'Processing...' : 'Unlock Audio'}
                </button>
                {extractedFile && (
                    <button onClick={download} className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg">
                        <Download className="w-5 h-5 inline mr-2" /> Save
                    </button>
                )}
            </div>
        </div>
    );
}
