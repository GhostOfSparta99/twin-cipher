import { useState, useRef } from 'react';
import { UploadCloud, File as FileIcon } from 'lucide-react';

interface DragDropZoneProps {
    onFileSelect: (file: File) => void;
    accept?: string;
    label: string;
    file: File | null;
    color?: string;
}

export default function DragDropZone({ onFileSelect, accept, label, file, color = 'blue' }: DragDropZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileSelect(e.target.files[0]);
        }
    };

    const borderColor = isDragging ? `border-${color}-400` : 'border-gray-300 dark:border-slate-600';
    const bgColor = isDragging ? `bg-${color}-500/10` : 'bg-gray-50 dark:bg-slate-900/50';
    const textColor = isDragging ? `text-${color}-400` : 'text-gray-400 dark:text-slate-400';

    return (
        <div
            className={`relative w-full border-2 border-dashed ${borderColor} ${bgColor} rounded-xl p-6 text-center transition-all cursor-pointer group hover:border-${color}-500 hover:bg-gray-100 dark:hover:bg-slate-800/80`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
        >
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={handleChange}
                className="hidden"
            />

            <div className="flex flex-col items-center gap-3 pointer-events-none">
                {file ? (
                    <>
                        <div className={`p-3 rounded-full bg-${color}-500/20 text-${color}-400`}>
                            <FileIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                    </>
                ) : (
                    <>
                        <UploadCloud className={`w-8 h-8 ${textColor} group-hover:scale-110 transition-transform`} />
                        <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{label}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Drag & drop or click to browse</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
