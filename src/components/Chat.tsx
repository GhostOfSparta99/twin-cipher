import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
    Send,
    Trash2,
    UserPlus,
    MessageSquare,
    Lock,
    Paperclip,
    User
} from 'lucide-react';

type Contact = {
    id: string;        // ID for the list key
    contact_id: string; // The actual User ID
    email: string;
    is_saved: boolean;  // To distinguish manual contacts from auto-discovered ones
};

type Message = {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    created_at: string;
    is_stego: boolean;
};

export default function Chat() {
    const { user } = useAuth();

    const [conversations, setConversations] = useState<Contact[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [activeContact, setActiveContact] = useState<Contact | null>(null);

    const [newMessage, setNewMessage] = useState('');
    const [newContactEmail, setNewContactEmail] = useState('');
    const [loading, setLoading] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. Load Conversations (Contacts + Incoming Messages)
    useEffect(() => {
        if (user) fetchConversations();
    }, [user]);

    // 2. Global Realtime Listener (For Sidebar & Chat)
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`global_chat:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `receiver_id=eq.${user.id}`, // Listen for ANY message sent to me
                },
                async (payload) => {
                    const newMsg = payload.new as Message;

                    // A. If chat is open with this person, append message
                    if (activeContact && newMsg.sender_id === activeContact.contact_id) {
                        setMessages((prev) => [...prev, newMsg]);
                    }

                    // B. Update Sidebar: If this sender isn't in our list, add them dynamically
                    setConversations(currentList => {
                        const exists = currentList.some(c => c.contact_id === newMsg.sender_id);
                        if (!exists) {
                            // Fetch profile for the new sender
                            fetchSenderProfile(newMsg.sender_id).then(newContact => {
                                if (newContact) setConversations(prev => [newContact, ...prev]);
                            });
                        }
                        return currentList;
                    });
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user, activeContact]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load messages when opening a chat
    useEffect(() => {
        if (activeContact && user) {
            fetchMessages(activeContact.contact_id);
        }
    }, [activeContact, user]);

    // --- DATA FETCHING ---

    const fetchConversations = async () => {
        try {
            // 1. Get Manual Contacts
            const { data: contactsData } = await supabase
                .from('contacts')
                .select('id, contact_id, email')
                .order('created_at', { ascending: false });

            const savedContacts: Contact[] = (contactsData || []).map(c => ({
                ...c,
                is_saved: true
            }));

            // 2. Get People who messaged me (but aren't in contacts)
            // We get unique sender_ids from messages table
            const { data: msgData } = await supabase
                .from('messages')
                .select('sender_id')
                .eq('receiver_id', user!.id);

            const senderIds = [...new Set(msgData?.map(m => m.sender_id))];
            const existingIds = new Set(savedContacts.map(c => c.contact_id));
            const newSenderIds = senderIds.filter(id => !existingIds.has(id));

            let autoContacts: Contact[] = [];

            if (newSenderIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, email')
                    .in('id', newSenderIds);

                autoContacts = (profiles || []).map(p => ({
                    id: `auto_${p.id}`,
                    contact_id: p.id,
                    email: p.email,
                    is_saved: false
                }));
            }

            // Combine lists
            setConversations([...savedContacts, ...autoContacts]);
        } catch (err) {
            console.error('Error loading chats:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSenderProfile = async (senderId: string): Promise<Contact | null> => {
        const { data } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('id', senderId)
            .single();

        if (data) {
            return {
                id: `auto_${data.id}`,
                contact_id: data.id,
                email: data.email,
                is_saved: false
            };
        }
        return null;
    };

    const fetchMessages = async (contactId: string) => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${user!.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user!.id})`)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            console.error('Error loading messages:', err);
        }
    };

    // --- ACTIONS ---

    const handleAddContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newContactEmail.trim()) return;

        try {
            // Check profile exists
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, email')
                .eq('email', newContactEmail)
                .single();

            if (!profile) {
                alert('User not found');
                return;
            }
            if (profile.id === user?.id) {
                alert("Cannot add yourself");
                return;
            }

            // Add to DB
            const { data: newContactRow, error } = await supabase
                .from('contacts')
                .insert({ user_id: user!.id, contact_id: profile.id, email: profile.email })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') alert('Already in contacts');
                else throw error;
                return;
            }

            // Add to UI state
            const newContact: Contact = { ...newContactRow, is_saved: true };

            // Remove duplicate if it was already in the "auto" list
            setConversations(prev => [
                newContact,
                ...prev.filter(c => c.contact_id !== profile.id)
            ]);

            setNewContactEmail('');
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteContact = async (c: Contact, e: React.MouseEvent) => {
        e.stopPropagation();

        // If it's a saved contact, delete from DB
        if (c.is_saved) {
            if (!confirm('Remove from contacts?')) return;
            await supabase.from('contacts').delete().eq('contact_id', c.contact_id);
        }

        // Remove from UI (for both saved and auto-discovered)
        setConversations(conversations.filter(item => item.id !== c.id));
        if (activeContact?.id === c.id) setActiveContact(null);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeContact) return;

        const msgContent = newMessage;
        setNewMessage('');

        try {
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    sender_id: user!.id,
                    receiver_id: activeContact.contact_id,
                    content: msgContent
                })
                .select()
                .single();

            if (error) throw error;
            setMessages(prev => [...prev, data]);
        } catch (err) {
            console.error('Error sending:', err);
            alert('Failed to send');
        }
    };

    const handleDeleteMessage = async (msgId: string) => {
        if (!confirm("Burn this message?")) return;
        await supabase.from('messages').delete().eq('id', msgId);
        setMessages(messages.filter(m => m.id !== msgId));
    };

    // --- RENDER ---

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-6 text-white">
            {/* Sidebar */}
            <div className="w-80 flex flex-col bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700">
                <div className="p-4 border-b border-slate-700">
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <UserPlus className="w-5 h-5 text-blue-400" />
                        Inbox
                    </h2>
                    <form onSubmit={handleAddContact} className="relative">
                        <input
                            type="email"
                            placeholder="Start new chat..."
                            className="w-full bg-slate-900/50 border border-slate-600 rounded-lg py-2 px-3 text-sm text-white focus:ring-2 focus:ring-blue-600 outline-none"
                            value={newContactEmail}
                            onChange={(e) => setNewContactEmail(e.target.value)}
                        />
                        <button type="submit" className="absolute right-2 top-2 text-slate-400 hover:text-blue-400">
                            <UserPlus className="w-4 h-4" />
                        </button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {conversations.map(c => (
                        <div
                            key={c.id}
                            onClick={() => setActiveContact(c)}
                            className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${activeContact?.id === c.id ? 'bg-blue-600 shadow-lg' : 'hover:bg-slate-700/50'
                                }`}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                {!c.is_saved && <User className="w-4 h-4 text-slate-400" />} {/* Icon for unsaved */}
                                <p className={`font-medium truncate ${!c.is_saved ? 'italic text-slate-300' : ''}`}>
                                    {c.email}
                                </p>
                            </div>
                            <button
                                onClick={(e) => handleDeleteContact(c, e)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-600 rounded-lg transition-opacity"
                                title={c.is_saved ? "Remove contact" : "Hide conversation"}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Chat */}
            <div className="flex-1 flex flex-col bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 overflow-hidden">
                {activeContact ? (
                    <>
                        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    {activeContact.email}
                                    {!activeContact.is_saved && (
                                        <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-normal">
                                            New
                                        </span>
                                    )}
                                </h3>
                                <div className="flex items-center gap-1 text-xs text-green-400">
                                    <Lock className="w-3 h-3" /> Secure Channel
                                </div>
                            </div>
                            <button onClick={() => setActiveContact(null)} className="md:hidden text-slate-400">Close</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map(msg => {
                                const isMe = msg.sender_id === user?.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] relative group ${isMe ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200'} px-4 py-2 rounded-2xl`}>
                                            <p>{msg.content}</p>
                                            <span className="text-[10px] opacity-70 mt-1 block text-right">
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {isMe && (
                                                <button
                                                    onClick={() => handleDeleteMessage(msg.id)}
                                                    className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700 bg-slate-800/80">
                            <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-600 rounded-xl px-2 py-1">
                                <input
                                    type="text"
                                    placeholder="Type secure message..."
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-white py-3 px-2 outline-none"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                />
                                <button type="submit" disabled={!newMessage.trim()} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                        <MessageSquare className="w-16 h-16 mb-4 text-slate-600" />
                        <p>Select a conversation from the inbox</p>
                    </div>
                )}
            </div>
        </div>
    );
}
