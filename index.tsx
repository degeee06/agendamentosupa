import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { PushNotifications } from '@capacitor/push-notifications';


declare let jspdf: any;

// As chaves agora são carregadas de forma segura a partir das variáveis de ambiente.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PRODUCTION_URL = import.meta.env.VITE_PRODUCTION_URL;
const MP_CLIENT_ID = import.meta.env.VITE_MP_CLIENT_ID;
const MP_REDIRECT_URL = import.meta.env.VITE_MP_REDIRECT_URL;

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
    service_price?: number; // Adicionado preço do serviço
}

type User = {
    id: string;
    email?: string;
};

type AssistantMessage = {
    sender: 'user' | 'ai' | 'system';
    text: string;
};

type PaymentResponse = {
    id: number;
    status: string;
    qr_code: string;
    qr_code_base64: string;
    ticket_url: string;
}


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

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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
const MailIcon = (props: any) => <Icon {...props}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></Icon>;
const PhoneIcon = (props: any) => <Icon {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></Icon>;
const LinkIcon = (props: any) => <Icon {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></Icon>;
const LogOutIcon = (props: any) => <Icon {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></Icon>;
const CopyIcon = (props: any) => <Icon {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></Icon>;
const AlertCircleIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></Icon>;
const LoaderIcon = (props: any) => <Icon {...props} className="animate-spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></Icon>;
const XIcon = (props: any) => <Icon {...props}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></Icon>;
const SettingsIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></Icon>;
const StarIcon = (props: any) => <Icon {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></Icon>;
const ChevronLeftIcon = (props: any) => <Icon {...props}><polyline points="15 18 9 12 15 6"></polyline></Icon>;
const ChevronRightIcon = (props: any) => <Icon {...props}><polyline points="9 18 15 12 9 6"></polyline></Icon>;
const DownloadIcon = (props: any) => <Icon {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></Icon>;
const BotIcon = (props: any) => <Icon {...props}><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="M12 12v-2" /></Icon>;
const SendIcon = (props: any) => <Icon {...props}><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></Icon>;
const ChatBubbleIcon = (props: any) => <Icon {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></Icon>;
const MenuIcon = (props: any) => <Icon {...props}><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></Icon>;
const QrCodeIcon = (props: any) => <Icon {...props}><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></Icon>;
const WalletIcon = (props: any) => <Icon {...props}><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"></path></Icon>;


// --- Componentes de UI ---
const StatusBadge = ({ status }: { status: Appointment['status'] }) => {
  const baseClasses = "px-3 py-1 text-xs font-medium rounded-full text-white";
  const statusClasses = {
    Pendente: "bg-yellow-500/20 text-yellow-300",
    "Aguardando Pagamento": "bg-orange-500/20 text-orange-300",
    Confirmado: "bg-green-500/20 text-green-300",
    Cancelado: "bg-red-500/20 text-red-300",
  };
  return <span className={`${baseClasses} ${statusClasses[status] || statusClasses['Pendente']}`}>{status}</span>;
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
            aria-label="Excluir agendamento permanentemente"
        >
            <XIcon className="w-5 h-5" />
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-white">{appointment.name}</h3>
            {appointment.phone && <p className="text-sm text-gray-400">{maskPhone(appointment.phone)}</p>}
            {appointment.email && <p className="text-xs text-gray-500">{appointment.email}</p>}
          </div>
          <StatusBadge status={appointment.status} />
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
    const sizeClasses = {
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
    };
    return (
        <div 
            className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
            onClick={onClose}
        >
            <div 
                className={`glassmorphism w-full ${sizeClasses[size]} rounded-2xl p-6 border border-gray-700 relative transition-all duration-300 ease-in-out ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} 
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                    <XIcon className="w-6 h-6" />
                </button>
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
        if (unmaskedPhone.length < 10 || unmaskedPhone.length > 11) {
            alert('Por favor, insira um telefone válido com 10 ou 11 dígitos (DDD + número).');
            return;
        }
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
                <input type="tel" placeholder="Telefone do Cliente (DDD + Número)" value={phone} onChange={e => setPhone(maskPhone(e.target.value))} required maxLength={15} className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                <input type="email" placeholder="Email do Cliente (Opcional)" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                <input type="time" value={time} onChange={e => setTime(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                <button type="submit" disabled={isSaving} className="w-full bg-gray-200 text-black font-bold py-3 px-4 rounded-lg hover:bg-white transition-colors disabled:opacity-50">
                    {isSaving ? <LoaderIcon className="w-6 h-6 mx-auto" /> : 'Salvar Agendamento'}
                </button>
            </form>
        </Modal>
    );
};

const BusinessProfileModal = ({ isOpen, onClose, userId }: { isOpen: boolean, onClose: () => void, userId: string }) => {
    const [profile, setProfile] = useState<BusinessProfile>({ user_id: userId, blocked_dates: [], blocked_times: {}, working_days: {}, start_time: '09:00', end_time: '17:00', service_price: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [newBlockedDate, setNewBlockedDate] = useState('');
    const [newBlockedTime, setNewBlockedTime] = useState('');
    const [selectedDay, setSelectedDay] = useState('monday');

    const daysOfWeek = { monday: "Segunda", tuesday: "Terça", wednesday: "Quarta", thursday: "Quinta", friday: "Sexta", saturday: "Sábado", sunday: "Domingo" };
    const defaultWorkingDays = { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false };

    useEffect(() => {
        if (isOpen) {
            const fetchProfile = async () => {
                setIsLoading(true);
                const [profileRes, connectionRes] = await Promise.all([
                    supabase.from('business_profiles').select('*').eq('user_id', userId).single(),
                    supabase.from('mp_connections').select('user_id').eq('user_id', userId).single()
                ]);
                
                if (profileRes.data) {
                    setProfile({
                        ...profileRes.data,
                        blocked_dates: profileRes.data.blocked_dates || [],
                        blocked_times: profileRes.data.blocked_times || {},
                        working_days: profileRes.data.working_days || defaultWorkingDays,
                        start_time: profileRes.data.start_time || '09:00',
                        end_time: profileRes.data.end_time || '17:00',
                        service_price: profileRes.data.service_price || 0,
                    });
                } else {
                    setProfile(p => ({ ...p, working_days: defaultWorkingDays }));
                }

                if (connectionRes.data) setIsConnected(true);

                setIsLoading(false);
            };
            fetchProfile();
        }
    }, [isOpen, userId]);

    const handleSave = async () => {
        setIsSaving(true);
        const { error } = await supabase.from('business_profiles').upsert(profile, { onConflict: 'user_id' });
        if (error) {
            console.error("Erro ao salvar perfil de negócio:", error);
        } else {
            onClose();
        }
        setIsSaving(false);
    };

    const handleConnectMP = () => {
        if (!MP_CLIENT_ID || !MP_REDIRECT_URL) {
            alert(`ERRO DE CONFIGURAÇÃO:\nVariáveis do Mercado Pago não encontradas.\n\nVITE_MP_CLIENT_ID: ${MP_CLIENT_ID ? 'OK' : 'NÃO DEFINIDO'}\nVITE_MP_REDIRECT_URL: ${MP_REDIRECT_URL ? 'OK' : 'NÃO DEFINIDO'}\n\nVerifique seu arquivo .env ou as variáveis no Vercel.`);
            return;
        }
        
        const redirectUrl = encodeURIComponent(MP_REDIRECT_URL);
        // O state é usado para passar o ID do usuário para o callback
        const authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${MP_CLIENT_ID}&response_type=code&platform_id=mp&state=${userId}&redirect_uri=${redirectUrl}`;
        
        window.location.href = authUrl;
    };

    // ... (rest of helper functions like handleWorkingDayChange, addBlockedDate, etc. remain same)
    const handleWorkingDayChange = (day: string) => setProfile(p => ({...p, working_days: {...p.working_days, [day]: !p.working_days[day]}}));
    const handleTimeChange = (field: 'start_time' | 'end_time', value: string) => setProfile(p => ({ ...p, [field]: value }));
    const addBlockedDate = () => { if (newBlockedDate && !profile.blocked_dates.includes(newBlockedDate)) { setProfile(p => ({ ...p, blocked_dates: [...p.blocked_dates, newBlockedDate].sort() })); setNewBlockedDate(''); }};
    const removeBlockedDate = (date: string) => setProfile(p => ({ ...p, blocked_dates: p.blocked_dates.filter(d => d !== date) }));
    const addBlockedTime = () => { if (newBlockedTime && !profile.blocked_times[selectedDay]?.includes(newBlockedTime)) { setProfile(p => ({...p, blocked_times: {...p.blocked_times, [selectedDay]: [...(p.blocked_times[selectedDay]||[]), newBlockedTime].sort()}})); setNewBlockedTime(''); }};
    const removeBlockedTime = (day: string, time: string) => setProfile(p => ({...p, blocked_times: {...p.blocked_times, [day]: (p.blocked_times[day]||[]).filter(t => t !== time)}}));


    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Configurações do Perfil" size="lg">
            {isLoading ? <LoaderIcon className="w-8 h-8 mx-auto" /> : (
                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 scrollbar-hide">
                    {/* Pagamentos */}
                    <div className="bg-black/30 p-4 rounded-lg border border-gray-700">
                        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                            <WalletIcon className="w-5 h-5 text-green-400"/> Recebimento Online (Pix)
                        </h3>
                        
                        <div className="mb-4">
                            <label className="text-sm text-gray-400 mb-1 block">Preço do Serviço (R$)</label>
                            <input 
                                type="number" 
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={profile.service_price || ''} 
                                onChange={e => setProfile(p => ({ ...p, service_price: parseFloat(e.target.value) }))} 
                                className="w-full bg-black/20 border border-gray-600 rounded-lg p-2 text-white" 
                            />
                            <p className="text-xs text-gray-500 mt-1">Defina 0 para agendamento gratuito.</p>
                        </div>

                        {isConnected ? (
                            <div className="flex items-center text-green-400 bg-green-900/20 p-3 rounded-lg border border-green-500/30">
                                <CheckCircleIcon className="w-5 h-5 mr-2" />
                                <span>Conta Mercado Pago Conectada</span>
                            </div>
                        ) : (
                            <button 
                                onClick={handleConnectMP}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                Conectar Mercado Pago
                            </button>
                        )}
                    </div>

                    {/* Working Hours */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-3">Horário de Funcionamento</h3>
                        <div className="flex items-center space-x-4">
                            <div className="w-1/2">
                                <label className="text-sm text-gray-400 mb-1 block">Início</label>
                                <input type="time" value={profile.start_time} onChange={e => handleTimeChange('start_time', e.target.value)} className="w-full bg-black/20 border border-gray-600 rounded-lg p-2 text-white" />
                            </div>
                            <div className="w-1/2">
                                <label className="text-sm text-gray-400 mb-1 block">Fim</label>
                                <input type="time" value={profile.end_time} onChange={e => handleTimeChange('end_time', e.target.value)} className="w-full bg-black/20 border border-gray-600 rounded-lg p-2 text-white" />
                            </div>
                        </div>
                    </div>
                    {/* Working Days */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-3">Dias de Funcionamento</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {Object.entries(daysOfWeek).map(([key, value]) => (
                                <label key={key} className="flex items-center space-x-3 bg-black/20 p-3 rounded-lg cursor-pointer hover:bg-black/40 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={!!profile.working_days[key]}
                                        onChange={() => handleWorkingDayChange(key)}
                                        className="h-5 w-5 accent-gray-400 bg-gray-700 border-gray-600 rounded focus:ring-gray-500"
                                    />
                                    <span className="text-white text-sm font-medium">{value}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    {/* Blocked Dates */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">Bloquear Datas Específicas</h3>
                        <div className="flex space-x-2">
                            <input type="date" value={newBlockedDate} onChange={e => setNewBlockedDate(e.target.value)} className="w-full bg-black/20 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-400" />
                            <button onClick={addBlockedDate} className="bg-gray-600 text-white px-4 py-1 rounded-lg text-sm hover:bg-gray-500">Adicionar</button>
                        </div>
                        <ul className="mt-2 space-y-1">
                            {profile.blocked_dates.map(date => (
                                <li key={date} className="flex justify-between items-center bg-black/20 p-2 rounded">
                                    <span className="text-sm text-gray-300">{parseDateAsUTC(date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                                    <button onClick={() => removeBlockedDate(date)} className="text-red-400 hover:text-red-300"><XIcon className="w-4 h-4" /></button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Blocked Times */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">Bloquear Horários Recorrentes</h3>
                        <div className="flex space-x-2 mb-2">
                            <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)} className="w-1/2 bg-black/20 border border-gray-600 rounded-lg p-2 text-white">
                                {Object.entries(daysOfWeek).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                            </select>
                            <input type="time" value={newBlockedTime} onChange={e => setNewBlockedTime(e.target.value)} className="w-1/2 bg-black/20 border border-gray-600 rounded-lg p-2 text-white" />
                            <button onClick={addBlockedTime} className="bg-gray-600 text-white px-4 py-1 rounded-lg text-sm hover:bg-gray-500">Adicionar</button>
                        </div>
                        <div className="space-y-2">
                            {Object.entries(daysOfWeek).map(([key, value]) => (
                                (profile.blocked_times[key]?.length ?? 0) > 0 && (
                                    <div key={key}>
                                        <p className="text-sm font-bold text-gray-300">{value}</p>
                                        <ul className="flex flex-wrap gap-2 mt-1">
                                            {(profile.blocked_times[key] || []).map(time => (
                                                <li key={time} className="flex items-center space-x-2 bg-black/20 px-2 py-1 rounded text-sm text-gray-300">
                                                    <span>{time}</span>
                                                    <button onClick={() => removeBlockedTime(key, time)} className="text-red-400 hover:text-red-300"><XIcon className="w-3 h-3"/></button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                    
                    <button onClick={handleSave} disabled={isSaving} className="w-full bg-gray-200 text-black font-bold py-3 px-4 rounded-lg hover:bg-white transition-colors disabled:opacity-50 mt-4">
                        {isSaving ? <LoaderIcon className="w-6 h-6 mx-auto" /> : 'Salvar Configurações'}
                    </button>
                </div>
            )}
        </Modal>
    );
};

const PaginaDeAgendamento = ({ tokenId }: { tokenId: string }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    
    const [adminId, setAdminId] = useState<string | null>(null);
    const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
    const [appointments, setAppointments] = useState<{ date: string; time: string; }[]>([]);
    
    const [linkStatus, setLinkStatus] = useState<'loading' | 'valid' | 'invalid' | 'used'>('loading');
    const [bookingCompleted, setBookingCompleted] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    
    // Estado para pagamento Pix
    const [paymentData, setPaymentData] = useState<PaymentResponse | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [appointmentId, setAppointmentId] = useState<string | null>(null);
    const [recoveringSession, setRecoveringSession] = useState(false);

    const dayMap = useMemo(() => ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], []);

    useEffect(() => {
        const validateLinkAndFetchData = async () => {
            try {
                setLinkStatus('loading');
                // Agora selecionamos também o appointment_id para checar se há uma sessão pendente
                const { data: linkData, error: linkError } = await supabase
                    .from('one_time_links')
                    .select('user_id, is_used, appointment_id')
                    .eq('id', tokenId)
                    .single();

                if (linkError || !linkData) {
                    setLinkStatus('invalid');
                    return;
                }

                // Se o link foi usado, verificamos se é um caso de pagamento pendente
                if (linkData.is_used) {
                    let recovered = false;
                    if (linkData.appointment_id) {
                         const { data: appt } = await supabase.from('appointments').select('*').eq('id', linkData.appointment_id).single();
                         if (appt && appt.status === 'Aguardando Pagamento') {
                             console.log("Sessão recuperada: aguardando pagamento");
                             setRecoveringSession(true);
                             setAppointmentId(appt.id);
                             // Vamos prosseguir para carregar os dados do admin para mostrar o modal de pagamento
                             // mas marcamos recovered = true para não setar 'used'
                             recovered = true;
                             // Preenchemos os dados básicos caso precise re-exibir algo de fundo, embora o modal vá cobrir
                             setName(appt.name);
                             setPhone(appt.phone || '');
                         }
                    }
                    
                    if (!recovered) {
                        setLinkStatus('used');
                        return;
                    }
                }

                const currentAdminId = linkData.user_id;
                setAdminId(currentAdminId);

                const [profileRes, businessProfileRes, appointmentsRes] = await Promise.all([
                    supabase.from('profiles').select('*').eq('id', currentAdminId).single(),
                    supabase.from('business_profiles').select('*').eq('user_id', currentAdminId).single(),
                    supabase.from('appointments').select('date, time').eq('user_id', currentAdminId).in('status', ['Pendente', 'Confirmado'])
                ]);

                if (profileRes.error) throw profileRes.error;
                
                setAdminProfile(profileRes.data);
                setAppointments(appointmentsRes.data || []);
                
                const bizProfile = businessProfileRes.data || { user_id: currentAdminId, blocked_dates: [], blocked_times: {}, working_days: {}, start_time: '09:00', end_time: '17:00', service_price: 0 };
                setBusinessProfile(bizProfile);

                setLinkStatus('valid');

                // Se estamos recuperando a sessão, acionamos o pagamento agora que temos o perfil (preço)
                if (recoveringSession && linkData.appointment_id && bizProfile.service_price) {
                    // Re-gerar/Recuperar QR Code
                    // Como não temos os dados originais de email/descrição aqui fácil sem outra query, usamos genéricos
                    // O importante é que o ID do agendamento seja o mesmo para o Idempotency Key do MP funcionar ou o backend tratar
                    setIsSaving(true);
                    const { data: paymentRes, error: paymentError } = await supabase.functions.invoke('create-payment', {
                        body: {
                            amount: bizProfile.service_price,
                            description: `Retomada de Pagamento`, 
                            professionalId: currentAdminId,
                            appointmentId: linkData.appointment_id,
                            payerEmail: 'cliente@retomada.com' // Email genérico se não tivermos o original fácil, ou poderíamos ter buscado no appointment
                        }
                    });
                    setIsSaving(false);

                    if (!paymentError && paymentRes) {
                        setPaymentData(paymentRes);
                        setShowPaymentModal(true);
                    } else {
                        setMessage({ type: 'error', text: 'Erro ao recuperar dados de pagamento.' });
                    }
                }

            } catch (error) {
                console.error('Erro ao buscar dados do admin:', error);
                setLinkStatus('invalid');
            }
        };
        validateLinkAndFetchData();
    }, [tokenId]);
    
    // Realtime listener para confirmação automática do pagamento
    useEffect(() => {
        if (!appointmentId) return;
        
        const channel = supabase
            .channel(`appointment-status-${appointmentId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `id=eq.${appointmentId}` },
                (payload) => {
                    if (payload.new.status === 'Confirmado') {
                        setShowPaymentModal(false);
                        setBookingCompleted(true);
                    }
                }
            )
            .subscribe();
            
        return () => { supabase.removeChannel(channel); };
    }, [appointmentId]);


    const isDayAvailable = useCallback((date: Date): boolean => {
        if (!businessProfile) return false;

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        if (date < today) return false;

        const dateString = date.toISOString().split('T')[0];
        const dayOfWeek = dayMap[date.getUTCDay()];
        
        if (businessProfile.working_days && !businessProfile.working_days[dayOfWeek]) return false;
        if (businessProfile.blocked_dates && businessProfile.blocked_dates.includes(dateString)) return false;
        
        return true;
    }, [businessProfile, dayMap]);

    const availableTimeSlots = useMemo(() => {
        if (!selectedDate || !businessProfile) return [];
        
        const slots = [];
        const startTime = businessProfile.start_time || '09:00';
        const endTime = businessProfile.end_time || '17:00';

        const [startHour] = startTime.split(':').map(Number);
        const [endHour] = endTime.split(':').map(Number);

        for (let hour = startHour; hour < endHour; hour++) {
            slots.push(`${String(hour).padStart(2, '0')}:00`);
        }

        const dateString = selectedDate.toISOString().split('T')[0];
        const dayOfWeek = dayMap[selectedDate.getUTCDay()];

        const bookedTimes = appointments
            .filter(a => a.date === dateString)
            .map(a => a.time);
            
        const blockedRecurringTimes = businessProfile.blocked_times?.[dayOfWeek] || [];

        return slots.filter(slot => 
            !bookedTimes.includes(slot) && 
            !blockedRecurringTimes.includes(slot)
        );
    }, [selectedDate, businessProfile, appointments, dayMap]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !selectedTime || !adminId) return;

        setMessage(null);
        const unmaskedPhone = phone.replace(/\D/g, '');
        if (unmaskedPhone.length < 10 || unmaskedPhone.length > 11) {
            setMessage({ type: 'error', text: 'Por favor, insira um telefone válido com 10 ou 11 dígitos (DDD + número).' });
            return;
        }

        setIsSaving(true);
        
        const dateString = selectedDate.toISOString().split('T')[0];

        try {
            // 1. Cria o agendamento (Status: Aguardando Pagamento)
            const { data: bookingData, error: bookingError } = await supabase.functions.invoke('book-appointment-public', {
                body: {
                    tokenId: tokenId,
                    name: name,
                    phone: unmaskedPhone,
                    email: email,
                    date: dateString,
                    time: selectedTime,
                },
            });

            if (bookingError) {
                throw new Error((bookingData as any)?.error || 'Ocorreu um erro ao agendar.');
            }
            
            const newApptId = bookingData.appointment.id;
            setAppointmentId(newApptId);

            // 2. Verifica se precisa pagar
            const price = businessProfile?.service_price || 0;

            if (price > 0) {
                // 3. Gera Pix
                const { data: paymentRes, error: paymentError } = await supabase.functions.invoke('create-payment', {
                    body: {
                        amount: price,
                        description: `Agendamento ${dateString} ${selectedTime}`,
                        professionalId: adminId,
                        appointmentId: newApptId,
                        payerEmail: email || 'cliente@sememail.com'
                    }
                });
                
                if (paymentError) {
                    console.error("Erro no pagamento:", paymentError);
                    throw new Error("Profissional não configurou o pagamento corretamente ou erro ao gerar Pix.");
                }

                setPaymentData(paymentRes);
                setShowPaymentModal(true);
            } else {
                // Se for gratuito, já confirma direto
                // (Idealmente o book-appointment já deixaria confirmado se fosse grátis, mas aqui simplificamos a atualização)
                 await supabase.from('appointments').update({ status: 'Confirmado' }).eq('id', newApptId);
                 setBookingCompleted(true);
            }

        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setIsSaving(false);
        }
    };
    
    const copyPix = () => {
        if (paymentData?.qr_code) {
            navigator.clipboard.writeText(paymentData.qr_code);
            alert("Código Pix copiado!");
        }
    };

    // ... (Calendar and render logic remain similar, just adding Payment Modal)
    const handleDateSelect = (date: Date) => {
        if (isDayAvailable(date)) {
            setSelectedDate(date);
            setSelectedTime(null);
        }
    };
    
    const changeMonth = (amount: number) => {
      setCurrentMonth(prev => {
          const newDate = new Date(prev.getFullYear(), prev.getMonth() + amount, 1);
          return newDate;
      });
    };

    const Calendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = Array.from({ length: firstDay }, (_, i) => <div key={`empty-${i}`}></div>);
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(Date.UTC(year, month, day));
            const isAvailable = isDayAvailable(date);
            const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
            
            let classes = "w-10 h-10 flex items-center justify-center rounded-full transition-colors text-sm ";
            if (isAvailable) {
                classes += isSelected 
                    ? "bg-gray-200 text-black font-bold" 
                    : "bg-black/20 text-white hover:bg-gray-700 cursor-pointer";
            } else {
                classes += "text-gray-600 cursor-not-allowed";
            }
            
            days.push(
                <button key={day} onClick={() => handleDateSelect(date)} disabled={!isAvailable} className={classes}>
                    {day}
                </button>
            );
        }

        return (
            <div className="bg-black/20 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <button type="button" onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-700"><ChevronLeftIcon className="w-5 h-5 text-white"/></button>
                    <h3 className="font-bold text-white text-lg">{currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
                    <button type="button" onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-700"><ChevronRightIcon className="w-5 h-5 text-white"/></button>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-xs text-gray-400 mb-2">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={`${d}-${i}`}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {days}
                </div>
            </div>
        );
    };
    
    if (bookingCompleted) {
        return (
            <div className="min-h-screen bg-black flex justify-center items-center text-center p-4">
                <div className="glassmorphism rounded-2xl p-8 max-w-md w-full">
                    <CheckCircleIcon className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">Agendamento Confirmado!</h1>
                    <p className="text-gray-400 mb-4">
                        Seu horário foi reservado com sucesso.
                    </p>
                </div>
            </div>
        );
    }

    if (linkStatus === 'loading') {
        return <div className="min-h-screen bg-black flex justify-center items-center"><LoaderIcon className="w-12 h-12 text-white" /></div>;
    }

    if (linkStatus === 'invalid' || linkStatus === 'used') {
        return (
            <div className="min-h-screen bg-black flex justify-center items-center text-center p-4">
                <div className="glassmorphism rounded-2xl p-8">
                    <AlertCircleIcon className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">{linkStatus === 'used' ? 'Link Utilizado' : 'Link Inválido'}</h1>
                    <p className="text-gray-400">
                        {linkStatus === 'used' 
                            ? 'Este link de agendamento já foi utilizado.' 
                            : 'Este link de agendamento é inválido ou expirou.'}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">Por favor, solicite um novo link ao profissional.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md mx-auto">
                {showPaymentModal && paymentData ? (
                    <div className="glassmorphism rounded-2xl p-6 sm:p-8 text-center">
                        <h2 className="text-2xl font-bold text-white mb-4">Pagamento Pix</h2>
                        <p className="text-gray-400 mb-6">Escaneie o QR Code ou copie o código abaixo para pagar.</p>
                        
                        <div className="bg-white p-4 rounded-lg inline-block mb-6">
                            <img src={`data:image/png;base64,${paymentData.qr_code_base64}`} alt="QR Code Pix" className="w-48 h-48" />
                        </div>
                        
                        <div className="mb-6">
                            <p className="text-sm text-gray-400 mb-2">Total a pagar</p>
                            <p className="text-2xl font-bold text-green-400">{formatCurrency(businessProfile?.service_price || 0)}</p>
                        </div>

                        <button onClick={copyPix} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 mb-4">
                            <CopyIcon className="w-5 h-5" /> Copiar Código Pix
                        </button>
                        
                        <div className="flex items-center justify-center gap-2 text-sm text-yellow-400 animate-pulse">
                            <LoaderIcon className="w-4 h-4" /> Aguardando confirmação...
                        </div>
                    </div>
                ) : (
                    <div className="glassmorphism rounded-2xl p-6 sm:p-8">
                        <h1 className="text-2xl sm:text-3xl font-bold text-center text-white mb-2">Agendar Horário</h1>
                        <p className="text-gray-400 text-center mb-8">Preencha os dados abaixo para confirmar seu horário.</p>

                        {message && <div className={`p-4 rounded-lg mb-4 text-center ${message.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{message.text}</div>}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <input type="text" placeholder="Seu Nome" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" />
                            <input type="tel" placeholder="Seu Telefone (DDD + Número)" value={phone} onChange={e => setPhone(maskPhone(e.target.value))} required maxLength={15} className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" />
                            <input type="email" placeholder="Seu Email (Opcional)" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" />
                            
                            <Calendar />

                            {selectedDate && (
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2 text-center">Horários disponíveis para {selectedDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</h3>
                                    {availableTimeSlots.length > 0 ? (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                            {availableTimeSlots.map(time => (
                                                <button 
                                                    key={time} 
                                                    type="button"
                                                    onClick={() => setSelectedTime(time)}
                                                    className={`p-2 rounded-lg text-sm transition-colors ${selectedTime === time ? 'bg-gray-200 text-black font-bold' : 'bg-black/20 text-white hover:bg-gray-700'}`}
                                                >
                                                    {time}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-center text-gray-500">Nenhum horário disponível para esta data.</p>
                                    )}
                                </div>
                            )}
                            
                            {businessProfile?.service_price && businessProfile.service_price > 0 && (
                                <div className="bg-black/30 p-4 rounded-lg border border-gray-700 text-center">
                                    <p className="text-gray-400 text-sm">Valor do Serviço</p>
                                    <p className="text-xl font-bold text-white">{formatCurrency(businessProfile.service_price)}</p>
                                    <p className="text-xs text-gray-500 mt-1">Pagamento via Pix necessário para confirmação.</p>
                                </div>
                            )}

                            <button type="submit" disabled={isSaving || !selectedDate || !selectedTime || !name || !phone} className="w-full bg-gray-200 text-black font-bold py-3 px-4 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                {isSaving ? <LoaderIcon className="w-6 h-6 mx-auto" /> : (businessProfile?.service_price && businessProfile.service_price > 0 ? 'Ir para Pagamento' : 'Confirmar Agendamento')}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

// ... (rest of components: LoginPage, TermsModal, UpgradeModal, AssistantModal, LinkGeneratorModal stay exactly the same, just kept App below for the callback logic)

// --- Re-adding Modal Helpers kept for context ---
const LinkGeneratorModal = ({ isOpen, onClose, userId }: { isOpen: boolean; onClose: () => void; userId: string }) => {
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setGeneratedLink(null);
            setCopied(false);
            setError(null);
        }
    }, [isOpen]);

    const handleGenerateLink = async () => {
        setIsGenerating(true);
        setError(null);
        setCopied(false);
        try {
            const { data, error } = await supabase
                .from('one_time_links')
                .insert({ user_id: userId })
                .select('id')
                .single();
            
            if (error || !data) throw error || new Error("Erro ID link.");
            setGeneratedLink(`${PRODUCTION_URL}/book-link/${data.id}`);
        } catch (err: any) {
            setError("Não foi possível gerar o link.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = () => {
        if (!generatedLink) return;
        navigator.clipboard.writeText(generatedLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Link de Agendamento">
            <div className="space-y-4">
                <p className="text-gray-300">Gere um link único para seu cliente.</p>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                {generatedLink ? (
                    <div className="flex items-center space-x-2 bg-black/30 p-3 rounded-lg border border-gray-600">
                        <LinkIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <input type="text" value={generatedLink} readOnly className="bg-transparent text-white w-full outline-none text-sm" />
                        <button onClick={handleCopy} className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-500 transition-colors flex-shrink-0">{copied ? 'Copiado!' : 'Copiar'}</button>
                    </div>
                ) : null}
                <button onClick={handleGenerateLink} disabled={isGenerating} className="w-full bg-gray-200 text-black font-bold py-3 px-4 rounded-lg hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center space-x-2">
                    {isGenerating ? <LoaderIcon className="w-6 h-6" /> : <><LinkIcon className="w-5 h-5" /><span>{generatedLink ? 'Gerar Novo' : 'Gerar Link'}</span></>}
                </button>
            </div>
        </Modal>
    );
};

const UpgradeModal = ({ isOpen, onClose, limit }: { isOpen: boolean, onClose: () => void, limit: number }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Limite Diário Atingido">
            <div className="text-center">
                <AlertCircleIcon className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <p className="text-gray-300 mb-4">Você atingiu o limite de {limit} usos diários.</p>
                <a href="https://pay.hotmart.com/U102480243K?checkoutMode=2" className="hotmart-fb hotmart__button-checkout w-full">🚀 Fazer Upgrade Ilimitado</a>
            </div>
        </Modal>
    );
};

const TermsModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Termos de Uso" size="xl">
            <div className="text-gray-300 space-y-4 max-h-[60vh] overflow-y-auto pr-4 scrollbar-hide">
                <p>Ao utilizar nosso sistema, você concorda com estes termos.</p>
                 <button onClick={onClose} className="w-full mt-6 bg-gray-200 text-black font-bold py-3 px-4 rounded-lg hover:bg-white transition-colors">Entendi</button>
            </div>
        </Modal>
    );
};

const AssistantModal = ({ isOpen, onClose, messages, onSendMessage, isLoading }: { isOpen: boolean; onClose: () => void; messages: AssistantMessage[]; onSendMessage: (message: string) => void; isLoading: boolean; }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(scrollToBottom, [messages, isLoading]);
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (input.trim() && !isLoading) { onSendMessage(input.trim()); setInput(''); } };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Assistente IA" size="lg">
            <div className="flex flex-col h-[60vh]">
                <div className="flex-1 overflow-y-auto space-y-4 p-4 scrollbar-hide">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${msg.sender === 'user' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-200'}`}><p className="text-sm">{msg.text}</p></div>
                        </div>
                    ))}
                    {isLoading && <div className="flex justify-start"><div className="max-w-xs lg:max-w-md px-4 py-2 rounded-2xl bg-gray-800 text-gray-200"><LoaderIcon className="w-5 h-5 text-gray-400" /></div></div>}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSubmit} className="mt-4 flex items-center space-x-2">
                    <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Ex: Agendar para João..." className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-gray-500" disabled={isLoading} />
                    <button type="submit" disabled={isLoading || !input.trim()} className="p-3 bg-gray-600 rounded-lg text-white hover:bg-gray-500 transition-colors disabled:opacity-50"><SendIcon className="w-6 h-6" /></button>
                </form>
            </div>
        </Modal>
    );
};

const LoginPage = () => {
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    useEffect(() => { if (localStorage.getItem('termsAccepted') === 'true') setTermsAccepted(true); }, []);
    
    const handleLogin = async () => {
        if (!termsAccepted) { alert("Aceite os termos."); return; }
        const redirectTo = Capacitor.isNativePlatform() ? 'com.oubook.app://auth-callback' : window.location.origin;
        const { error, data } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: Capacitor.isNativePlatform() } });
        if (error) console.error(error);
        if (data?.url && Capacitor.isNativePlatform()) await Browser.open({ url: data.url, windowName: '_self' });
    };

    return (
        <>
            <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4 text-center">
                 <CalendarIcon className="w-16 h-16 text-white mx-auto mb-4" />
                 <h1 className="text-4xl font-bold text-white mb-2">Oubook</h1>
                 <p className="text-gray-400 mb-8">Gerencie agendamentos inteligentemente.</p>
                 <div className="my-6">
                    <label className="flex items-center justify-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={termsAccepted} onChange={() => {setTermsAccepted(!termsAccepted); if(!termsAccepted) localStorage.setItem('termsAccepted','true');}} className="h-4 w-4 accent-gray-400 bg-gray-800 border-gray-600 rounded" />
                        <span className="text-sm text-gray-400">Aceito os <button type="button" onClick={() => setIsTermsModalOpen(true)} className="underline hover:text-white">Termos</button></span>
                    </label>
                 </div>
                 <button onClick={handleLogin} disabled={!termsAccepted} className="w-full max-w-sm bg-white text-black font-bold py-3 px-8 rounded-lg flex items-center justify-center space-x-3 disabled:opacity-50">
                    <span>Entrar com Google</span>
                 </button>
            </div>
            <TermsModal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} />
        </>
    );
};

const Dashboard = ({ user, profile, setProfile }: { user: User, profile: Profile | null, setProfile: React.Dispatch<React.SetStateAction<Profile | null>>}) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [statusFilter, setStatusFilter] = useState<'Pendente' | 'Confirmado' | 'Cancelado' | 'Aguardando Pagamento' | 'Todos'>('Todos');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isAssistantModalOpen, setIsAssistantModalOpen] = useState(false);
    const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([{ sender: 'ai', text: 'Como posso ajudar hoje?' }]);
    const [isAssistantLoading, setIsAssistantLoading] = useState(false);

    const TRIAL_LIMIT = 5;
    const usage = profile?.daily_usage ?? 0;
    const hasReachedLimit = profile?.plan === 'trial' && usage >= TRIAL_LIMIT;

    useEffect(() => {
        const scriptId = 'hotmart-script';
        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script'); script.id = scriptId; script.src = 'https://static.hotmart.com/checkout/widget.min.js'; script.async = true; document.head.appendChild(script);
            const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://static.hotmart.com/css/hotmart-fb.min.css'; document.head.appendChild(link);
        }
    }, []);

    const fetchDashboardData = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('appointments').select('*').eq('user_id', user.id).order('date', { ascending: false }).order('time', { ascending: false }).range(0, 19);
            if (error) throw error;
            setAppointments(data || []);
            setHasMore((data || []).length === 20);
            setCurrentPage(1);
        } catch (error) { console.error("Erro dashboard:", error); } finally { setIsLoading(false); }
    }, [user.id]);
    
    const handleLoadMore = async () => {
        if (isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        const from = currentPage * 20;
        const { data, error } = await supabase.from('appointments').select('*').eq('user_id', user.id).order('date', { ascending: false }).order('time', { ascending: false }).range(from, from + 19);
        if (!error && data) { setAppointments(prev => [...prev, ...data]); setHasMore(data.length === 20); setCurrentPage(p => p + 1); }
        setIsLoadingMore(false);
    };

    useEffect(() => {
        if (!user.id) return;
        fetchDashboardData();
        const channel = supabase.channel(`db-changes-${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `user_id=eq.${user.id}` }, (payload) => {
                if (payload.eventType === 'INSERT') setAppointments(p => [payload.new as Appointment, ...p].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                if (payload.eventType === 'UPDATE') setAppointments(p => p.map(a => a.id === payload.new.id ? payload.new as Appointment : a));
                if (payload.eventType === 'DELETE') setAppointments(p => p.filter(a => a.id !== payload.old.id));
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user.id, fetchDashboardData]);
    
    useEffect(() => {
        if (Capacitor.isNativePlatform() && user.id) {
             PushNotifications.requestPermissions().then(res => { if (res.receive === 'granted') PushNotifications.register(); });
             PushNotifications.addListener('registration', token => supabase.functions.invoke('register-push-token', { body: { token: token.value } }));
        }
    }, [user.id]);

    const filteredAppointments = useMemo(() => appointments.filter(app => (statusFilter === 'Todos' || app.status === statusFilter) && (app.name.toLowerCase().includes(searchTerm.toLowerCase()) || app.email?.includes(searchTerm) || app.phone?.includes(searchTerm))), [appointments, statusFilter, searchTerm]);

    const handleSaveAppointment = async (name: string, phone: string, email: string, date: string, time: string) => {
        if (!profile) return;
        if (hasReachedLimit) { setIsUpgradeModalOpen(true); return; }
        const { data, error } = await supabase.from('appointments').insert({ name, phone, email, date, time, user_id: user.id }).select().single();
        if (!error && data) {
            setAppointments(p => [data, ...p]);
            if (profile.plan === 'trial') setProfile(p => p ? ({...p, daily_usage: p.daily_usage + 1}) : null);
        }
    };
    
    const handleSendMessageToAssistant = async (message: string) => {
        const newMsgs = [...assistantMessages, { sender: 'user' as const, text: message }];
        setAssistantMessages(newMsgs); setIsAssistantLoading(true);
        try {
            const { data: biz } = await supabase.from('business_profiles').select('*').eq('user_id', user.id).single();
            const { data } = await supabase.functions.invoke('deepseek-assistant', { body: { messages: newMsgs.map(m => ({ role: m.sender === 'ai' ? 'assistant' : 'user', content: m.text })), context: `Biz: ${JSON.stringify(biz || {})}`, currentDate: new Date().toISOString() } });
            const content = data.choices[0].message.content;
            setAssistantMessages(p => [...p, { sender: 'ai', text: content }]);
        } catch (e) { setAssistantMessages(p => [...p, { sender: 'ai', text: 'Erro ao processar.' }]); } finally { setIsAssistantLoading(false); }
    };

    const handleUpdateStatus = async (id: string, status: Appointment['status']) => {
        setAppointments(p => p.map(a => a.id === id ? { ...a, status } : a));
        await supabase.from('appointments').update({ status }).eq('id', id);
    };

    const handleDeleteAppointment = async (id: string) => {
        if (window.confirm('Excluir?')) { setAppointments(p => p.filter(a => a.id !== id)); await supabase.from('appointments').delete().eq('id', id); }
    };
    
    const handleDownloadPDF = () => {
        if (!jspdf) return;
        const doc = new jspdf.jsPDF();
        doc.autoTable({ head: [["Cliente", "Data", "Hora", "Status"]], body: filteredAppointments.map(a => [a.name, a.date, a.time, a.status]) });
        doc.save("agendamentos.pdf");
    };

    return (
      <div className="flex h-screen bg-black overflow-hidden">
        {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}
        <aside className={`fixed md:relative h-full w-64 glassmorphism p-6 flex flex-col z-40 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <h1 className="text-2xl font-bold text-white mb-10 flex items-center gap-2"><CalendarIcon className="w-8 h-8"/> Oubook</h1>
            <nav className="flex-grow space-y-2">
                <button className="w-full flex items-center space-x-3 text-gray-300 bg-gray-700/50 p-3 rounded-lg"><CalendarIcon className="w-5 h-5"/><span>Agendamentos</span></button>
                <button onClick={() => hasReachedLimit ? setIsUpgradeModalOpen(true) : setIsLinkModalOpen(true)} className="w-full flex items-center space-x-3 text-gray-300 hover:bg-gray-700/50 p-3 rounded-lg"><LinkIcon className="w-5 h-5"/><span>Links</span></button>
                <button onClick={() => setIsProfileModalOpen(true)} className="w-full flex items-center space-x-3 text-gray-300 hover:bg-gray-700/50 p-3 rounded-lg"><SettingsIcon className="w-5 h-5"/><span>Configurações</span></button>
            </nav>
             <div className="border-t border-gray-700/50 pt-4">
                <div className="flex items-center space-x-3 mb-4"><UserIcon className="w-10 h-10 p-2 bg-gray-700 rounded-full"/><p className="font-semibold text-white truncate">{user.email?.split('@')[0]}</p></div>
                <button onClick={() => { supabase.auth.signOut(); window.location.reload(); }} className="w-full flex items-center space-x-3 text-gray-300 hover:text-red-300 p-3 rounded-lg"><LogOutIcon className="w-5 h-5"/><span>Sair</span></button>
             </div>
        </aside>

        <main className="flex-1 flex flex-col h-screen overflow-y-auto scrollbar-hide">
          <header className="glassmorphism p-4 flex justify-between items-center sticky top-0 z-20">
             <div className="flex items-center gap-2"><button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-gray-300"><MenuIcon className="w-6 h-6" /></button><h2 className="text-2xl font-bold text-white">Agendamentos</h2></div>
             <div className="flex items-center gap-2">
                {profile?.plan === 'premium' ? <div className="glassmorphism px-3 py-1 rounded text-sm flex items-center gap-1 text-green-300"><StarIcon className="w-4 h-4 text-yellow-400"/> Premium</div> : <a href="https://pay.hotmart.com/U102480243K?checkoutMode=2" className="hotmart-fb hotmart__button-checkout text-xs">UPGRADE</a>}
                <button onClick={handleDownloadPDF} className="p-2 text-gray-300 hover:bg-gray-700 rounded"><DownloadIcon className="w-5 h-5" /></button>
                <button onClick={() => setIsAssistantModalOpen(true)} className="p-2 text-gray-300 hover:bg-gray-700 rounded"><ChatBubbleIcon className="w-5 h-5" /></button>
                <button onClick={() => hasReachedLimit ? setIsUpgradeModalOpen(true) : setIsModalOpen(true)} className="bg-white text-black font-bold py-2 px-4 rounded flex items-center gap-2 hover:bg-gray-200"><PlusIcon className="w-5 h-5"/> <span className="hidden sm:inline">Novo</span></button>
             </div>
          </header>

          <div className="p-4 sm:p-6 flex-1">
             <div className="mb-6 flex flex-col md:flex-row justify-between gap-4">
                <div className="flex gap-1 glassmorphism p-1 rounded">
                    {(['Todos', 'Pendente', 'Aguardando Pagamento', 'Confirmado', 'Cancelado'] as const).map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 text-xs sm:text-sm rounded ${statusFilter === s ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>{s === 'Aguardando Pagamento' ? 'Pagamento' : s}</button>
                    ))}
                </div>
                 <div className="relative"><input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-black/20 border border-gray-700 rounded p-2 pl-8 text-white text-sm" /><SearchIcon className="absolute left-2 top-2.5 w-4 h-4 text-gray-500" /></div>
             </div>

             {isLoading ? <div className="flex justify-center pt-20"><LoaderIcon className="w-10 h-10 text-white"/></div> : filteredAppointments.length === 0 ? <div className="text-center text-gray-500 pt-20">Nenhum agendamento.</div> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredAppointments.map(app => <AppointmentCard key={app.id} appointment={app} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteAppointment}/>)}
                </div>
             )}
             {!isLoading && hasMore && <button onClick={handleLoadMore} disabled={isLoadingMore} className="mt-8 mx-auto block bg-gray-700 text-white px-6 py-2 rounded">{isLoadingMore ? '...' : 'Carregar Mais'}</button>}
          </div>
        </main>

        <NewAppointmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveAppointment} user={user} />
        <LinkGeneratorModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} userId={user.id} />
        <BusinessProfileModal isOpen={isProfileModalOpen} onClose={() => { setIsProfileModalOpen(false); fetchDashboardData(); }} userId={user.id} />
        <UpgradeModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} limit={TRIAL_LIMIT} />
        <AssistantModal isOpen={isAssistantModalOpen} onClose={() => setIsAssistantModalOpen(false)} messages={assistantMessages} onSendMessage={handleSendMessageToAssistant} isLoading={isAssistantLoading} />
      </div>
    );
};

const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [path, setPath] = useState(window.location.pathname);
    
    // Manipulador global para callback do OAuth (Web)
    useEffect(() => {
        const handleOAuthCallback = async () => {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            const state = params.get('state'); // state carrega o user_id no nosso fluxo MP
            
            // Se tiver code e state, é callback do Mercado Pago
            if (code && state && !params.get('access_token')) { // check access_token to distinguish from Supabase auth
                try {
                    // Limpa a URL visualmente
                    window.history.replaceState({}, document.title, window.location.pathname);
                    
                    const { error } = await supabase.functions.invoke('mercadopago-connect', {
                        body: { code, state }
                    });
                    
                    if (error) throw error;
                    alert("Mercado Pago conectado com sucesso!");
                } catch (err) {
                    console.error("Erro ao conectar MP:", err);
                    alert("Falha ao conectar com Mercado Pago. Tente novamente.");
                }
            }
        };
        handleOAuthCallback();
    }, []);

    useEffect(() => {
        // Handle native OAuth callback
        CapacitorApp.addListener('appUrlOpen', async (event) => {
            const url = new URL(event.url);
            if (`${url.protocol}//${url.hostname}` !== 'com.oubook.app://auth-callback') return;
            const hash = url.hash.substring(1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            if (accessToken && refreshToken) {
                await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
                await Browser.close();
            } else { await Browser.close(); }
        });
    }, []);

    useEffect(() => {
        const syncUserAndProfile = async () => {
            setIsLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) { setUser(null); setProfile(null); return; }
                const currentUser = session.user;
                let { data: userProfile, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
                
                if (error && error.code === 'PGRST116') {
                    const { data } = await supabase.from('profiles').insert({ id: currentUser.id, terms_accepted_at: new Date().toISOString() }).select().single();
                    userProfile = data;
                }
                if (!userProfile) throw new Error("Perfil não encontrado.");

                // Lógica Trial/Premium (simplificada)
                if (userProfile.plan === 'premium' && userProfile.premium_expires_at && new Date(userProfile.premium_expires_at) < new Date()) {
                     const { data } = await supabase.from('profiles').update({ plan: 'trial', premium_expires_at: null }).eq('id', currentUser.id).select().single();
                     if(data) userProfile = data;
                }
                const today = new Date().toISOString().split('T')[0];
                if (userProfile.plan === 'trial' && userProfile.last_usage_date !== today) {
                    const { data } = await supabase.from('profiles').update({ daily_usage: 0, last_usage_date: today }).eq('id', currentUser.id).select().single();
                    if(data) userProfile = data;
                }
                
                setUser({ id: currentUser.id, email: currentUser.email });
                setProfile(userProfile);
            } catch (error) { console.error("Sync Error", error); setUser(null); setProfile(null); } finally { setIsLoading(false); }
        };
        syncUserAndProfile();
        const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') { syncUserAndProfile(); localStorage.setItem('termsAccepted', 'true'); }
            if (event === 'SIGNED_OUT') { setUser(null); setProfile(null); }
        });
        return () => { authListener.subscription.unsubscribe(); };
    }, []);

    const router = useMemo(() => {
        const pathParts = path.split('/').filter(Boolean);
        if (pathParts[0] === 'book-link' && pathParts[1]) return <PaginaDeAgendamento tokenId={pathParts[1]} />;
        if (user && profile) return <Dashboard user={user} profile={profile} setProfile={setProfile} />;
        if(!user && !isLoading) return <LoginPage />;
        return null; 
    }, [path, user, profile, isLoading]);

    if (isLoading) return <div className="min-h-screen bg-black flex justify-center items-center"><LoaderIcon className="w-16 h-16 text-white"/></div>;
    return router;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}