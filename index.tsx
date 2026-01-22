
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { PushNotifications } from '@capacitor/push-notifications';
import { Purchases } from '@revenuecat/purchases-capacitor';


declare let jspdf: any;

// Centralização de Variáveis de Ambiente
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PRODUCTION_URL = import.meta.env.VITE_PRODUCTION_URL;
const MP_CLIENT_ID = import.meta.env.VITE_MP_CLIENT_ID;
const MP_REDIRECT_URL = import.meta.env.VITE_MP_REDIRECT_URL;
const REVENUECAT_KEY = import.meta.env.VITE_REVENUECAT_ANDROID_KEY || 'goog_tXGzFUmdhKasrUrygDIgLxOVTPs';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !PRODUCTION_URL) {
  const missingVars = [
    !SUPABASE_URL && "VITE_SUPABASE_URL",
    !SUPABASE_ANON_KEY && "VITE_SUPABASE_ANON_KEY",
    !PRODUCTION_URL && "VITE_PRODUCTION_URL"
  ].filter(Boolean).join(', ');
  throw new Error(`Variáveis de ambiente essenciais ausentes: ${missingVars}.`);
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
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {children}
  </svg>
);
const CalendarIcon = (props: any) => <Icon {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></Icon>;
const ClockIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></Icon>;
const CheckCircleIcon = (props: any) => <Icon {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></Icon>;
const XCircleIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></Icon>;
const SearchIcon = (props: any) => <Icon {...props}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></Icon>;
const PlusIcon = (props: any) => <Icon {...props}><line x1="12" cy="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></Icon>;
const UserIcon = (props: any) => <Icon {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></Icon>;
const MailIcon = (props: any) => <Icon {...props}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></Icon>;
const PhoneIcon = (props: any) => <Icon {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></Icon>;
const LinkIcon = (props: any) => <Icon {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></Icon>;
const LogOutIcon = (props: any) => <Icon {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></Icon>;
const CopyIcon = (props: any) => <Icon {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1-2-2h9a2 2 0 0 1 2 2v1"></path></Icon>;
const AlertCircleIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></Icon>;
const LoaderIcon = (props: any) => <Icon {...props} className="animate-spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></Icon>;
const XIcon = (props: any) => <Icon {...props}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></Icon>;
const SettingsIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></Icon>;
const StarIcon = (props: any) => <Icon {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></Icon>;
const ChevronLeftIcon = (props: any) => <Icon {...props}><polyline points="15 18 9 12 15 6"></polyline></Icon>;
const ChevronRightIcon = (props: any) => <Icon {...props}><polyline points="9 18 15 12 9 6"></polyline></Icon>;
const DownloadIcon = (props: any) => <Icon {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></Icon>;
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
        <div className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}>
            <div className={`glassmorphism w-full ${sizeClasses[size]} rounded-2xl p-6 border border-gray-700 relative transition-all duration-300 ease-in-out ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} onClick={(e) => e.stopPropagation()}>
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
            alert('Por favor, insira um telefone válido com 10 ou 11 dígitos.');
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
                <input type="text" placeholder="Nome do Cliente" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" />
                <input type="tel" placeholder="Telefone" value={phone} onChange={e => setPhone(maskPhone(e.target.value))} required maxLength={15} className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" />
                <input type="email" placeholder="Email (Opcional)" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" />
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" />
                <input type="time" value={time} onChange={e => setTime(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" />
                <button type="submit" disabled={isSaving} className="w-full bg-gray-200 text-black font-bold py-3 px-4 rounded-lg hover:bg-white transition-colors disabled:opacity-50">
                    {isSaving ? <LoaderIcon className="w-6 h-6 mx-auto" /> : 'Salvar Agendamento'}
                </button>
            </form>
        </Modal>
    );
};

const PaymentModal = ({ isOpen, onClose, paymentData, appointmentId, onManualCheck }: { isOpen: boolean, onClose: () => void, paymentData: PaymentData, appointmentId: string, onManualCheck: (id: number) => Promise<void> }) => {
    const [copied, setCopied] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(paymentData.qr_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <Modal isOpen={isOpen} onClose={() => {}} title="Pagamento Pix" size="md">
            <div className="flex flex-col items-center space-y-6">
                <p className="text-gray-300 text-center">Escaneie o QR Code abaixo ou use o código "Copia e Cola" para finalizar.</p>
                <div className="bg-white p-4 rounded-xl">
                    {paymentData.qr_code_base64 ? <img src={`data:image/png;base64,${paymentData.qr_code_base64}`} alt="QR Code" className="w-48 h-48" /> : <div className="w-48 h-48 flex items-center justify-center bg-gray-100 text-gray-400">Carregando QR...</div>}
                </div>
                <div className="w-full space-y-2">
                    <div className="flex items-center space-x-2 bg-black/30 p-3 rounded-lg border border-gray-600">
                        <input type="text" value={paymentData.qr_code || ''} readOnly className="bg-transparent text-white w-full outline-none text-sm truncate" />
                        <button onClick={handleCopy} className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-500">{copied ? 'Copiado!' : 'Copiar'}</button>
                    </div>
                </div>
                <button onClick={async () => { setIsChecking(true); await onManualCheck(paymentData.id); setIsChecking(false); }} className="w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 py-2 rounded-lg flex items-center justify-center gap-2">
                    {isChecking ? <LoaderIcon className="w-4 h-4" /> : <RefreshIcon className="w-4 h-4" />} Já realizei o pagamento
                </button>
            </div>
        </Modal>
    );
};

const LinkGeneratorModal = ({ isOpen, onClose, userId }: { isOpen: boolean; onClose: () => void; userId: string }) => {
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const handleGenerateLink = async () => {
        setIsGenerating(true);
        const { data, error } = await supabase.from('one_time_links').insert({ user_id: userId }).select('id').single();
        if (data) setGeneratedLink(`${PRODUCTION_URL}/book-link/${data.id}`);
        setIsGenerating(false);
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Link de Agendamento">
            <div className="space-y-4">
                {generatedLink && (
                    <div className="flex items-center space-x-2 bg-black/30 p-3 rounded-lg border border-gray-600">
                        <input type="text" value={generatedLink} readOnly className="bg-transparent text-white w-full outline-none text-sm" />
                        <button onClick={() => { navigator.clipboard.writeText(generatedLink); setCopied(true); setTimeout(()=>setCopied(false),2000); }} className="bg-gray-600 text-white px-3 py-1 rounded text-sm">{copied ? 'Copiado!' : 'Copiar'}</button>
                    </div>
                )}
                <button onClick={handleGenerateLink} disabled={isGenerating} className="w-full bg-gray-200 text-black font-bold py-3 rounded-lg flex items-center justify-center space-x-2">
                    {isGenerating ? <LoaderIcon className="w-6 h-6" /> : <span>{generatedLink ? 'Gerar Novo Link' : 'Gerar Link Único'}</span>}
                </button>
            </div>
        </Modal>
    );
};

const BusinessProfileModal = ({ isOpen, onClose, userId }: { isOpen: boolean, onClose: () => void, userId: string }) => {
    const [profile, setProfile] = useState<BusinessProfile>({ user_id: userId, blocked_dates: [], blocked_times: {}, working_days: {}, start_time: '09:00', end_time: '17:00', service_price: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [mpConnection, setMpConnection] = useState<any>(null);

    useEffect(() => {
        if (isOpen) {
            const fetchProfile = async () => {
                setIsLoading(true);
                const [profileRes, mpRes] = await Promise.all([
                    supabase.from('business_profiles').select('*').eq('user_id', userId).single(),
                    supabase.from('mp_connections').select('*').eq('user_id', userId).single()
                ]);
                if (profileRes.data) setProfile(profileRes.data);
                setMpConnection(mpRes.data);
                setIsLoading(false);
            };
            fetchProfile();
        }
    }, [isOpen, userId]);

    const handleConnectMP = () => {
        const state = userId;
        const mpAuthUrl = `https://auth.mercadopago.com.br/authorization?client_id=${MP_CLIENT_ID || ''}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(MP_REDIRECT_URL || '')}`;
        window.location.href = mpAuthUrl;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Configurações do Perfil" size="lg">
            {isLoading ? <LoaderIcon className="w-8 h-8 mx-auto" /> : (
                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 scrollbar-hide">
                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                        <h3 className="text-lg font-semibold text-white mb-2">Pagamentos (Mercado Pago)</h3>
                        {mpConnection ? <div className="text-green-400 flex items-center gap-2"><CheckCircleIcon className="w-5 h-5" /> Conta Conectada</div> : 
                        <button onClick={handleConnectMP} className="w-full bg-[#009EE3] text-white font-bold py-2 rounded-lg">Conectar Mercado Pago</button>}
                    </div>
                    <div>
                         <h3 className="text-lg font-semibold text-white mb-3">Preço do Serviço (Pix)</h3>
                         <input type="number" step="0.01" value={profile.service_price || ''} onChange={e => setProfile({...profile, service_price: parseFloat(e.target.value) || 0})} className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" />
                    </div>
                    <button onClick={async () => { setIsSaving(true); await supabase.from('business_profiles').upsert(profile, { onConflict: 'user_id' }); setIsSaving(false); onClose(); }} className="w-full bg-gray-200 text-black font-bold py-3 rounded-lg">{isSaving ? <LoaderIcon className="w-6 h-6 mx-auto" /> : 'Salvar Configurações'}</button>
                </div>
            )}
        </Modal>
    );
};

const UpgradeModal = ({ isOpen, onClose, limit, onUpgrade }: { isOpen: boolean, onClose: () => void, limit: number, onUpgrade: () => void }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Limite Atingido">
            <div className="text-center">
                <AlertCircleIcon className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <p className="text-gray-300 mb-6">Você atingiu o limite de {limit} usos diários para o plano Trial.</p>
                <button onClick={onUpgrade} className="hotmart-fb hotmart__button-checkout w-full">🚀 Fazer Upgrade Ilimitado</button>
            </div>
        </Modal>
    );
};

const AssistantModal = ({ isOpen, onClose, messages, onSendMessage, isLoading }: { isOpen: boolean; onClose: () => void; messages: AssistantMessage[]; onSendMessage: (message: string) => void; isLoading: boolean; }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Assistente IA" size="lg">
            <div className="flex flex-col h-[60vh]">
                <div className="flex-1 overflow-y-auto space-y-4 p-4 scrollbar-hide">
                    {messages.map((msg, i) => <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`px-4 py-2 rounded-2xl ${msg.sender === 'user' ? 'bg-gray-600' : 'bg-gray-800'}`}>{msg.text}</div></div>)}
                    {isLoading && <LoaderIcon className="w-5 h-5 text-gray-400" />}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={(e)=>{e.preventDefault(); if(input.trim()){onSendMessage(input); setInput('');}}} className="mt-4 flex gap-2">
                    <input type="text" value={input} onChange={e=>setInput(e.target.value)} className="w-full bg-black/20 border border-gray-600 rounded-lg p-3" placeholder="Como posso ajudar?" />
                    <button type="submit" className="p-3 bg-gray-600 rounded-lg text-white">Enviar</button>
                </form>
            </div>
        </Modal>
    );
};

const PaginaDeAgendamento = ({ tokenId }: { tokenId: string }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [bookingCompleted, setBookingCompleted] = useState(false);
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
    const [adminId, setAdminId] = useState<string | null>(null);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [paymentData, setPaymentData] = useState<PaymentData | null>(null);

    useEffect(() => {
        const fetch = async () => {
            const { data } = await supabase.from('one_time_links').select('user_id, is_used').eq('id', tokenId).single();
            if (data && !data.is_used) {
                setAdminId(data.user_id);
                const { data: bRes } = await supabase.from('business_profiles').select('*').eq('user_id', data.user_id).single();
                if (bRes) setBusinessProfile(bRes);
            }
        };
        fetch();
    }, [tokenId]);

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        const dateStr = selectedDate?.toISOString().split('T')[0];
        const { data, error } = await supabase.functions.invoke('book-appointment-public', {
            body: { tokenId, name, phone, date: dateStr, time: selectedTime }
        });
        if (data?.appointment?.status === 'Confirmado') {
            setBookingCompleted(true);
        } else if (data?.appointment?.id && businessProfile?.service_price) {
            const { data: pData } = await supabase.functions.invoke('create-payment', {
                body: { amount: businessProfile.service_price, professionalId: adminId, appointmentId: data.appointment.id, payerEmail: 'cliente@oubook.com' }
            });
            if (pData) { setPaymentData(pData); setPaymentModalOpen(true); }
        }
    };

    if (bookingCompleted) return <div className="min-h-screen bg-black flex items-center justify-center">Agendamento Realizado!</div>;

    return (
        <div className="min-h-screen bg-black p-4 flex items-center justify-center">
            <div className="glassmorphism p-8 rounded-2xl w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6">Agendar Horário</h1>
                <form onSubmit={handleConfirm} className="space-y-4">
                    <input type="text" placeholder="Nome" value={name} onChange={e=>setName(e.target.value)} required className="w-full bg-black/20 border border-gray-600 p-3 rounded-lg" />
                    <input type="tel" placeholder="Telefone" value={phone} onChange={e=>setPhone(maskPhone(e.target.value))} required className="w-full bg-black/20 border border-gray-600 p-3 rounded-lg" />
                    <input type="date" onChange={e=>setSelectedDate(new Date(e.target.value))} required className="w-full bg-black/20 border border-gray-600 p-3 rounded-lg" />
                    <input type="time" onChange={e=>setSelectedTime(e.target.value)} required className="w-full bg-black/20 border border-gray-600 p-3 rounded-lg" />
                    <button type="submit" className="w-full bg-white text-black font-bold py-3 rounded-lg">Confirmar</button>
                </form>
            </div>
            {paymentData && <PaymentModal isOpen={paymentModalOpen} onClose={()=>setPaymentModalOpen(false)} paymentData={paymentData} appointmentId="" onManualCheck={async ()=>{}} />}
        </div>
    );
};

const Dashboard = ({ user, profile, setProfile }: { user: User, profile: Profile | null, setProfile: React.Dispatch<React.SetStateAction<Profile | null>>}) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const usage = profile?.daily_usage ?? 0;
    const hasReachedLimit = profile?.plan === 'trial' && usage >= 5;

    useEffect(() => {
        const fetch = async () => {
            const { data } = await supabase.from('appointments').select('*').eq('user_id', user.id).order('date', { ascending: false });
            if (data) setAppointments(data);
            setIsLoading(false);
        };
        fetch();
    }, [user.id]);

    const handleUpgrade = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const offerings = await Purchases.getOfferings();
          if (offerings.current && offerings.current.availablePackages.length !== 0) {
            const result = await Purchases.purchasePackage({ aPackage: offerings.current.availablePackages[0] });
            if (result.customerInfo.entitlements.active['premium']) {
              const { data } = await supabase.from('profiles').update({ plan: 'premium' }).eq('id', user.id).select().single();
              if (data) setProfile(data);
              alert("Premium ativado!");
            }
          } else { alert("Nenhum plano ativo encontrado no RevenueCat."); }
        } else { window.open("https://pay.hotmart.com/U102480243K?checkoutMode=2", "_blank"); }
      } catch (e: any) { if (!e.userCancelled) alert("Erro: " + e.message); }
    };

    return (
      <div className="flex h-screen bg-black overflow-hidden">
        <aside className={`fixed md:relative h-full w-64 glassmorphism p-6 flex flex-col z-40 transform transition-transform md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <h1 className="text-2xl font-bold mb-10">Oubook</h1>
            <nav className="flex-grow space-y-2">
                <button className="w-full flex items-center space-x-3 bg-gray-700/50 p-3 rounded-lg text-gray-300"><CalendarIcon className="w-5 h-5"/><span>Agendamentos</span></button>
                <button onClick={()=>setIsLinkModalOpen(true)} className="w-full flex items-center space-x-3 p-3 rounded-lg text-gray-300 hover:bg-gray-700/50"><LinkIcon className="w-5 h-5"/><span>Links de Reserva</span></button>
                <button onClick={()=>setIsProfileModalOpen(true)} className="w-full flex items-center space-x-3 p-3 rounded-lg text-gray-300 hover:bg-gray-700/50"><SettingsIcon className="w-5 h-5"/><span>Configurações</span></button>
            </nav>
            <button onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }} className="flex items-center space-x-3 p-3 text-red-400 hover:bg-red-500/10 rounded-lg"><LogOutIcon className="w-5 h-5"/><span>Sair</span></button>
        </aside>
        <main className="flex-1 flex flex-col overflow-y-auto">
          <header className="p-6 border-b border-gray-800 flex justify-between items-center glassmorphism sticky top-0 z-20">
             <div className="flex items-center gap-4">
                <button onClick={()=>setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden"><MenuIcon /></button>
                <h2 className="text-2xl font-bold">Agenda</h2>
             </div>
             <div className="flex gap-3">
                {profile?.plan === 'premium' ? <div className="text-yellow-400 font-bold px-3 py-1 bg-yellow-400/10 rounded-lg flex items-center gap-1"><StarIcon className="w-4 h-4"/> Premium</div> : 
                <button onClick={handleUpgrade} className="bg-orange-500 text-white font-bold px-4 py-1 rounded-lg">UPGRADE</button>}
                <button onClick={() => setIsModalOpen(true)} className="bg-white text-black font-bold px-4 py-1 rounded-lg">+ Novo</button>
             </div>
          </header>
          <div className="p-6 grid gap-6 grid-cols-1 lg:grid-cols-2">
            {isLoading ? <LoaderIcon className="mx-auto" /> : appointments.map(app => <AppointmentCard key={app.id} appointment={app} onDelete={async (id)=>{ if(confirm("Remover?")) await supabase.from('appointments').delete().eq('id', id); }} onUpdateStatus={async(id, status)=>{ await supabase.from('appointments').update({status}).eq('id', id); }} />)}
          </div>
        </main>
        <NewAppointmentModal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} onSave={async (name, phone, email, date, time)=>{ await supabase.from('appointments').insert({name, phone, email, date, time, user_id: user.id, status: 'Confirmado'}); }} user={user} />
        <LinkGeneratorModal isOpen={isLinkModalOpen} onClose={()=>setIsLinkModalOpen(false)} userId={user.id} />
        <BusinessProfileModal isOpen={isProfileModalOpen} onClose={()=>setIsProfileModalOpen(false)} userId={user.id} />
        <UpgradeModal isOpen={isUpgradeModalOpen} onClose={()=>setIsUpgradeModalOpen(false)} limit={5} onUpgrade={handleUpgrade} />
      </div>
    );
};

const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUser({ id: session.user.id, email: session.user.email });
                const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                setProfile(p);
                if (Capacitor.isNativePlatform()) {
                    await Purchases.configure({ apiKey: REVENUECAT_KEY, appUserID: session.user.id });
                }
            }
            setIsLoading(false);
        };
        init();
    }, []);

    if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><LoaderIcon className="w-12 h-12" /></div>;

    const path = window.location.pathname;
    if (path.startsWith('/book-link/')) return <PaginaDeAgendamento tokenId={path.split('/')[2]} />;
    if (!user) return <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-bold mb-8">Oubook</h1>
        <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })} className="bg-white text-black font-bold py-3 px-8 rounded-lg">Entrar com Google</button>
    </div>;

    return <Dashboard user={user} profile={profile} setProfile={setProfile} />;
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
