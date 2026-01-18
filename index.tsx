
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { PushNotifications } from '@capacitor/push-notifications';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { RevenueCatUI, PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui';

declare let jspdf: any;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PRODUCTION_URL = import.meta.env.VITE_PRODUCTION_URL;
const REVENUECAT_ANDROID_KEY = import.meta.env.VITE_REVENUECAT_ANDROID_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !PRODUCTION_URL) {
  const missingVars = [
    !SUPABASE_URL && "VITE_SUPABASE_URL",
    !SUPABASE_ANON_KEY && "VITE_SUPABASE_ANON_KEY",
    !PRODUCTION_URL && "VITE_PRODUCTION_URL"
  ].filter(Boolean).join(', ');
  throw new Error(`Variáveis de ambiente ausentes: ${missingVars}.`);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Tipos
type Appointment = {
  id: string;
  created_at: string;
  name: string;
  email?: string;
  phone?: string;
  date: string;
  time: string;
  status: 'Pendente' | 'Confirmado' | 'Cancelado' | 'Aguardando Pagamento';
  user_id: string;
};

type Profile = {
    id: string;
    plan: 'trial' | 'premium';
    daily_usage: number;
    last_usage_date: string;
    terms_accepted_at?: string;
    premium_expires_at?: string;
};

type BusinessProfile = {
    user_id: string;
    blocked_dates: string[];
    blocked_times: { [key: string]: string[] };
    working_days: { [key: string]: boolean };
    start_time?: string;
    end_time?: string;
    service_price?: number;
}

type User = {
    id: string;
    email?: string;
};

type AssistantMessage = {
    sender: 'user' | 'ai' | 'system';
    text: string;
};

type PaymentData = {
    id: number;
    status: string;
    qr_code: string;
    qr_code_base64: string;
    ticket_url: string;
};

// --- Helpers ---
const parseDateAsUTC = (dateString: string): Date => {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
};

const maskPhone = (value: string) => {
    if (!value) return "";
    value = value.replace(/\D/g, '');
    value = value.substring(0, 11);
    if (value.length > 6) {
        value = value.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
    } else if (value.length > 2) {
        value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
    } else if (value.length > 0) {
        value = value.replace(/^(\d*)/, '($1');
    }
    return value;
};


// --- Ícones ---
const Icon = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{children}</svg>
);
const CalendarIcon = (props: any) => <Icon {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></Icon>;
const ClockIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></Icon>;
const CheckCircleIcon = (props: any) => <Icon {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></Icon>;
const XCircleIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></Icon>;
const SearchIcon = (props: any) => <Icon {...props}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></Icon>;
const PlusIcon = (props: any) => <Icon {...props}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></Icon>;
const UserIcon = (props: any) => <Icon {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></Icon>;
const MailIcon = (props: any) => <Icon {...props}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></Icon>;
const PhoneIcon = (props: any) => <Icon {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></Icon>;
const LinkIcon = (props: any) => <Icon {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></Icon>;
const LogOutIcon = (props: any) => <Icon {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></Icon>;
const AlertCircleIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></Icon>;
const LoaderIcon = (props: any) => <Icon {...props} className="animate-spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line></Icon>;
const XIcon = (props: any) => <Icon {...props}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></Icon>;
const SettingsIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></Icon>;
const StarIcon = (props: any) => <Icon {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></Icon>;
const ChevronLeftIcon = (props: any) => <Icon {...props}><polyline points="15 18 9 12 15 6"></polyline></Icon>;
const ChevronRightIcon = (props: any) => <Icon {...props}><polyline points="9 18 15 12 9 6"></polyline></Icon>;
const DownloadIcon = (props: any) => <Icon {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></Icon>;
const SendIcon = (props: any) => <Icon {...props}><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></Icon>;
const ChatBubbleIcon = (props: any) => <Icon {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></Icon>;
const MenuIcon = (props: any) => <Icon {...props}><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></Icon>;
const RefreshIcon = (props: any) => <Icon {...props}><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></Icon>;


// --- Componentes de UI ---
const StatusBadge = ({ status }: { status: Appointment['status'] }) => {
  const baseClasses = "px-3 py-1 text-xs font-medium rounded-full text-white";
  const statusClasses = {
    Pendente: "bg-yellow-500/20 text-yellow-300",
    'Aguardando Pagamento': "bg-orange-500/20 text-orange-300",
    Confirmado: "bg-green-500/20 text-green-300",
    Cancelado: "bg-red-500/20 text-red-300",
  };
  return <span className={`${baseClasses} ${statusClasses[status]}`}>{status}</span>;
};

type AppointmentCardProps = {
    appointment: Appointment;
    onUpdateStatus: (id: string, status: Appointment['status']) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
};

const AppointmentCard: React.FC<AppointmentCardProps> = ({ appointment, onUpdateStatus, onDelete }) => {
    return (
      <div className="glassmorphism rounded-2xl p-6 flex flex-col space-y-4 transition-all duration-300 hover:border-gray-400 relative">
        <button 
            onClick={() => onDelete(appointment.id)}
            className="absolute top-3 right-3 text-gray-500 hover:text-red-400 transition-colors z-10 p-1"
        >
            <XIcon className="w-5 h-5" />
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-white">{appointment.name}</h3>
            {appointment.phone && <p className="text-sm text-gray-400">{maskPhone(appointment.phone)}</p>}
          </div>
          <StatusBadge status={appointment['status']} />
        </div>
        <div className="border-t border-gray-700/50 my-4"></div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0 text-sm text-gray-300">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-4 h-4 text-gray-500" />
            <span>{parseDateAsUTC(appointment.date).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</span>
          </div>
          <div className="flex items-center space-x-2">
            <ClockIcon className="w-4 h-4 text-gray-500" />
            <span>{appointment.time}</span>
          </div>
        </div>
        {appointment.status !== 'Cancelado' && (
           <div className="flex items-center space-x-2 pt-4">
              {(appointment.status === 'Pendente' || appointment.status === 'Aguardando Pagamento') && (
                <button
                    onClick={() => onUpdateStatus(appointment.id, 'Confirmado')}
                    className="w-full flex justify-center items-center space-x-2 bg-green-500/20 hover:bg-green-500/40 text-green-300 font-semibold py-2 px-4 rounded-lg transition-colors duration-300"
                >
                    <CheckCircleIcon className="w-4 h-4" />
                    <span>Confirmar</span>
                </button>
              )}
              <button
                  onClick={() => onUpdateStatus(appointment.id, 'Cancelado')}
                  className="w-full flex justify-center items-center space-x-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 font-semibold py-2 px-4 rounded-lg transition-colors duration-300"
              >
                  <XCircleIcon className="w-4 h-4" />
                  <span>Cancelar</span>
              </button>
           </div>
        )}
      </div>
    );
};

const Modal = ({ isOpen, onClose, title, children, size = 'md' }: { isOpen: boolean, onClose: () => void, title: string, children?: React.ReactNode, size?: 'md' | 'lg' | 'xl' }) => {
    const sizeClasses = { md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' };
    return (
        <div className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}>
            <div className={`glassmorphism w-full ${sizeClasses[size]} rounded-2xl p-6 border border-gray-700 relative transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white"><XIcon className="w-6 h-6" /></button>
                <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>
                {children}
            </div>
        </div>
    );
};

const NewAppointmentModal = ({ isOpen, onClose, onSave, user }: { isOpen: boolean, onClose: () => void, onSave: (name: string, phone: string, email: string, date: string, time: string) => Promise<void>, user: User }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const unmaskedPhone = phone.replace(/\D/g, '');
        if (unmaskedPhone.length < 10) return alert('Telefone inválido.');
        setIsSaving(true);
        await onSave(name, unmaskedPhone, email, date, time);
        setIsSaving(false);
        setName(''); setEmail(''); setPhone(''); setDate(''); setTime('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Novo Agendamento">
            <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" placeholder="Nome do Cliente" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                <input type="tel" placeholder="Telefone" value={phone} onChange={e => setPhone(maskPhone(e.target.value))} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                <input type="time" value={time} onChange={e => setTime(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                <button type="submit" disabled={isSaving} className="w-full bg-gray-200 text-black font-bold py-3 px-4 rounded-lg hover:bg-white transition-colors disabled:opacity-50">
                    {isSaving ? <LoaderIcon className="w-6 h-6 mx-auto" /> : 'Salvar Agendamento'}
                </button>
            </form>
        </Modal>
    );
};

const UpgradeModal = ({ isOpen, onClose, limit, onUpgrade }: { isOpen: boolean, onClose: () => void, limit: number, onUpgrade: () => void }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Limite Diário Atingido">
            <div className="text-center">
                <AlertCircleIcon className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <p className="text-gray-300 mb-4">Você atingiu o limite de {limit} agendamentos diários.</p>
                <p className="text-sm text-gray-400 mb-6">Faça o upgrade para o plano Premium e tenha agendamentos ilimitados.</p>
                <button 
                    onClick={onUpgrade}
                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                >
                    🚀 Fazer Upgrade Ilimitado
                </button>
            </div>
        </Modal>
    );
};

// --- Dashboard Component ---
const Dashboard = ({ user, profile, setProfile }: { user: User, profile: Profile | null, setProfile: React.Dispatch<React.SetStateAction<Profile | null>>}) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'Todos' | Appointment['status']>('Todos');
    const [isLoading, setIsLoading] = useState(true);

    const TRIAL_LIMIT = 5;
    const usage = profile?.daily_usage ?? 0;
    const hasReachedLimit = profile?.plan === 'trial' && usage >= TRIAL_LIMIT;

    const handleUpgrade = async () => {
        try {
            if (!Capacitor.isNativePlatform()) {
                alert("O upgrade só está disponível no aplicativo nativo (Android/iOS).");
                return;
            }
            
            const { result } = await RevenueCatUI.presentPaywall();
            
            if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
                // Sincroniza com o backend via edge function de validação
                await supabase.functions.invoke('verify-google-purchase');
                
                // Atualiza estado local para refletir mudança imediata
                setProfile(prev => prev ? { ...prev, plan: 'premium' } : null);
                setIsUpgradeModalOpen(false);
                alert("Assinatura confirmada! Agora você é Premium.");
            }
        } catch (e) {
            console.error("Erro ao abrir Paywall:", e);
        }
    };

    const fetchDashboardData = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('appointments').select('*').eq('user_id', user.id).order('date', { ascending: false });
            if (error) throw error;
            setAppointments(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, [user.id]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleSaveAppointment = async (name: string, phone: string, email: string, date: string, time: string) => {
        if (hasReachedLimit) {
            setIsUpgradeModalOpen(true);
            return;
        }
        const { data, error } = await supabase.from('appointments').insert({ name, phone, email, date, time, user_id: user.id, status: 'Confirmado' }).select().single();
        if (!error && data) {
            setAppointments(prev => [data, ...prev]);
            if (profile?.plan === 'trial') {
                const today = new Date().toISOString().split('T')[0];
                const newUsage = (profile.last_usage_date === today ? profile.daily_usage : 0) + 1;
                await supabase.from('profiles').update({ daily_usage: newUsage, last_usage_date: today }).eq('id', user.id);
                setProfile(prev => prev ? { ...prev, daily_usage: newUsage, last_usage_date: today } : null);
            }
        }
    };

    const handleUpdateStatus = async (id: string, status: Appointment['status']) => {
        const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
        if (!error) setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Excluir agendamento permanentemente?")) {
            const { error } = await supabase.from('appointments').delete().eq('id', id);
            if (!error) setAppointments(prev => prev.filter(a => a.id !== id));
        }
    };

    const filtered = appointments.filter(a => (statusFilter === 'Todos' || a.status === statusFilter) && (a.name.toLowerCase().includes(searchTerm.toLowerCase())));

    return (
        <div className="flex h-screen bg-black">
            <aside className={`fixed md:relative h-full w-64 glassmorphism p-6 flex flex-col z-40 transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="flex items-center space-x-2 mb-10">
                    <CalendarIcon className="w-8 h-8 text-white" />
                    <h1 className="text-2xl font-bold">Oubook</h1>
                </div>
                <nav className="flex-grow space-y-2">
                    <button className="w-full flex items-center space-x-3 text-gray-300 bg-gray-700/50 p-3 rounded-lg"><CalendarIcon className="w-5 h-5"/><span>Agendamentos</span></button>
                    <button onClick={() => alert('Recurso em breve')} className="w-full flex items-center space-x-3 text-gray-300 hover:bg-gray-700/50 p-3 rounded-lg"><SettingsIcon className="w-5 h-5"/><span>Configurações</span></button>
                </nav>
                <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="w-full flex items-center space-x-3 text-red-400 hover:bg-red-500/10 p-3 rounded-lg"><LogOutIcon className="w-5 h-5"/><span>Sair</span></button>
            </aside>

            <main className="flex-1 flex flex-col overflow-y-auto">
                <header className="glassmorphism p-6 flex justify-between items-center sticky top-0 z-20">
                    <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden text-white"><MenuIcon /></button>
                    <h2 className="text-2xl font-bold">Início</h2>
                    <div className="flex items-center gap-4">
                        {profile?.plan === 'premium' ? (
                            <div className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-yellow-500/30">
                                <StarIcon className="w-3 h-3" /> PREMIUM
                            </div>
                        ) : (
                            <button onClick={handleUpgrade} className="bg-yellow-500 text-black px-4 py-2 rounded-lg text-xs font-bold">UPGRADE</button>
                        )}
                        <button onClick={() => setIsModalOpen(true)} className="bg-white text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2"><PlusIcon /> Novo</button>
                    </div>
                </header>

                <div className="p-6">
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <input type="text" placeholder="Pesquisar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 bg-black/20 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="bg-black/20 border border-gray-700 rounded-lg p-3 text-white">
                            <option value="Todos">Todos</option>
                            <option value="Confirmado">Confirmado</option>
                            <option value="Pendente">Pendente</option>
                            <option value="Cancelado">Cancelado</option>
                        </select>
                    </div>

                    {isLoading ? <LoaderIcon className="w-12 h-12 mx-auto" /> : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filtered.map(app => <AppointmentCard key={app.id} appointment={app} onUpdateStatus={handleUpdateStatus} onDelete={handleDelete} />)}
                        </div>
                    )}
                </div>
            </main>

            <NewAppointmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveAppointment} user={user} />
            <UpgradeModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} limit={TRIAL_LIMIT} onUpgrade={handleUpgrade} />
        </div>
    );
};

// --- App Root ---
const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function init() {
            try {
                // 1. Configura RevenueCat se for nativo
                if (Capacitor.isNativePlatform() && REVENUECAT_ANDROID_KEY) {
                    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
                    await Purchases.configure({ apiKey: REVENUECAT_ANDROID_KEY });
                }

                // 2. Auth do Supabase
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                    
                    // 3. Verifica Assinatura Ativa no RevenueCat
                    if (Capacitor.isNativePlatform()) {
                        try {
                            const { customerInfo } = await Purchases.getCustomerInfo();
                            const entitlementId = "premium"; // Deve bater com o ID no dashboard do RevenueCat
                            
                            if (typeof customerInfo.entitlements.active[entitlementId] !== "undefined") {
                                if (prof && prof.plan !== 'premium') {
                                    await supabase.from('profiles').update({ plan: 'premium' }).eq('id', session.user.id);
                                    prof.plan = 'premium';
                                }
                            }
                        } catch (e) {
                            console.error("Erro ao verificar entitlements:", e);
                        }
                    }

                    setUser({ id: session.user.id, email: session.user.email });
                    setProfile(prof);
                }
            } catch (e) {
                console.error("Erro ao inicializar aplicativo:", e);
            } finally {
                setIsLoading(false);
            }
        }
        init();

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                setUser({ id: session.user.id, email: session.user.email });
                setProfile(prof);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setProfile(null);
            }
        });

        return () => authListener.subscription.unsubscribe();
    }, []);

    if (isLoading) return <div className="min-h-screen bg-black flex justify-center items-center"><LoaderIcon className="w-16 h-16 text-white" /></div>;

    return user && profile ? (
        <Dashboard user={user} profile={profile} setProfile={setProfile} />
    ) : (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-black">
            <CalendarIcon className="w-20 h-20 mb-8" />
            <h1 className="text-4xl font-bold mb-4">Oubook</h1>
            <p className="text-gray-400 mb-8 text-center">Entre com sua conta Google para gerenciar seus horários.</p>
            <button 
                onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: PRODUCTION_URL } })}
                className="bg-white text-black font-bold py-4 px-8 rounded-xl flex items-center gap-3 hover:bg-gray-200 transition-colors"
            >
                <svg className="w-6 h-6" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h5.14c-.22 1.2-1.15 3.03-2.87 4.23l2.31 1.79c1.35-1.24 2.13-3.08 2.13-5.26 0-.5-.05-.88-.13-1.49zM12.18 18.28c-2.3 0-4.25-1.52-4.95-3.59l-2.38 1.84c1.44 2.86 4.41 4.82 7.87 4.82 2.16 0 3.97-.72 5.3-1.94l-2.31-1.79c-.37.24-.92.42-1.53.42zM7.23 11.1c-.13.4-.21.82-.21 1.27s.08.87.21 1.27l2.38-1.84c-.05-.22-.08-.45-.08-.7s.03-.48.08-.7L7.23 11.1zM12.18 6.05c1.5 0 2.53.65 3.11 1.2l2.31-2.31c-1.5-1.4-3.45-2.25-5.42-2.25-3.46 0-6.43 1.96-7.87 4.82l2.38 1.84c.7-2.07 2.65-3.59 4.95-3.59z"/></svg>
                Entrar com Google
            </button>
        </div>
    );
};

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
