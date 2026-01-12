import { useEffect, useState } from 'react';
import {
  Download,
  Trash2,
  Image as ImageIcon,
  Clock,
  HardDrive,
  Eye,
  EyeOff,
  Flame, // Icon for Burn
  Share2,
  X,
  Copy,
  Plus,
  Check,
  ShieldCheck
} from 'lucide-react';
import { supabase, type StegoImage } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Vault() {
  const { user } = useAuth();
  const [images, setImages] = useState<StegoImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSalts, setShowSalts] = useState<{ [key: string]: boolean }>({});

  // Share Modal State
  const [shareImage, setShareImage] = useState<StegoImage | null>(null);
  const [activeTab, setActiveTab] = useState<'mine' | 'shared'>('mine');
  const [newEmail, setNewEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [copyStatus, setCopyStatus] = useState(false);

  useEffect(() => {
    if (user) loadImages();
  }, [user]);

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
      alert('Failed to download image');
    }
  };

  // --- CORRECTED BURN FUNCTION (Update Keys ONLY) ---
  const handleBurn = async (image: StegoImage) => {
    if (!confirm('WARNING: This will destroy the encryption keys. The file will remain but become undecryptable. Continue?')) return;

    try {
      // We use .update() NOT .delete()
      const { error } = await supabase
        .from('stego_images')
        .update({
          real_salt: 'BURNED',
          real_iv: 'BURNED',
          duress_salt: 'BURNED',
          duress_iv: 'BURNED'
        })
        .eq('id', image.id);

      if (error) throw error;

      // Update local state to show "BURNED" badge immediately
      const updatedImage = { ...image, real_salt: 'BURNED', real_iv: 'BURNED', duress_salt: 'BURNED', duress_iv: 'BURNED' };
      setImages(images.map(img => img.id === image.id ? updatedImage : img));

      // Also update shareImage if needed
      if (shareImage?.id === image.id) {
        setShareImage(updatedImage as StegoImage);
      }

      alert('File burned successfully. Keys are destroyed.');
    } catch (err) {
      console.error('Error burning file:', err);
      alert('Failed to burn file');
    }
  };

  // --- DELETE FUNCTION (Removes Everything) ---
  const handleDelete = async (image: StegoImage) => {
    if (!confirm('Are you sure you want to permanently DELETE this file? This cannot be undone.')) return;

    try {
      // 1. Remove from Storage Bucket
      const { error: storageError } = await supabase.storage
        .from('stego-images')
        .remove([image.storage_path]);

      if (storageError) console.error('Storage delete warning:', storageError);

      // 2. Remove from Database (Completely)
      const { error: dbError } = await supabase
        .from('stego_images')
        .delete()
        .eq('id', image.id);

      if (dbError) throw dbError;

      // 3. Update Local state and modal state
      setImages(images.filter((img) => img.id !== image.id));
      if (shareImage?.id === image.id) setShareImage(null);

    } catch (err) {
      console.error('Error deleting image:', err);
      alert('Failed to delete image');
    }
  };

  const toggleShowSalts = (imageId: string) => {
    setShowSalts((prev) => ({ ...prev, [imageId]: !prev[imageId] }));
  };

  // --- SHARE LOGIC ---
  const handleCopyLink = () => {
    if (!shareImage) return;
    const link = `${window.location.origin}/?share=${shareImage.id}`;
    navigator.clipboard.writeText(link);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const handleAddEmail = async () => {
    if (!shareImage || !newEmail) return;
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      alert("Invalid email address");
      return;
    }

    try {
      setInviteStatus('idle');
      const currentEmails = shareImage.allowed_emails || [];
      if (currentEmails.includes(newEmail)) {
        alert("Email already added");
        return;
      }

      const updatedEmails = [...currentEmails, newEmail];

      const { error } = await supabase
        .from('stego_images')
        .update({ allowed_emails: updatedEmails })
        .eq('id', shareImage.id);

      if (error) throw error;

      // Update local state
      const updatedImage = { ...shareImage, allowed_emails: updatedEmails };
      setShareImage(updatedImage); // Update modal view
      setImages(images.map(img => img.id === shareImage.id ? updatedImage : img)); // Update list view
      setNewEmail('');
      setInviteStatus('success');
      setTimeout(() => setInviteStatus('idle'), 3000);

    } catch (err) {
      console.error('Error adding email:', err);
      setInviteStatus('error');
    }
  };

  const handleRemoveEmail = async (emailToRemove: string) => {
    if (!shareImage) return;
    try {
      const updatedEmails = (shareImage.allowed_emails || []).filter(e => e !== emailToRemove);

      const { error } = await supabase
        .from('stego_images')
        .update({ allowed_emails: updatedEmails })
        .eq('id', shareImage.id);

      if (error) throw error;

      const updatedImage = { ...shareImage, allowed_emails: updatedEmails };
      setShareImage(updatedImage);
      setImages(images.map(img => img.id === shareImage.id ? updatedImage : img));
    } catch (err) {
      console.error("Error removing email", err);
      alert("Failed to remove email");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
      </div>

      {/* Toggle Tabs */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => setActiveTab('mine')}
          className={`px-6 py-2 rounded-full transition-all ${activeTab === 'mine'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
        >
          My Files ({images.filter(img => img.user_id === user?.id).length})
        </button>
        <button
          onClick={() => setActiveTab('shared')}
          className={`px-6 py-2 rounded-full transition-all ${activeTab === 'shared'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
        >
          Shared with Me ({images.filter(img => img.user_id !== user?.id).length})
        </button>
      </div>

      {activeTab === 'mine' ? (
        /* My Files Section */
        <div>
          {images.filter(img => img.user_id === user?.id).length === 0 ? (
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-12 text-center pointer-events-none select-none">
              <ImageIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-300 mb-2">
                No personal files yet
              </h3>
              <p className="text-slate-400">
                Embed a file to get started
              </p>
            </div>
          ) : (
            <div className="grid gap-4 mb-8">
              {images
                .filter(img => img.user_id === user?.id)
                .map((image) => (
                  <div
                    key={image.id}
                    className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-6 hover:border-slate-600 transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                          {image.filename}
                          {/* Visual Indicator if file is burned */}
                          {image.real_salt === 'BURNED' && (
                            <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded border border-red-900">
                              BURNED
                            </span>
                          )}
                        </h3>
                        <div className="flex gap-4 text-xs text-slate-400 mt-2">
                          <span className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" /> {formatBytes(image.file_size)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDate(image.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {/* Share Button */}
                        <button
                          onClick={() => setShareImage(image)}
                          className="p-2 bg-slate-700 hover:bg-slate-600 text-blue-400 rounded-lg transition-all"
                          title="Share"
                        >
                          <Share2 className="w-5 h-5" />
                        </button>

                        {/* BURN Button (Calls handleBurn) */}
                        <button
                          onClick={() => handleBurn(image)}
                          className="p-2 bg-slate-700 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all"
                          title="Remote Wipe (Burn)"
                        >
                          <Flame className="w-5 h-5" />
                        </button>

                        {/* DELETE Button (Calls handleDelete) */}
                        <button
                          onClick={() => handleDelete(image)}
                          className="p-2 bg-slate-700 hover:bg-red-900 text-slate-300 hover:text-white rounded-lg transition-all"
                          title="Delete Permanently"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>

                        {/* Download Button */}
                        <button
                          onClick={() => handleDownload(image)}
                          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
                          title="Download"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata Toggle Section */}
                    <div className="bg-slate-900/30 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Decryption Keys</span>
                        <button
                          onClick={() => toggleShowSalts(image.id)}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          {showSalts[image.id] ? (
                            <><EyeOff className="w-3 h-3" /> Hide</>
                          ) : (
                            <><Eye className="w-3 h-3" /> Reveal</>
                          )}
                        </button>
                      </div>

                      {showSalts[image.id] && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                          <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                            <p className="text-xs font-semibold text-green-400 mb-1">Real Volume</p>
                            <div className="space-y-1 font-mono text-[10px] text-slate-400 break-all">
                              <p><span className="text-slate-600">SALT:</span> {image.real_salt}</p>
                              <p><span className="text-slate-600">IV:</span> {image.real_iv}</p>
                            </div>
                          </div>
                          <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                            <p className="text-xs font-semibold text-amber-400 mb-1">Duress Volume</p>
                            <div className="space-y-1 font-mono text-[10px] text-slate-400 break-all">
                              <p><span className="text-slate-600">SALT:</span> {image.duress_salt}</p>
                              <p><span className="text-slate-600">IV:</span> {image.duress_iv}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        /* Shared with Me Section */
        <div>
          {images.filter(img => img.user_id !== user?.id).length === 0 ? (
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-12 text-center pointer-events-none select-none">
              <Share2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No files have been shared with you.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {images
                .filter(img => img.user_id !== user?.id)
                .map((image) => (
                  <div
                    key={image.id}
                    className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-6 hover:border-slate-600 transition-all border-l-4 border-l-purple-500"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                          {image.filename}
                          <span className="text-xs bg-purple-900/50 text-purple-400 px-2 py-0.5 rounded border border-purple-900">
                            SHARED
                          </span>
                        </h3>
                        <div className="flex gap-4 text-xs text-slate-400 mt-2">
                          <span className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" /> {formatBytes(image.file_size)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDate(image.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {/* Only Download for Shared Files */}
                        <button
                          onClick={() => handleDownload(image)}
                          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
                          title="Download"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata Toggle Section */}
                    <div className="bg-slate-900/30 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Decryption Keys</span>
                        <button
                          onClick={() => toggleShowSalts(image.id)}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          {showSalts[image.id] ? (
                            <><EyeOff className="w-3 h-3" /> Hide</>
                          ) : (
                            <><Eye className="w-3 h-3" /> Reveal</>
                          )}
                        </button>
                      </div>

                      {showSalts[image.id] && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                          <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                            <p className="text-xs font-semibold text-green-400 mb-1">Real Volume</p>
                            <div className="space-y-1 font-mono text-[10px] text-slate-400 break-all">
                              <p><span className="text-slate-600">SALT:</span> {image.real_salt}</p>
                              <p><span className="text-slate-600">IV:</span> {image.real_iv}</p>
                            </div>
                          </div>
                          <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                            <p className="text-xs font-semibold text-amber-400 mb-1">Duress Volume</p>
                            <div className="space-y-1 font-mono text-[10px] text-slate-400 break-all">
                              <p><span className="text-slate-600">SALT:</span> {image.duress_salt}</p>
                              <p><span className="text-slate-600">IV:</span> {image.duress_iv}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* SHARE MODAL */}
      {shareImage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl animate-fade-in relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-400" /> Share File
              </h3>
              <button onClick={() => setShareImage(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Link Section */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Secure Link</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 text-sm truncate font-mono">
                    {`${window.location.origin}/?share=${shareImage.id}`}
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className={`p-2 rounded-lg transition-all ${copyStatus ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                  >
                    {copyStatus ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Access List Section */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block flex justify-between">
                  <span>Authorized Users</span>
                  <span className="text-slate-600">{(shareImage.allowed_emails || []).length} users</span>
                </label>

                <div className="space-y-3 mb-4">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Add email address..."
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                    />
                    <button
                      onClick={handleAddEmail}
                      className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                      title="Add User"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  {inviteStatus === 'success' && <p className="text-xs text-green-400">User added successfully</p>}
                  {inviteStatus === 'error' && <p className="text-xs text-red-400">Failed to add user</p>}
                </div>

                <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {(shareImage.allowed_emails || []).length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4 bg-slate-950/50 rounded-lg border border-slate-800 border-dashed">
                      No one has access aside from you.
                    </p>
                  ) : (
                    shareImage.allowed_emails?.map(email => (
                      <div key={email} className="flex items-center justify-between bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-700/50">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                            {email.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-300 truncate">{email}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveEmail(email)}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                          title="Revoke Access"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/30 border-t border-slate-800 rounded-b-2xl text-center">
              <p className="text-xs text-slate-500">
                <ShieldCheck className="w-3 h-3 inline mr-1 text-green-400" />
                Only authorized users can decrypt this file.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
