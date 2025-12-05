import { useEffect, useState } from 'react';
import {
  Download,
  Trash2,
  Image as ImageIcon,
  Clock,
  HardDrive,
  Eye,
  EyeOff,
  Share2, // New Icon
  Link as LinkIcon
} from 'lucide-react';
import { supabase, type StegoImage } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Vault() {
  const { user } = useAuth();
  const [images, setImages] = useState<StegoImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSalts, setShowSalts] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const { data, error } = await supabase
        .from('stego_images')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setImages(data || []);
    } catch (err) {
      console.error('Error loading images:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (image: StegoImage) => {
    try {
      const { data, error } = await supabase.storage
        .from('stego-images')
        .download(image.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = image.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading image:', err);
      alert('Download failed. File might be deleted.');
    }
  };

  // --- NEW FEATURE: Quick Share ---
  const handleShare = async (image: StegoImage) => {
    try {
      // Create a signed URL valid for 1 hour (3600 seconds)
      const { data, error } = await supabase.storage
        .from('stego-images')
        .createSignedUrl(image.storage_path, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        await navigator.clipboard.writeText(data.signedUrl);
        alert('✅ Secure link copied to clipboard!\n\nThis link allows direct download without login and expires in 1 hour.');
      }
    } catch (err) {
      console.error('Error sharing image:', err);
      alert('Failed to generate share link.');
    }
  };

  const handleDelete = async (image: StegoImage) => {
    if (!confirm('Are you sure? This activates the Remote Kill Switch. The file will be permanently deleted and unrecoverable.')) return;

    try {
      // 1. Delete from Storage
      const { error: storageError } = await supabase.storage
        .from('stego-images')
        .remove([image.storage_path]);

      if (storageError) throw storageError;

      // 2. Delete from Database (Removes Metadata/Keys)
      const { error: dbError } = await supabase
        .from('stego_images')
        .delete()
        .eq('id', image.id);

      if (dbError) throw dbError;

      setImages(images.filter((img) => img.id !== image.id));
    } catch (err) {
      console.error('Error deleting image:', err);
      alert('Failed to delete image.');
    }
  };

  const toggleShowSalts = (imageId: string) => {
    setShowSalts((prev) => ({ ...prev, [imageId]: !prev[imageId] }));
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-blue-400" />
          Your Vault
        </h2>
        <div className="text-sm text-slate-400">
          {images.length} {images.length === 1 ? 'image' : 'images'}
        </div>
      </div>

      {images.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-12 text-center">
          <ImageIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-300 mb-2">
            No stego images yet
          </h3>
          <p className="text-slate-400">
            Embed your first file to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {images.map((image) => (
            <div
              key={image.id}
              className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-6 hover:border-slate-600 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 overflow-hidden">
                  <h3 className="text-lg font-semibold text-white mb-1 truncate" title={image.filename}>
                    {image.filename}
                  </h3>
                  <p className="text-sm text-slate-400 truncate" title={image.original_filename}>
                    Original: {image.original_filename}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={() => handleShare(image)}
                    className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-lg"
                    title="Share Secure Link (1 Hour)"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDownload(image)}
                    className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-lg"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(image)}
                    className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all shadow-lg"
                    title="Destroy File"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Clock className="w-4 h-4" />
                  {new Date(image.created_at).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <HardDrive className="w-4 h-4" />
                  {formatBytes(image.file_size)}
                </div>
                <div className="flex items-center gap-2 col-span-2 md:col-span-1">
                  <button
                    onClick={() => toggleShowSalts(image.id)}
                    className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  >
                    {showSalts[image.id] ? (
                      <>
                        <EyeOff className="w-4 h-4" /> Hide Keys
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" /> Reveal Keys
                      </>
                    )}
                  </button>
                </div>
              </div>

              {showSalts[image.id] && (
                <div className="bg-slate-900/80 rounded-lg p-4 space-y-3 border border-slate-700 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold text-green-400 mb-1 uppercase tracking-wider">Real Keys</p>
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-mono break-all bg-slate-950 p-1 rounded">S: {image.real_salt}</p>
                        <p className="text-[10px] text-slate-400 font-mono break-all bg-slate-950 p-1 rounded">IV: {image.real_iv}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-400 mb-1 uppercase tracking-wider">Duress Keys</p>
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-mono break-all bg-slate-950 p-1 rounded">S: {image.duress_salt}</p>
                        <p className="text-[10px] text-slate-400 font-mono break-all bg-slate-950 p-1 rounded">IV: {image.duress_iv}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
