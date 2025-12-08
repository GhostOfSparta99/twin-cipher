
import { useState } from 'react';
import { Image as ImageIcon, Music } from 'lucide-react';
import Extract from './Extract';
import AudioExtract from './AudioExtract';

type MediaType = 'image' | 'audio';

export default function UnifiedExtract() {
    const [mediaType, setMediaType] = useState<MediaType>('image');

    return (
        <div className="space-y-6 animate-fade-in">
            {/* GLASS CARD CONTAINER */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-6 rounded-3xl border transition-all duration-300
                bg-white/60 backdrop-blur-xl border-white/50 shadow-2xl shadow-emerald-500/5
                dark:bg-slate-800/50 dark:border-slate-700"
            >
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2
                        text-slate-800 dark:text-white"
                    >
                        {mediaType === 'image' ? <ImageIcon className="w-6 h-6 text-blue-500" /> : <Music className="w-6 h-6 text-purple-500" />}
                        Extract Files
                    </h2>
                    <p className="text-sm font-medium mt-1
                        text-slate-500 dark:text-slate-400"
                    >
                        {mediaType === 'image' ? 'Recover hidden files from stego images.' : 'Extract hidden data from carrier audio files.'}
                    </p>
                </div>

                {/* Toggle Switch */}
                <div className="bg-slate-100/50 dark:bg-slate-900/50 p-1.5 rounded-full border border-slate-200/50 dark:border-slate-700">
                    <button
                        onClick={() => setMediaType('image')}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${mediaType === 'image'
                            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                    >
                        Image
                    </button>
                    <button
                        onClick={() => setMediaType('audio')}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${mediaType === 'audio'
                            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                    >
                        Audio
                    </button>
                </div>
            </div>

            <div className="transition-all duration-300">
                {mediaType === 'image' ? <Extract /> : <AudioExtract />}
            </div>
        </div>
    );
}
