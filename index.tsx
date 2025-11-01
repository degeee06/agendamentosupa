
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO SUPABASE ---
const supabaseUrl = 'https://ehosmvbealefukkbqggp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVob3NtdmJlYWxlZnVra2JxZ2dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMjIzMDgsImV4cCI6MjA3NzU5ODMwOH0.IKqwxawiPnZT__Djj6ISgnQOawKnbboJ1TfqhSTf89M';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- TIPOS ---
type Appointment = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  date: string;
  time: string;
  status: 'Pendente' | 'Confirmado' | 'Cancelado';
  user_id: string;
};

type User = {
  id: string;
  email?: string;
  user_metadata: {
    avatar_url: string;
    full_name: string;
  }
};

type Session = {
  user: User;
} | null;


// --- COMPONENTES DE ÍCONES (SVG) ---
const Icon = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {children}
  </svg>
);
const CalendarIcon = (props: React.SVGProps<SVGSVGElement>) => <Icon {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></Icon>;
const ClockIcon = (props: React.SVGProps<SVGSVGElement>) => <Icon {...props}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></Icon>;
const UserIcon = (props: React.SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></Icon>;
const MailIcon = (props: React.SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></Icon>;
const SearchIcon = (props: React.SVGProps<SVGSVGElement>) => <Icon {...props}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></Icon>;
const SettingsIcon = (props: React.SVGProps<SVGSVGElement>) => <Icon {...props}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></Icon>;
const LinkIcon = (props: React.SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></Icon>;
const LogOutIcon = (props: React.SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></Icon>;
const CheckIcon = (props: React.SVGProps<SVGSVGElement>) => <Icon {...props}><polyline points="20 6 9 17 4 12"></polyline></Icon>;
const XIcon = (props: React.SVGProps<SVGSVGElement>) => <Icon {...props}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></Icon>;
const CopyIcon = (props: React.SVGProps<SVGSVGElement>) => <Icon {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></Icon>;

// --- COMPONENTES DE UI ---
const Sidebar = ({ onSignOut, user, onShowLinkGenerator }: { onSignOut: () => void, user: User, onShowLinkGenerator: () => void }) => (
    <div className="w-64 bg-black p-6 flex flex-col fixed h-full">
        <h1 className="text-2xl font-bold text-white mb-12">Scheduler Pro</h1>
        <nav className="flex-grow">
            <a href="#" className="flex items-center text-gray-300 hover:text-white hover:bg-gray-900 p-3 rounded-lg transition-colors">
                <CalendarIcon className="mr-4" /> Agendamentos
            </a>
            <button onClick={onShowLinkGenerator} className="w-full flex items-center text-gray-300 hover:text-white hover:bg-gray-900 p-3 rounded-lg transition-colors mt-2">
                <LinkIcon className="mr-4" /> Links de Reserva
            </button>
            <a href="#" className="flex items-center text-gray-300 hover:text-white hover:bg-gray-900 p-3 rounded-lg transition-colors mt-2">
                <SettingsIcon className="mr-4" /> Configurações
            </a>
        </nav>
        <div className="mt-auto">
            <div className="flex items-center mb-4">
                <img src={user.user_metadata.avatar_url} alt="User Avatar" className="w-10 h-10 rounded-full mr-3" />
                <div>
                    <p className="font-semibold text-white">{user.user_metadata.full_name}</p>
                    <p className="text-sm text-gray-400">{user.email}</p>
                </div>
            </div>
            <button onClick={onSignOut} className="w-full flex items-center text-gray-400 hover:text-white hover:bg-red-800/50 p-3 rounded-lg transition-colors">
                <LogOutIcon className="mr-4" /> Sair
            </button>
        </div>
    </div>
);

const AppointmentCard = ({ appt, onUpdateStatus }: { appt: Appointment, onUpdateStatus: (id: string, status: 'Confirmado' | 'Cancelado') => void }) => {
    const statusColors = {
        Pendente: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-300',
        Confirmado: 'border-green-500/50 bg-green-500/10 text-green-300',
        Cancelado: 'border-red-500/50 bg-red-500/10 text-red-300',
    };
    const statusClass = statusColors[appt.status] || 'border-gray-500/50 bg-gray-500/10 text-gray-300';

    return (
        <div className="glassmorphism rounded-xl p-6 mb-4 border hover:border-gray-600 transition-all duration-300">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-bold text-white">{appt.name}</h3>
                    <p className="text-gray-400">{appt.email}</p>
                </div>
                <div className={`text-sm font-semibold px-3 py-1 rounded-full ${statusClass}`}>
                    {appt.status}
                </div>
            </div>
            <div className="border-t border-gray-800 my-4"></div>
            <div className="flex justify-between items-center text-gray-300">
                <div className="flex items-center">
                    <CalendarIcon className="w-5 h-5 mr-2" />
                    <span>{new Date(appt.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex items-center">
                    <ClockIcon className="w-5 h-5 mr-2" />
                    <span>{appt.time}</span>
                </div>
            </div>
            {appt.status === 'Pendente' && (
                <div className="mt-4 pt-4 border-t border-gray-800 flex gap-2">
                    <button onClick={() => onUpdateStatus(appt.id, 'Confirmado')} className="flex-1 bg-green-500/20 hover:bg-green-500/40 text-green-300 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                        <CheckIcon className="w-5 h-5" /> Confirmar
                    </button>
                    <button onClick={() => onUpdateStatus(appt.id, 'Cancelado')} className="flex-1 bg-red-500/20 hover:bg-red-500/40 text-red-300 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                        <XIcon className="w-5 h-5" /> Cancelar
                    </button>
                </div>
            )}
        </div>
    );
};

const NewAppointmentModal = ({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: (name: string, email: string, date: string, time: string) => Promise<void> }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave(name, email, date, time);
        setIsSaving(false);
        onClose();
        setName(''); setEmail(''); setDate(''); setTime('');
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="glassmorphism p-8 rounded-2xl w-full max-w-md border border-gray-700">
                <h2 className="text-2xl font-bold mb-6 text-white">Novo Agendamento</h2>
                <form onSubmit={handleSubmit}>
                    {/* Campos do formulário */}
                    <div className="mb-4">
                        <label className="block text-gray-400 mb-2">Nome</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gray-500" />
                    </div>
                    {/* ... outros campos ... */}
                    <div className="mb-4">
                        <label className="block text-gray-400 mb-2">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gray-500" />
                    </div>
                    <div className="flex gap-4 mb-6">
                        <div className="w-1/2">
                            <label className="block text-gray-400 mb-2">Data</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gray-500" />
                        </div>
                        <div className="w-1/2">
                            <label className="block text-gray-400 mb-2">Horário</label>
                            <input type="time" value={time} onChange={e => setTime(e.target.value)} required className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gray-500" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="bg-gray-200 hover:bg-gray-300 text-black font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50">
                            {isSaving ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const LinkGeneratorModal = ({ isOpen, onClose, userId }: { isOpen: boolean, onClose: () => void, userId: string }) => {
    const [copied, setCopied] = useState(false);
    if (!isOpen) return null;
    
    const link = `${window.location.origin}/book/${userId}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
            <div className="glassmorphism p-8 rounded-2xl w-full max-w-lg border border-gray-700" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4 text-white">Seu Link de Agendamento</h2>
                <p className="text-gray-400 mb-6">Compartilhe este link com seus clientes para que eles possam agendar um horário com você.</p>
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 flex items-center justify-between">
                    <p className="text-gray-300 truncate mr-4">{link}</p>
                    <button onClick={handleCopy} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2">
                        {copied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <CopyIcon className="w-5 h-5" />}
                        {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- PÁGINA PÚBLICA DE AGENDAMENTO ---
const PaginaDeAgendamento = ({ userId }: { userId: string }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess(false);

        const { error: insertError } = await supabase.from('appointments').insert({
            name, email, date, time, user_id: userId, status: 'Pendente'
        });
        
        setIsLoading(false);

        if (insertError) {
            setError('Ocorreu um erro ao agendar. Tente novamente.');
            console.error('Erro no agendamento:', insertError.message);
        } else {
            setSuccess(true);
            setName(''); setEmail(''); setDate(''); setTime('');
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-4">
                <div className="glassmorphism p-12 rounded-2xl border border-gray-700">
                    <CheckIcon className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <h1 className="text-3xl font-bold text-white mb-2">Agendamento Confirmado!</h1>
                    <p className="text-gray-300">Seu horário foi solicitado com sucesso. Você receberá uma confirmação em breve.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg">
                <div className="glassmorphism p-8 md:p-12 rounded-2xl border border-gray-700">
                    <h1 className="text-3xl font-bold text-center text-white mb-2">Marcar um Horário</h1>
                    <p className="text-gray-400 text-center mb-8">Preencha os dados abaixo para solicitar seu agendamento.</p>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-gray-400 mb-2">Seu Nome</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gray-500" />
                        </div>
                        <div className="mb-4">
                            <label className="block text-gray-400 mb-2">Seu Email</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gray-500" />
                        </div>
                        <div className="flex gap-4 mb-6">
                            <div className="w-1/2">
                                <label className="block text-gray-400 mb-2">Data</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gray-500" />
                            </div>
                            <div className="w-1/2">
                                <label className="block text-gray-400 mb-2">Horário</label>
                                <input type="time" value={time} onChange={e => setTime(e.target.value)} required className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gray-500" />
                            </div>
                        </div>
                        {error && <p className="text-red-400 text-center mb-4">{error}</p>}
                        <button type="submit" disabled={isLoading} className="w-full bg-gray-200 hover:bg-gray-300 text-black font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50">
                            {isLoading ? 'Enviando...' : 'Solicitar Agendamento'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// --- PAINEL DE ADMIN ---
const AdminDashboard = () => {
    const [session, setSession] = useState<Session>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState<'All' | 'Pendente' | 'Confirmado' | 'Cancelado'>('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

    const fetchAppointments = useCallback(async () => {
        // FIX: Replaced `getSession` with `session` for compatibility with older Supabase API.
        const session = supabase.auth.session();
        if (!session) {
            setIsLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .order('date', { ascending: true })
            .order('time', { ascending: true });

        if (error) {
            setError('Falha ao carregar agendamentos.');
            console.error(error.message);
        } else {
            setAppointments(data || []);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        // FIX: Replaced `getSession` with `session` for compatibility with older Supabase API.
        setSession(supabase.auth.session())

        const {
          // FIX: Adjusted destructuring for `onAuthStateChange` for compatibility with older Supabase API.
          data: subscription,
        } = supabase.auth.onAuthStateChange((_event, session) => {
          setSession(session)
        })
        
        fetchAppointments();
        const interval = setInterval(fetchAppointments, 15000); // Polling a cada 15s

        return () => {
            subscription.unsubscribe();
            clearInterval(interval);
        };
    }, [fetchAppointments]);

    const handleLogin = async () => {
        // FIX: Replaced `signInWithOAuth` with `signIn` and adjusted arguments for compatibility with older Supabase API.
        await supabase.auth.signIn({
            provider: 'google'
        }, {
            redirectTo: window.location.origin
        });
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setAppointments([]);
    };

    const handleSaveAppointment = async (name: string, email: string, date: string, time: string) => {
        // FIX: Replaced `getUser` with `user` for compatibility with older Supabase API.
        const user = supabase.auth.user();
        if (!user) return;
        const { data, error } = await supabase
            .from('appointments')
            .insert([{ name, email, date, time, user_id: user.id }])
            .select();

        if (error) {
            console.error("Erro ao salvar:", error.message);
        } else if (data) {
            fetchAppointments();
        }
    };
    
    const handleUpdateStatus = async (id: string, status: 'Confirmado' | 'Cancelado') => {
        const { error } = await supabase
            .from('appointments')
            .update({ status })
            .eq('id', id);

        if (error) {
            console.error("Erro ao atualizar status:", error.message);
        } else {
            fetchAppointments(); // Re-fetch para atualizar a UI imediatamente
        }
    };

    const filteredAppointments = useMemo(() => {
        return appointments
            .filter(appt => filter === 'All' || appt.status === filter)
            .filter(appt =>
                appt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                appt.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [appointments, filter, searchTerm]);

    if (!session) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-4">
                <div className="glassmorphism p-12 rounded-2xl border border-gray-700">
                    <h1 className="text-4xl font-bold text-white mb-4">Bem-vindo ao Scheduler Pro</h1>
                    <p className="text-gray-300 mb-8">Faça login para gerenciar seus agendamentos.</p>
                    <button onClick={handleLogin} className="bg-white text-black font-bold py-3 px-6 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center mx-auto">
                        <svg className="w-6 h-6 mr-3" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C43.021,36.251,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
                        Entrar com Google
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex h-screen bg-gray-900">
            <Sidebar onSignOut={handleSignOut} user={session.user} onShowLinkGenerator={() => setIsLinkModalOpen(true)} />
            <main className="flex-1 ml-64 p-8 overflow-y-auto scrollbar-hide">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold text-white">Agendamentos</h2>
                    <button onClick={() => setIsModalOpen(true)} className="bg-white text-black font-bold py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors">
                        + Novo Agendamento
                    </button>
                </div>

                <div className="flex items-center justify-between mb-6">
                    {/* Filtros */}
                    <div className="flex gap-2 p-1 bg-gray-800 rounded-lg">
                        {(['All', 'Pendente', 'Confirmado', 'Cancelado'] as const).map(status => (
                            <button key={status} onClick={() => setFilter(status)} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${filter === status ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>
                                {status === 'All' ? 'Todos' : status}
                            </button>
                        ))}
                    </div>

                    {/* Barra de busca */}
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gray-600"
                        />
                    </div>
                </div>
                
                {isLoading && <p className="text-center text-gray-400">Carregando agendamentos...</p>}
                {error && <p className="text-center text-red-400">{error}</p>}

                {!isLoading && !error && (
                    <div>
                        {filteredAppointments.length > 0 ? (
                            filteredAppointments.map(appt => <AppointmentCard key={appt.id} appt={appt} onUpdateStatus={handleUpdateStatus} />)
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                <p>Nenhum agendamento encontrado.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
            <NewAppointmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveAppointment} />
            {session.user && <LinkGeneratorModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} userId={session.user.id} />}
        </div>
    );
};

// --- ROTEADOR E RENDERIZAÇÃO ---
const App = () => {
    const path = window.location.pathname;

    if (path.startsWith('/book/')) {
        const userId = path.split('/book/')[1];
        if (userId) {
            return <PaginaDeAgendamento userId={userId} />;
        }
    }
    
    // Rota padrão é o painel de admin
    return <AdminDashboard />;
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
