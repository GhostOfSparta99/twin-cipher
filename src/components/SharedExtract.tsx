import { useState, useEffect } from 'react';
import { Download, Unlock, Key, ShieldCheck, AlertTriangle, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { decryptData, base64ToUint8Array } from '../lib/crypto';
import { extractDataFromImage } from '../lib/steganography';

export default function SharedExtract({ imageId, onBack }: { imageId: string; onBack: () => void }) {
    const [loading, setLoading] = useState(true);
    const [password, setPassword] = useState('');
    const [imageBlob, setImageBlob] = useState<Blob | null>(null);
    const [metadata, setMetadata] = useState<any>(null);
    const [error, setError] = useState('');
    const [extractedFile, setExtractedFile] = useState<{ name: string; data: ArrayBuffer; type: 'real' | 'decoy' } | null>(null);

    // 1. Fetch Image & Metadata on Load
    useEffect(() => {
        const loadSharedData = async () => {
            try {
                // Fetch Metadata (Database RLS will block this if email is not allowed)
                const { data: meta, error: metaError } = await supabase
                    .from('stego_images')
                    .select('*')
                    .eq('id', imageId)
                    .single();

                if (metaError || !meta) throw new Error('Access Denied: You are not on the allow-list for this file.');
                setMetadata(meta);

                // Download Image (Storage RLS will block this if email is not allowed)
                const { data: blob, error: downloadError } = await supabase.storage
                    .from('stego-images')
                    .download(meta.storage_path);

                if (downloadError) throw downloadError;
                setImageBlob(blob);

            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load shared file');
            } finally {
                setLoading(false);
            }
        };
        loadSharedData();
    }, [imageId]);

    // 2. Handle Extraction (Same logic as main Extract, but using fetched metadata)
    const handleUnlock = async () => {
        if (!imageBlob || !password || !metadata) return;
        setLoading(true);

        try {
            // We need to convert the Blob to a File object for our utility
            const file = new File([imageBlob], "shared_stego.png", { type: "image/png" });
            const { realFile, decoyFile } = await extractDataFromImage(file);

            let decrypted: ArrayBuffer | null = null;
            let type: 'real' | 'decoy' = 'real';
            let filename = '';

            // Try Real Password
            try {
                decrypted = await decryptData(realFile.data, password, base64ToUint8Array(metadata.real_salt), base64ToUint8Array(metadata.real_iv));
                filename = realFile.name;
                type = 'real';
            } catch { }

            // Try Duress Password
            if (!decrypted) {
                try {
                    decrypted = await decryptData(decoyFile.data, password, base64ToUint8Array(metadata.duress_salt), base64ToUint8Array(metadata.duress_iv));
                    filename = decoyFile.name;
                    type = 'decoy';
                } catch { }
            }

            if (!decrypted) throw new Error('Invalid Password');
            setExtractedFile({ name: filename, data: decrypted, type });

        } catch (err) {
            alert('Incorrect password or corrupted file.');
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

    if (loading && !imageBlob) {
        return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
    }

    if (error) {
        return (
            <div className="p-8 bg-red-900/20 border border-red-500/50 rounded-2xl text-center mt-10 mx-auto max-w-md">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-red-400 mb-2">Access Denied</h3>
                <p className="text-slate-400 mb-6">{error}</p>
                <button onClick={onBack} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-all">Go to Dashboard</button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-8 animate-fade-in mt-10">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-green-400" /> Secure Share
                    </h2>
                    <p className="text-sm text-slate-400">Shared by owner. Decryption happens locally.</p>
                </div>
                <button onClick={onBack} className="text-sm text-slate-500 hover:text-white">Close</button>
            </div>

            <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                    <FileText className="w-8 h-8 text-blue-400" />
                    <div>
                        <p className="text-white font-medium">{metadata.filename}</p>
                        <p className="text-xs text-slate-500">Size: {(metadata.file_size / 1024).toFixed(1)} KB</p>
                    </div>
                </div>

                {!extractedFile ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Enter Password to Unlock</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Real or Duress Password..."
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleUnlock}
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg disabled:opacity-50"
                        >
                            {loading ? 'Decrypting...' : 'Unlock File'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className={`p-4 rounded-lg border flex items-center gap-3 ${extractedFile.type === 'real' ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-amber-500/10 border-amber-500/50 text-amber-400'}`}>
                            <ShieldCheck className="w-6 h-6" />
                            <div>
                                <p className="font-bold">Success! File Decrypted.</p>
                                <p className="text-sm opacity-80">{extractedFile.name}</p>
                            </div>
                        </div>
                        <button onClick={handleDownload} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">
                            <Download className="w-5 h-5" /> Download File
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
