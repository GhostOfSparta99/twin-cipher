import { useEffect, useState } from 'react';
import {
  Download,
  Trash2,
  Image as ImageIcon,
  Clock,
  HardDrive,
  Eye,
  EyeOff,
  Users, // New Icon for sharing
  X,
  Plus,
  Copy
} from 'lucide-react';
import { supabase, type StegoImage } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Vault() {
  const { user } = useAuth();
  const [images, setImages] = useState<StegoImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSalts, setShowSalts] = useState<{ [key: string]: boolean }>({});

  // Share Modal State
  const [shareModalOpen, setShareModalOpen] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);

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

  // --- Access Control Logic ---
  const openShareModal = async (image: StegoImage) => {
    setShareModalOpen(image.id);
    // Fetch current allowed emails for this specific image
    const { data } = await supabase
      .from('stego_images')
      .select('allowed_emails')
      .eq('id', image.id)
      .single();

    setAllowedEmails(data?.allowed_emails || []);
  };

  const addEmail = async () => {
    if (!emailInput || !shareModalOpen) return;
    // Optimistic update
    const newEmails = [...allowedEmails, emailInput];
    setAllowedEmails(newEmails);
    setEmailInput('');

    // Update Database
    await supabase
      .from('stego_images')
      .update({ allowed_emails: newEmails })
      .eq('id', shareModalOpen);
  };

  const removeEmail = async (emailToRemove: string) => {
    if (!shareModalOpen) return;
    const newEmails = allowedEmails.filter(e => e !== emailToRemove);
    setAllowedEmails(newEmails);

    await supabase
      .from('stego_images')
      .update({ allowed_emails: newEmails })
      .eq('id', shareModalOpen);
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}?share=${shareModalOpen}`;
    navigator.clipboard.writeText(link);
    alert('Link copied! Only users in the allowed list can access it.');
  };

  const handleDownload = async (image: StegoImage) => {
    try {
      const { data, error } = await supabase.storage
        .from('stego-images')
        .download(image.storage_path);

      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = image.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (image: StegoImage) => {
    if (!confirm('Are you sure? This permanently deletes the file.')) return;
    await supabase.storage.from('stego-images').remove([image.storage_path]);
    await supabase.from('stego_images').delete().eq('id', image.id);
    setImages(images.filter((img) => img.id !== image.id));
  };

  if (loading) return <div className="flex justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><ImageIcon className="w-6 h-6 text-blue-400" /> Your Vault</h2>
        <div className="text-sm text-slate-400">{images.length} images</div>
      </div>

      <div className="grid gap-6">
        {images.map((image) => (
          <div key={image.id} className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-6">
            <div className="flex justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white truncate max-w-[200px]">{image.filename}</h3>
                <p className="text-sm text-slate-400">Size: {(image.file_size / 1024).toFixed(2)} KB</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openShareModal(image)} className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg" title="Manage Access">
                  <Users className="w-5 h-5" />
                </button>
                <button onClick={() => handleDownload(image)} className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg">
                  <Download className="w-5 h-5" />
                </button>
                <button onClick={() => handleDelete(image)} className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowSalts(prev => ({ ...prev, [image.id]: !prev[image.id] }))}
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              {showSalts[image.id] ? <><EyeOff className="w-4 h-4" /> Hide Keys</> : <><Eye className="w-4 h-4" /> Reveal Keys</>}
            </button>

            {showSalts[image.id] && (
              <div className="mt-4 bg-slate-900/80 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border border-slate-700">
                <div><p className="text-green-400 text-xs font-bold uppercase">Real Keys</p><p className="text-[10px] text-slate-400 font-mono break-all">S: {image.real_salt}</p><p className="text-[10px] text-slate-400 font-mono break-all">IV: {image.real_iv}</p></div>
                <div><p className="text-amber-400 text-xs font-bold uppercase">Duress Keys</p><p className="text-[10px] text-slate-400 font-mono break-all">S: {image.duress_salt}</p><p className="text-[10px] text-slate-400 font-mono break-all">IV: {image.duress_iv}</p></div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-indigo-400" /> Manage Access</h3>
              <button onClick={() => setShareModalOpen(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm" placeholder="Add email address..." />
                <button onClick={addEmail} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg"><Plus className="w-5 h-5" /></button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {allowedEmails.map(email => (
                  <div key={email} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                    <span className="text-sm text-slate-300">{email}</span>
                    <button onClick={() => removeEmail(email)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                {allowedEmails.length === 0 && <p className="text-center text-slate-500 text-sm py-4">No access granted yet. File is private.</p>}
              </div>

              <div className="pt-4 border-t border-slate-700">
                <button onClick={copyShareLink} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium flex justify-center items-center gap-2">
                  <Copy className="w-4 h-4" /> Copy Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
