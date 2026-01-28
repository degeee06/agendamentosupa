
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { PushNotifications } from '@capacitor/push-notifications';
import { Purchases } from '@revenuecat/purchases-capacitor';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

declare let jspdf: any;

// As chaves agora são carregadas de forma segura a partir das variáveis de ambiente.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PRODUCTION_URL = import.meta.env.VITE_PRODUCTION_URL;

// Substitua pela sua VAPID_PUBLIC_KEY gerada (ex: https://web-push-codelab.glitch.me/)
const VAPID_PUBLIC_KEY = "SUA_CHAVE_VAPID_PUBLICA_AQUI";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !PRODUCTION_URL) {
  const missingVars = [
    !SUPABASE_URL && "VITE_SUPABASE_URL",
    !SUPABASE_ANON_KEY && "VITE_SUPABASE_ANON_KEY",
    !PRODUCTION_URL && "VITE_PRODUCTION_URL"
  ].filter(Boolean).join(', ');
  throw new Error(`Variáveis de ambiente ausentes: ${missingVars}. Por favor, configure-as no seu arquivo .env ou nas configurações do seu provedor de hospedagem.`);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper para converter a chave VAPID para Uint8Array exigido pelo navegador
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

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
const PlusIcon = (props: any) => <Icon {...props}><line x1="12" cy="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></Icon>;
const UserIcon = (props: any) => <Icon {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></Icon>;
const LinkIcon = (props: any) => <Icon {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></Icon>;
const LogOutIcon = (props: any) => <Icon {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></Icon>;
const LoaderIcon = (props: any) => <Icon {...props} className="animate-spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></Icon>;
const XIcon = (props: any) => <Icon {...props}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></Icon>;
const SettingsIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1-2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></Icon>;
const StarIcon = (props: any) => <Icon {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></Icon>;
const ChevronLeftIcon = (props: any) => <Icon {...props}><polyline points="15 18 9 12 15 6"></polyline></Icon>;
const ChevronRightIcon = (props: any) => <Icon {...props}><polyline points="9 18 15 12 9 6"></polyline></Icon>;
const DownloadIcon = (props: any) => <Icon {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></Icon>;
const SendIcon = (props: any) => <Icon {...props}><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></Icon>;
const ChatBubbleIcon = (props: any) => <Icon {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></Icon>;
const MenuIcon = (props: any) => <Icon {...props}><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></Icon>;
const RefreshIcon = (props: any) => <Icon {...props}><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></Icon>;

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

const AppointmentCard = ({ appointment, onUpdateStatus, onDelete }: any) => (
  <div className="glassmorphism rounded-2xl p-6 flex flex-col space-y-4 transition-all duration-300 hover:border-gray-400 relative">
    <button onClick={() => onDelete(appointment.id)} className="absolute top-3 right-3 text-gray-500 hover:text-red-400 transition-colors z-10 p-1"><XIcon className="w-5 h-5" /></button>
    <div className="flex justify-between items-start">
      <div>
        <h3 className="text-lg font-bold text-white">{appointment.name}</h3>
        {appointment.phone && <p className="text-sm text-gray-400">{maskPhone(appointment.phone)}</p>}
      </div>
      <StatusBadge status={appointment.status} />
    </div>
    <div className="border-t border-gray-700/50 my-4"></div>
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0 text-sm text-gray-300">
      <div className="flex items-center space-x-2"><CalendarIcon className="w-4 h-4 text-gray-500" /><span>{parseDateAsUTC(appointment.date).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</span></div>
      <div className="flex items-center space-x-2"><ClockIcon className="w-4 h-4 text-gray-500" /><span>{appointment.time}</span></div>
    </div>
    {appointment.status !== 'Cancelado' && (
       <div className="flex items-center space-x-2 pt-4">
          {(appointment.status === 'Pendente' || appointment.status === 'Aguardando Pagamento') && (
            <button onClick={() => onUpdateStatus(appointment.id, 'Confirmado')} className="w-full flex justify-center items-center space-x-2 bg-green-500/20 hover:bg-green-500/40 text-green-300 font-semibold py-2 px-4 rounded-lg transition-colors duration-300"><CheckCircleIcon className="w-4 h-4" /><span>Confirmar</span></button>
          )}
          <button onClick={() => onUpdateStatus(appointment.id, 'Cancelado')} className="w-full flex justify-center items-center space-x-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 font-semibold py-2 px-4 rounded-lg transition-colors duration-300"><XCircleIcon className="w-4 h-4" /><span>Cancelar</span></button>
       </div>
    )}
  </div>
);

const Modal = ({ isOpen, onClose, title, children, size = 'md' }: any) => (
    <div className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}>
        <div className={`glassmorphism w-full ${size === 'xl' ? 'max-w-xl' : size === 'lg' ? 'max-w-lg' : 'max-w-md'} rounded-2xl p-6 border border-gray-700 relative transition-all duration-300 ease-in-out ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} onClick={(e) => e.stopPropagation()}>
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white"><XIcon className="w-6 h-6" /></button>
            <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>
            <div className="max-h-[80dvh] overflow-y-auto scrollbar-hide">{children}</div>
        </div>
    </div>
);

const PaymentModal = ({ isOpen, paymentData, onManualCheck }: any) => {
    const [isChecking, setIsChecking] = useState(false);
    return (
        <Modal isOpen={isOpen} onClose={() => {}} title="Pagamento Pix">
            <div className="flex flex-col items-center space-y-6">
                <p className="text-gray-300 text-center text-sm">Escaneie o QR Code no seu app do banco para confirmar seu agendamento.</p>
                <div className="bg-white p-4 rounded-xl">
                    <img src={`data:image/png;base64,${paymentData.qr_code_base64}`} alt="QR Code Pix" className="w-48 h-48 object-contain" />
                </div>
                <div className="w-full space-y-2">
                    <p className="text-xs text-gray-400 font-semibold">Código Pix Copia e Cola</p>
                    <div className="flex items-center space-x-2 bg-black/30 p-3 rounded-lg border border-gray-600">
                        <input type="text" value={paymentData.qr_code} readOnly className="bg-transparent text-white w-full outline-none text-xs truncate" />
                        <button onClick={() => { navigator.clipboard.writeText(paymentData.qr_code); alert("Copiado!"); }} className="bg-gray-600 text-white px-3 py-1 rounded text-xs">Copiar</button>
                    </div>
                </div>
                <button onClick={async () => { setIsChecking(true); await onManualCheck(paymentData.id); setIsChecking(false); }} disabled={isChecking} className="w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 py-3 rounded-lg flex justify-center items-center gap-2">
                    {isChecking ? <LoaderIcon className="w-5 h-5" /> : <RefreshIcon className="w-5 h-5" />}
                    Já realizei o pagamento
                </button>
            </div>
        </Modal>
    );
};

const PaginaDeAgendamento = ({ tokenId }: { tokenId: string }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [paymentData, setPaymentData] = useState<any>(null);
    const [professionalId, setProfessionalId] = useState<string | null>(null);

    const handleBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error: invokeError } = await supabase.functions.invoke('book-appointment-public', {
                body: { tokenId, name, phone, email, date, time }
            });

            if (invokeError) throw invokeError;
            if (data.error) throw new Error(data.error);

            const appointment = data.appointment;
            setProfessionalId(appointment.user_id);

            if (appointment.status === 'Aguardando Pagamento') {
                const { data: bizProfile } = await supabase.from('business_profiles').select('service_price, user_id').eq('user_id', appointment.user_id).single();
                if (bizProfile && bizProfile.service_price > 0) {
                    const { data: payData, error: payError } = await supabase.functions.invoke('create-payment', {
                        body: { amount: bizProfile.service_price, description: `Agendamento - ${name}`, professionalId: bizProfile.user_id, appointmentId: appointment.id, payerEmail: email || "cliente@email.com" }
                    });
                    if (payError) throw payError;
                    setPaymentData(payData);
                } else { setSuccess(true); }
            } else { setSuccess(true); }
        } catch (err: any) { setError(err.message || "Erro ao realizar agendamento."); } finally { setLoading(false); }
    };

    const handleManualCheck = async (paymentId: number) => {
        if (!professionalId) return;
        try {
            const { data } = await supabase.functions.invoke('create-payment', { body: { action: 'retrieve', paymentId, professionalId } });
            if (data && (data.status === 'approved' || data.status === 'paid')) { setSuccess(true); setPaymentData(null); } else { alert("Pagamento ainda não detectado."); }
        } catch (err) { alert("Erro ao verificar pagamento."); }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-black flex flex-col justify-center items-center p-6 text-center">
                <div className="glassmorphism p-10 rounded-3xl flex flex-col items-center max-w-sm">
                    <CheckCircleIcon className="w-20 h-20 text-green-400 mb-6" />
                    <h1 className="text-3xl font-bold text-white mb-2">Tudo certo!</h1>
                    <p className="text-gray-400">Seu agendamento foi confirmado.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex justify-center items-center p-4">
            <div className="glassmorphism w-full max-w-md p-8 rounded-2xl border border-gray-700">
                <h1 className="text-2xl font-bold text-white mb-6 text-center">Agendar Horário</h1>
                <form onSubmit={handleBooking} className="space-y-4">
                    <input type="text" placeholder="Nome Completo" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-black/40 border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-white transition-colors" />
                    <input type="tel" placeholder="WhatsApp" value={phone} onChange={e => setPhone(maskPhone(e.target.value))} required className="w-full bg-black/40 border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-white transition-colors" />
                    <input type="email" placeholder="E-mail (Opcional)" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black/40 border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-white transition-colors" />
                    <div className="grid grid-cols-2 gap-4">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-black/40 border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-white transition-colors" />
                        <input type="time" value={time} onChange={e => setTime(e.target.value)} required className="w-full bg-black/40 border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-white transition-colors" />
                    </div>
                    {error && <p className="text-red-400 text-sm text-center font-medium bg-red-400/10 p-2 rounded-lg">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full bg-white text-black font-bold py-4 rounded-xl flex justify-center items-center gap-2 hover:bg-gray-200 transition-colors disabled:opacity-50 mt-6">
                        {loading ? <LoaderIcon className="w-5 h-5" /> : "Confirmar Agendamento"}
                    </button>
                </form>
            </div>
            {paymentData && <PaymentModal isOpen={!!paymentData} paymentData={paymentData} onManualCheck={handleManualCheck} />}
        </div>
    );
};

const Dashboard = ({ user, profile, setProfile }: any) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        fetchDashboardData();
        registerForPushNotifications(user.id);
    }, [user.id]);

    const fetchDashboardData = useCallback(async () => {
        try {
            const { data } = await supabase.from('appointments').select('*').eq('user_id', user.id).order('date', { ascending: false });
            setAppointments(data || []);
        } finally { setIsLoading(false); }
    }, [user.id]);

    // Registro unificado de notificações (Capacitor + Navegador Web)
    const registerForPushNotifications = async (userId: string) => {
        try {
            if (Capacitor.isNativePlatform()) {
                let permStatus = await PushNotifications.checkPermissions();
                if (permStatus.receive === 'prompt') permStatus = await PushNotifications.requestPermissions();
                if (permStatus.receive === 'granted') {
                    await PushNotifications.register();
                    PushNotifications.addListener('registration', async (token) => {
                        await supabase.functions.invoke('register-push-token', { body: { token: token.value } });
                    });
                }
            } else if ("serviceWorker" in navigator && "PushManager" in window) {
                // Registro de Web Push nativo para o navegador
                const registration = await navigator.serviceWorker.register('/sw.js');
                let subscription = await registration.pushManager.getSubscription();
                
                if (!subscription) {
                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                    });
                }
                
                // Salva a inscrição (objeto JSON completo) como token
                await supabase.functions.invoke('register-push-token', { 
                    body: { token: JSON.stringify(subscription) } 
                });
            }
        } catch (error) {
            console.error("Erro ao configurar notificações push:", error);
        }
    };

    const handleUpdateStatus = async (id: string, status: any) => {
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
        await supabase.from('appointments').update({ status }).eq('id', id);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Excluir agendamento?")) {
            setAppointments(prev => prev.filter(a => a.id !== id));
            await supabase.from('appointments').delete().eq('id', id);
        }
    };

    return (
      <div className="flex h-[100dvh] bg-black overflow-hidden">
        <aside className={`fixed md:relative h-full w-64 glassmorphism p-6 flex flex-col z-40 transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <h1 className="text-2xl font-bold text-white mb-10">Oubook</h1>
            <nav className="flex-grow space-y-2">
                <button className="w-full flex items-center space-x-3 text-gray-300 bg-gray-700/50 p-3 rounded-lg"><CalendarIcon /><span>Agendamentos</span></button>
            </nav>
            <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center space-x-3 text-red-400 p-3 rounded-lg"><LogOutIcon /><span>Sair</span></button>
        </aside>
        <main className="flex-1 flex flex-col h-[100dvh] overflow-y-auto">
          <header className="glassmorphism p-6 sticky top-0 z-20 flex justify-between items-center">
             <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden"><MenuIcon /></button>
             <h2 className="text-xl font-bold">Painel</h2>
          </header>
          <div className="p-6">
             {isLoading ? <LoaderIcon className="mx-auto w-10 h-10" /> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {appointments.map(app => <AppointmentCard key={app.id} appointment={app} onUpdateStatus={handleUpdateStatus} onDelete={handleDelete} />)}
                </div>
             )}
          </div>
        </main>
      </div>
    );
};

const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [path, setPath] = useState(window.location.pathname);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) { setUser({ id: session.user.id, email: session.user.email }); }
            setIsLoading(false);
        });
        supabase.auth.onAuthStateChange((_event, session) => {
            if (session) { setUser({ id: session.user.id, email: session.user.email }); } else { setUser(null); }
        });
    }, []);

    if (isLoading) return <div className="min-h-screen bg-black flex justify-center items-center"><LoaderIcon className="w-16 h-16 text-white"/></div>;
    
    const pathParts = path.split('/').filter(Boolean);
    if (pathParts[0] === 'book-link' && pathParts[1]) return <PaginaDeAgendamento tokenId={pathParts[1]} />;
    
    return user ? <Dashboard user={user} /> : (
        <div className="min-h-screen flex flex-col justify-center items-center bg-black">
            <h1 className="text-5xl font-bold mb-10">Oubook</h1>
            <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })} className="bg-white text-black font-bold py-3 px-8 rounded-lg">Entrar com Google</button>
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
