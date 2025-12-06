import { useEffect, useState } from 'react';
import { Download, Trash2, Image as ImageIcon, Clock, HardDrive, Eye, EyeOff, Users, X, Plus, Copy, Share2 } from 'lucide-react';
import { supabase, type StegoImage } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Vault() {
  const { user } = useAuth();

  // State for Images
  const [myImages, setMyImages] = useState<StegoImage[]>([]);
  const [sharedImages, setSharedImages] = useState<StegoImage[]>([]);
  const [activeTab, setActiveTab] = useState<'mine' | 'shared'>('mine');
  const [loading, setLoading] = useState(true);

  const [showSalts, setShowSalts] = useState<{ [key: string]: boolean }>({});
  const [shareModalOpen, setShareModalOpen] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);

  useEffect(() => { loadImages(); }, []);

  const loadImages = async () => {
    try {
      const { data, error } = await supabase
        .from('stego_images')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter: Separate My Files from Shared Files
      const mine = data?.filter(img => img.user_id === user?.id) || [];
      const shared = data?.filter(img => img.user_id !== user?.id) || [];

      setMyImages(mine);
      setSharedImages(shared);
    } catch (err) {
      console.error('Error loading images:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers (Download, Delete, Share) ---
  const handleDownload = async (image: StegoImage) => {
    try {
      const { data, error } = await supabase.storage.from('stego-images').download(image.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = image.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error(err); alert('Download failed.'); }
  };

  const handleDelete = async (image: StegoImage) => {
    if (!confirm('Are you sure? This permanently deletes the file.')) return;
    await supabase.storage.from('stego-images').remove([image.storage_path]);
    await supabase.from('stego_images').delete().eq('id', image.id);
    setMyImages(myImages.filter((img) => img.id !== image.id));
  };

  const openShareModal = async (image: StegoImage) => {
    setShareModalOpen(image.id);
    const { data } = await supabase.from('stego_images').select('allowed_emails').eq('id', image.id).single();
    setAllowedEmails(data?.allowed_emails || []);
  };

  const addEmail = async () => {
    if (!emailInput || !shareModalOpen) return;
    const newEmails = [...allowedEmails, emailInput];
    setAllowedEmails(newEmails); setEmailInput('');
    await supabase.from('stego_images').update({ allowed_emails: newEmails }).eq('id', shareModalOpen);
  };

  const removeEmail = async (email: string) => {
    const newEmails = allowedEmails.filter(e => e !== email);
    setAllowedEmails(newEmails);
    await supabase.from('stego_images').update({ allowed_emails: newEmails }).eq('id', shareModalOpen!);
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}?share=${shareModalOpen}`;
    navigator.clipboard.writeText(link);
    alert('Link copied! Ensure the recipient is in the allowed list.');
  };

  if (loading) return <div className="flex justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;

  const imagesToShow = activeTab === 'mine' ? myImages : sharedImages;

  return (
    <div className="space-y-6">

      {/* Header with Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-blue-400" /> Vault
        </h2>

        <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'mine' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
          >
            My Files ({myImages.length})
          </button>
          <button
            onClick={() => setActiveTab('shared')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'shared' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
          >
            Shared with Me ({sharedImages.length})
          </button>
        </div>
      </div>

      {imagesToShow.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/30 rounded-2xl border border-slate-700/50 border-dashed">
          <p className="text-slate-500">No images found in this section.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {imagesToShow.map((image) => (
            <div key={image.id} className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-6 hover:border-slate-600 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{image.filename}</h3>
                  <div className="flex gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> {(image.file_size / 1024).toFixed(1)} KB</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(image.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {/* Only show Share/Delete for OWNED images */}
                  {activeTab === 'mine' && (
                    <>
                      <button onClick={() => openShareModal(image)} className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors" title="Manage Access">
                        <Users className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(image)} className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button onClick={() => handleDownload(image)} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors" title="Download">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Shared Metadata View */}
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Decryption Keys</span>
                  <button onClick={() => setShowSalts(prev => ({ ...prev, [image.id]: !prev[image.id] }))} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    {showSalts[image.id] ? <><EyeOff className="w-3 h-3" /> Hide</> : <><Eye className="w-3 h-3" /> Reveal</>}
                  </button>
                </div>

                {showSalts[image.id] && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 text-[10px] font-mono text-slate-400">
                    <div>
                      <p className="text-green-500 font-bold mb-1">Real File</p>
                      <div className="bg-slate-950 p-2 rounded break-all">S: {image.real_salt}</div>
                      <div className="bg-slate-950 p-2 rounded break-all mt-1">IV: {image.real_iv}</div>
                    </div>
                    <div>
                      <p className="text-amber-500 font-bold mb-1">Duress File</p>
                      <div className="bg-slate-950 p-2 rounded break-all">S: {image.duress_salt}</div>
                      <div className="bg-slate-950 p-2 rounded break-all mt-1">IV: {image.duress_iv}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Share Modal (Only rendered when needed) */}
      {shareModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><Share2 className="w-5 h-5 text-indigo-400" /> Share Access</h3>
              <button onClick={() => setShareModalOpen(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm" placeholder="Add email to allowlist..." />
                <button onClick={addEmail} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg"><Plus className="w-5 h-5" /></button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {allowedEmails.map(email => (
                  <div key={email} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                    <span className="text-sm text-slate-300">{email}</span>
                    <button onClick={() => removeEmail(email)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                {allowedEmails.length === 0 && <p className="text-center text-slate-500 text-sm py-4">File is private.</p>}
              </div>

              <button onClick={copyShareLink} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium flex justify-center items-center gap-2 mt-4">
                <Copy className="w-4 h-4" /> Copy Access Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
