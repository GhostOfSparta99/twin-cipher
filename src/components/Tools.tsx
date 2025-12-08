import { useState } from 'react';
import { FileCode, Minimize2, Download, RefreshCw, FileText, Binary, Archive } from 'lucide-react';

export default function Tools() {
    const [decoyType, setDecoyType] = useState<'text' | 'binary'>('text');
    const [decoySize, setDecoySize] = useState<number>(1024); // Default 1KB
    const [isGenerating, setIsGenerating] = useState(false);

    const [fileToCompress, setFileToCompress] = useState<File | null>(null);
    const [isCompressing, setIsCompressing] = useState(false);

    // --- 1. Decoy Generator Logic ---
    const handleGenerateDecoy = async () => {
        setIsGenerating(true);
        try {
            let content: Blob;
            let filename = `decoy_${Date.now()}`;

            if (decoyType === 'text') {
                // Generate fake "corporate speak" text
                const words = ['Synergy', 'Quarterly', 'Report', 'Analysis', 'Stakeholder', 'ROI', 'Leverage', 'Assets', 'Deployment', 'Strategic', 'Growth', 'Verticals', 'Confidential', 'Draft', 'Meeting', 'Notes'];
                let text = 'CONFIDENTIAL INTERNAL MEMO\nDATE: ' + new Date().toISOString().split('T')[0] + '\nSUBJECT: Q4 STRATEGIC ALIGNMENT\n\n';

                while (text.length < decoySize) {
                    text += words[Math.floor(Math.random() * words.length)] + ' ';
                    if (Math.random() > 0.9) text += '\n';
                }
                content = new Blob([text], { type: 'text/plain' });
                filename += '.txt';
            } else {
                // Generate random binary noise
                const buffer = new Uint8Array(decoySize);
                crypto.getRandomValues(buffer);
                content = new Blob([buffer], { type: 'application/octet-stream' });
                filename += '.bin';
            }

            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Decoy generation failed:", err);
            alert("Failed to generate decoy file");
        } finally {
            setIsGenerating(false);
        }
    };

    // --- 2. File Compressor Logic ---
    const handleCompress = async () => {
        if (!fileToCompress) return;
        setIsCompressing(true);

        try {
            // Use native CompressionStream for zero-dependency GZIP
            const stream = fileToCompress.stream().pipeThrough(new CompressionStream('gzip'));
            const compressedResponse = await new Response(stream).blob();

            const url = URL.createObjectURL(compressedResponse);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileToCompress.name}.gz`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Compression failed:', err);
            alert('Compression failed. Try a smaller file or different browser.');
        } finally {
            setIsCompressing(false);
        }
    };

    return (
        <div className="grid md:grid-cols-2 gap-6">

            {/* Decoy Generator Card */}
            <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm transition-colors duration-300">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-purple-500/10 rounded-lg">
                        <FileCode className="w-6 h-6 text-purple-500 dark:text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Decoy Generator</h2>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Create fake files for plausible deniability</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">File Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setDecoyType('text')}
                                className={`p-2 rounded-lg border text-sm flex items-center justify-center gap-2 transition-all ${decoyType === 'text'
                                    ? 'bg-purple-600 border-purple-500 text-white'
                                    : 'bg-gray-100 dark:bg-slate-900/50 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500'
                                    }`}
                            >
                                <FileText className="w-4 h-4" /> Text Doc
                            </button>
                            <button
                                onClick={() => setDecoyType('binary')}
                                className={`p-2 rounded-lg border text-sm flex items-center justify-center gap-2 transition-all ${decoyType === 'binary'
                                    ? 'bg-purple-600 border-purple-500 text-white'
                                    : 'bg-gray-100 dark:bg-slate-900/50 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500'
                                    }`}
                            >
                                <Binary className="w-4 h-4" /> Random Data
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                            Target Size: {Math.round(decoySize / 1024)} KB
                        </label>
                        <input
                            type="range"
                            min="1024"
                            max="5242880" // 5MB max
                            step="1024"
                            value={decoySize}
                            onChange={(e) => setDecoySize(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                    </div>

                    <button
                        onClick={handleGenerateDecoy}
                        disabled={isGenerating}
                        className="w-full py-3 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                    >
                        {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Generate Decoy
                    </button>
                </div>
            </div>

            {/* File Compressor Card */}
            <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm transition-colors duration-300">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-cyan-500/10 rounded-lg">
                        <Minimize2 className="w-6 h-6 text-cyan-500 dark:text-cyan-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">File Compressor</h2>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Shrink files before hiding them</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-8 text-center hover:border-cyan-500 transition-colors">
                        <input
                            type="file"
                            onChange={(e) => setFileToCompress(e.target.files?.[0] || null)}
                            className="hidden"
                            id="compress-upload"
                        />
                        <label htmlFor="compress-upload" className="cursor-pointer flex flex-col items-center">
                            <Archive className="w-8 h-8 text-gray-400 dark:text-slate-500 mb-2" />
                            <span className="text-sm text-gray-600 dark:text-slate-300">
                                {fileToCompress ? fileToCompress.name : 'Click to upload file'}
                            </span>
                        </label>
                    </div>

                    <button
                        onClick={handleCompress}
                        disabled={!fileToCompress || isCompressing}
                        className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isCompressing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Minimize2 className="w-4 h-4" />}
                        Compress & Download
                    </button>
                </div>
            </div>
        </div>
    );
}
