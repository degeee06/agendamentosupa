import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { PushNotifications } from '@capacitor/push-notifications';
import { Purchases } from '@revenuecat/purchases-capacitor';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// FIREBASE WEB SDK
import firebase from 'firebase/compat/app';
import { getMessaging, getToken, onMessage } from "firebase/messaging";

declare let jspdf: any;

// --- CONFIGURAÇÃO DE VARIÁVEIS ---
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PRODUCTION_URL = import.meta.env.VITE_PRODUCTION_URL;

// Configurações do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAZZdxquZYwS7M7-FL3R_gwqA30Q-bCvwc",
    authDomain: "agendamento-link-e6f81.firebaseapp.com",
    projectId: "agendamento-link-e6f81",
    storageBucket: "agendamento-link-e6f81.firebasestorage.app",
    messagingSenderId: "881996925647",
    appId: "1:881996925647:web:96e83812836269b62485ba"
};

// Chave VAPID para Web Push
const FIREBASE_VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "BKe7Lzlv5imlTgwnC9zqVHlcVqRdFW2o-DZtfGLN_90V01ILQdZ8obPTRU5CPwABsNxwQYg6-UsntYd2BB7Debg";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !PRODUCTION_URL) {
    console.error("Variáveis de ambiente ausentes.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Inicialização Firebase (Apenas se estiver no navegador)
let messaging: any = null;
if (typeof window !== 'undefined') {
    try {
        const app = firebase.initializeApp(firebaseConfig);
        messaging = getMessaging(app);
    } catch (e) {
        console.error("Erro ao inicializar Firebase Web:", e);
    }
}

// --- TIPOS ---
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
    full_name?: string;
};

type BusinessProfile = {
    user_id: string;
    blocked_dates: string[];
    blocked_times: { [key: string]: string[] };
    working_days: { [key: string]: boolean };
    start_time?: string;
    end_time?: string;
    service_price?: number;
};

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

// --- HELPERS ---
const parseDateAsUTC = (dateString: string): Date => {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
};

const maskPhone = (value: string) => {
    if (!value) return "";
    value = value.replace(/\D/g, '').substring(0, 11);
    if (value.length > 6) return value.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
    if (value.length > 2) return value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
    return value.length > 0 ? `(${value}` : value;
};

// --- ÍCONES ---
const Icon = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{children}</svg>
);
const CalendarIcon = (p: any) => <Icon {...p}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Icon>;
const ClockIcon = (p: any) => <Icon {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Icon>;
const CheckCircleIcon = (p: any) => <Icon {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></Icon>;
const XCircleIcon = (p: any) => <Icon {...p}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></Icon>;
const LoaderIcon = (p: any) => <Icon {...p} className="animate-spin"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></Icon>;
const XIcon = (p: any) => <Icon {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Icon>;
const SettingsIcon = (p: any) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1-2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></Icon>;
const StarIcon = (p: any) => <Icon {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Icon>;
const ChevronLeftIcon = (p: any) => <Icon {...p}><polyline points="15 18 9 12 15 6"/></Icon>;
const ChevronRightIcon = (p: any) => <Icon {...p}><polyline points="9 18 15 12 9 6"/></Icon>;
const DownloadIcon = (p: any) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Icon>;
const SendIcon = (p: any) => <Icon {...p}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></Icon>;
const ChatBubbleIcon = (p: any) => <Icon {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></Icon>;
const MenuIcon = (p: any) => <Icon {...p}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></Icon>;
const SearchIcon = (p: any) => <Icon {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Icon>;
const PlusIcon = (p: any) => <Icon {...p}><line x1="12" cy="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Icon>;
const UserIcon = (p: any) => <Icon {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icon>;
const MailIcon = (p: any) => <Icon {...p}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></Icon>;
const PhoneIcon = (p: any) => <Icon {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></Icon>;
const LinkIcon = (p: any) => <Icon {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"/></Icon>;
const LogOutIcon = (p: any) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Icon>;
const CopyIcon = (p: any) => <Icon {...p}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1-2-2h9a2 2 0 0 1 2 2v1"/></Icon>;
const AlertCircleIcon = (p: any) => <Icon {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></Icon>;
const RefreshIcon = (p: any) => <Icon {...p}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></Icon>;
const BellIcon = (p: any) => <Icon {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Icon>;


// --- COMPONENTES DE UI ---
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
        <div 
            className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
            onClick={onClose}
        >
            <div 
                className={`glassmorphism w-full ${sizeClasses[size]} rounded-2xl p-4 sm:p-6 border border-gray-700 relative transition-all duration-300 ease-in-out ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} 
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                    <XIcon className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>
                <div className="max-h-[80dvh] overflow-y-auto scrollbar-hide">
                    {children}
                </div>
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
                <input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)} 
                    required 
                    className="w-full bg-black/20 border border-gray-600 rounded-lg px-3 py-3 text-base text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 appearance-none block box-border"
                    style={{ colorScheme: 'dark', width: '100%' }} 
                />
                <input 
                    type="time" 
                    value={time} 
                    onChange={e => setTime(e.target.value)} 
                    required 
                    className="w-full bg-black/20 border border-gray-600 rounded-lg px-3 py-3 text-base text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 appearance-none block box-border"
                    style={{ colorScheme: 'dark', width: '100%' }} 
                />
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

    const handleCheckClick = async () => {
        setIsChecking(true);
        await onManualCheck(paymentData.id);
        setIsChecking(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={() => {}} title="Pagamento Pix" size="md">
            <div className="flex flex-col items-center space-y-6">
                <p className="text-gray-300 text-center">
                    Escaneie o QR Code abaixo ou use a opção "Copia e Cola" no aplicativo do seu banco para finalizar o agendamento.
                </p>
                
                <div className="bg-white p-4 rounded-xl">
                    {paymentData.qr_code_base64 ? (
                        <img 
                            src={`data:image/png;base64,${paymentData.qr_code_base64}`} 
                            alt="QR Code Pix" 
                            className="w-48 h-48 object-contain" 
                        />
                    ) : (
                        <div className="w-48 h-48 flex items-center justify-center bg-gray-100 text-gray-400 text-xs">
                            Carregando QR...
                        </div>
                    )}
                </div>

                <div className="w-full space-y-2">
                    <p className="text-sm text-gray-400 font-semibold">Código Pix Copia e Cola</p>
                    <div className="flex items-center space-x-2 bg-black/30 p-3 rounded-lg border border-gray-600">
                        <input 
                            type="text" 
                            value={paymentData.qr_code || ''} 
                            readOnly 
                            className="bg-transparent text-white w-full outline-none text-sm truncate" 
                        />
                        <button onClick={handleCopy} className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-500 transition-colors flex-shrink-0">
                            {copied ? 'Copiado!' : 'Copiar'}
                        </button>
                    </div>
                </div>

                <div className="text-center space-y-2 w-full">
                    <p className="text-yellow-400 text-sm font-medium flex items-center justify-center gap-2">
                        <LoaderIcon className="w-4 h-4" />
                        Aguardando confirmação...
                    </p>
                    <p className="text-xs text-gray-500 mb-2">
                        Assim que o pagamento for confirmado, esta tela será atualizada automaticamente.
                    </p>
                    
                    <button 
                        onClick={handleCheckClick}
                        disabled={isChecking}
                        className="w-full mt-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-sm font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        {isChecking ? <LoaderIcon className="w-4 h-4" /> : <RefreshIcon className="w-4 h-4" />}
                        Já realizei o pagamento
                    </button>
                </div>
            </div>
        </Modal>
    );
};


const LinkGeneratorModal = ({ isOpen, onClose, userId }: { isOpen: boolean; onClose: () => void; userId: string }) => {
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Reset state when modal is closed
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
            const { data, error = null } = await supabase
                .from('one_time_links')
                .insert({ user_id: userId })
                .select('id')
                .single();
            
            if (error || !data) {
                throw error || new Error("Não foi possível obter o ID do link gerado.");
            }
            
            // Usando URL fixa conforme solicitado
            const newLink = `https://oubook.com.br/book-link/${data.id}`;
            setGeneratedLink(newLink);
        } catch (err: any) {
            console.error("Erro ao gerar link:", err);
            setError("Não foi possível gerar o link. Tente novamente.");
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
                <p className="text-gray-300">
                    Gere um link de uso único para compartilhar com seus clientes. Cada link só pode ser usado para um agendamento.
                </p>
                
                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                
                {generatedLink ? (
                    <div className="flex items-center space-x-2 bg-black/30 p-3 rounded-lg border border-gray-600">
                        <LinkIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <input type="text" value={generatedLink} readOnly className="bg-transparent text-white w-full outline-none text-sm" />
                        <button onClick={handleCopy} className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-500 transition-colors flex-shrink-0">
                            {copied ? 'Copiado!' : 'Copiar'}
                        </button>
                    </div>
                ) : null}

                <button 
                    onClick={handleGenerateLink}
                    disabled={isGenerating}
                    className="w-full bg-gray-200 text-black font-bold py-3 px-4 rounded-lg hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                    {isGenerating ? (
                        <LoaderIcon className="w-6 h-6" />
                    ) : (
                        <>
                            <LinkIcon className="w-5 h-5" />
                            <span>{generatedLink ? 'Gerar Novo Link' : 'Gerar Link de Uso Único'}</span>
                        </>
                    )}
                </button>
            </div>
        </Modal>
    );
};

const BusinessProfileModal = ({ isOpen, onClose, userId }: { isOpen: boolean, onClose: () => void, userId: string }) => {
    const [profile, setProfile] = useState<BusinessProfile>({ user_id: userId, blocked_dates: [], blocked_times: {}, working_days: {}, start_time: '09:00', end_time: '17:00', service_price: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [newBlockedDate, setNewBlockedDate] = useState('');
    const [newBlockedTime, setNewBlockedTime] = useState('');
    const [selectedDay, setSelectedDay] = useState('monday');
    const [mpConnection, setMpConnection] = useState<any>(null);

    const daysOfWeek = { monday: "Segunda", tuesday: "Terça", wednesday: "Quarta", thursday: "Quinta", friday: "Sexta", saturday: "Sábado", sunday: "Domingo" };
    const defaultWorkingDays = { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false };
    const defaultStartTime = '09:00';
    const defaultEndTime = '17:00';

    useEffect(() => {
        if (isOpen) {
            const fetchProfile = async () => {
                setIsLoading(true);
                const [profileRes, mpRes] = await Promise.all([
                    supabase.from('business_profiles').select('*').eq('user_id', userId).single(),
                    supabase.from('mp_connections').select('*').eq('user_id', userId).single()
                ]);

                if (profileRes.data) {
                    setProfile({
                        ...profileRes.data,
                        blocked_dates: profileRes.data.blocked_dates || [],
                        blocked_times: profileRes.data.blocked_times || {},
                        working_days: profileRes.data.working_days || defaultWorkingDays,
                        start_time: profileRes.data.start_time || defaultStartTime,
                        end_time: profileRes.data.end_time || defaultEndTime,
                        service_price: profileRes.data.service_price !== undefined ? profileRes.data.service_price : 0
                    });
                } else {
                    setProfile({ user_id: userId, blocked_dates: [], blocked_times: {}, working_days: defaultWorkingDays, start_time: defaultStartTime, end_time: defaultEndTime, service_price: 0 });
                }
                setMpConnection(mpRes.data);
                setIsLoading(false);
            };
            fetchProfile();
        }
    }, [isOpen, userId]);

    const handleSave = async () => {
        setIsSaving(true);
        // Garantir que o preço seja salvo como número
        const profileToSave = {
            ...profile,
            service_price: profile.service_price ? parseFloat(profile.service_price as any) : 0
        };
        const { error = null } = await supabase.from('business_profiles').upsert(profileToSave, { onConflict: 'user_id' });
        if (error) {
            console.error("Erro ao salvar perfil de negócio:", error);
        } else {
            onClose();
        }
        setIsSaving(false);
    };

    const handleConnectMP = () => {
        const clientId = import.meta.env.VITE_MP_CLIENT_ID;
        const redirectUri = import.meta.env.VITE_MP_REDIRECT_URL;

        // Codificar a URL corretamente (permitindo que o fluxo continue mesmo se não detectado no cliente local)
        const encodedRedirect = encodeURIComponent(redirectUri || '');
        
        // Gera um estado aleatório (pode ser o ID do usuário) para segurança
        const state = userId;
        
        const mpAuthUrl = `https://auth.mercadopago.com.br/authorization?client_id=${clientId || ''}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodedRedirect}`;
        
        console.log("Redirecionando para:", mpAuthUrl);
        window.location.href = mpAuthUrl;
    };

    const handleDisconnect = async () => {
        const confirmDisconnect = window.confirm("Deseja realmente desconectar sua conta do Mercado Pago? Você não poderá receber pagamentos Pix até conectar novamente.");
        if (!confirmDisconnect) return;

        setIsLoading(true);
        const { error = null } = await supabase
            .from('mp_connections')
            .delete()
            .eq('user_id', userId);

        if (error) {
            console.error("Erro ao desconectar:", error);
            alert("Erro ao desconectar. Verifique se você rodou o comando SQL para permitir exclusão (DELETE policy) no Supabase.");
        } else {
            setMpConnection(null);
        }
        setIsLoading(false);
    };

    const handleWorkingDayChange = (day: string) => {
        setProfile(p => ({
            ...p,
            working_days: {
                ...p.working_days,
                [day]: !p.working_days[day]
            }
        }));
    };
    
    const handleTimeChange = (field: 'start_time' | 'end_time', value: string) => {
        setProfile(p => ({ ...p, [field]: value }));
    };

    const addBlockedDate = () => {
        if (newBlockedDate && !profile.blocked_dates.includes(newBlockedDate)) {
            setProfile(p => ({ ...p, blocked_dates: [...p.blocked_dates, newBlockedDate].sort() }));
            setNewBlockedDate('');
        }
    };
    
    const removeBlockedDate = (dateToRemove: string) => {
        setProfile(p => ({ ...p, blocked_dates: p.blocked_dates.filter(d => d !== dateToRemove) }));
    };

    const addBlockedTime = () => {
        if (newBlockedTime) {
            const dayTimes = profile.blocked_times[selectedDay] || [];
            if (!dayTimes.includes(newBlockedTime)) {
                setProfile(p => ({
                    ...p,
                    blocked_times: {
                        ...p.blocked_times,
                        [selectedDay]: [...dayTimes, newBlockedTime].sort()
                    }
                }));
            }
            setNewBlockedTime('');
        }
    };

    const removeBlockedTime = (day: string, timeToRemove: string) => {
        setProfile(p => ({
            ...p,
            blocked_times: {
                ...p.blocked_times,
                [day]: (p.blocked_times[day] || []).filter(t => t !== timeToRemove)
            }
        }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Configurações do Perfil" size="lg">
            {isLoading ? <LoaderIcon className="w-8 h-8 mx-auto" /> : (
                <div className="space-y-6 max-h-[70dvh] overflow-y-auto pr-2 scrollbar-hide">
                    
                    {/* Mercado Pago Connection */}
                     <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                        <h3 className="text-lg font-semibold text-white mb-2">Pagamentos (Mercado Pago)</h3>
                        <p className="text-sm text-gray-400 mb-4">Conecte sua conta do Mercado Pago para receber pagamentos via Pix automaticamente.</p>
                        {mpConnection ? (
                            <div className="bg-green-400/10 p-3 rounded-lg border border-green-400/20">
                                <div className="flex items-center space-x-2 text-green-400 mb-3">
                                    <CheckCircleIcon className="w-5 h-5" />
                                    <span className="font-bold">Conta Conectada</span>
                                </div>
                                <button
                                    onClick={handleDisconnect}
                                    className="w-full bg-red-500/20 hover:bg-red-500/40 text-red-300 text-sm font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <LogOutIcon className="w-4 h-4" />
                                    Desconectar / Trocar Conta
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={handleConnectMP}
                                className="w-full bg-[#009EE3] hover:bg-[#0082BA] text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <LinkIcon className="w-5 h-5" />
                                Conectar Mercado Pago
                            </button>
                        )}
                    </div>

                    {/* Service Price */}
                    <div>
                         <h3 className="text-lg font-semibold text-white mb-3">Preço do Serviço (Pix)</h3>
                         <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R$</span>
                            <input 
                                type="number" 
                                step="0.01"
                                placeholder="0.00" 
                                value={profile.service_price === 0 ? '' : (profile.service_price ?? '')} 
                                onChange={e => {
                                    const val = e.target.value;
                                    // Mantemos como string no estado local para permitir a digitação de decimais (0., 0.0, etc)
                                    setProfile(p => ({ ...p, service_price: val as any }));
                                }}
                                className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 pl-10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
                            />
                         </div>
                         <p className="text-xs text-gray-500 mt-1">Deixe 0 ou vazio para agendamento gratuito.</p>
                    </div>

                    {/* Working Hours */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-3">Horário de Funcionamento</h3>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="w-full sm:w-1/2">
                                <label className="text-sm text-gray-400 mb-1 block">Início</label>
                                <input type="time" value={profile.start_time} onChange={e => handleTimeChange('start_time', e.target.value)} className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" style={{colorScheme: 'dark'}} />
                            </div>
                            <div className="w-full sm:w-1/2">
                                <label className="text-sm text-gray-400 mb-1 block">Fim</label>
                                <input type="time" value={profile.end_time} onChange={e => handleTimeChange('end_time', e.target.value)} className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" style={{colorScheme: 'dark'}} />
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
                                        className="h-5 w-5 accent-gray-400 bg-gray-800 border-gray-600 rounded focus:ring-gray-500"
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
                            <input type="date" value={newBlockedDate} onChange={e => setNewBlockedDate(e.target.value)} className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400" style={{colorScheme: 'dark'}} />
                            <button onClick={addBlockedDate} className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-500">Adicionar</button>
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
                        <div className="flex flex-col sm:flex-row gap-2 mb-2">
                            <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)} className="w-full sm:w-1/3 bg-black/20 border border-gray-600 rounded-lg p-3 text-white">
                                {Object.entries(daysOfWeek).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                            </select>
                            <div className="flex gap-2 w-full sm:w-2/3">
                                <input type="time" value={newBlockedTime} onChange={e => setNewBlockedTime(e.target.value)} className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" style={{colorScheme: 'dark'}} />
                                <button onClick={addBlockedTime} className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-500 whitespace-nowrap">Adicionar</button>
                            </div>
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

const UpgradeModal = ({ isOpen, onClose, limit, onUpgrade }: { isOpen: boolean, onClose: () => void, limit: number, onUpgrade: () => void }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Limite Diário Atingido">
            <div className="text-center">
                <AlertCircleIcon className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <p className="text-gray-300 mb-4">
                    Você atingiu o limite de {limit} usos diários para o plano Trial.
                </p>
                <p className="text-sm text-gray-400 mb-6">
                    Seu limite de uso será reiniciado automaticamente amanhã, à meia-noite (00:00). Para continuar agendando hoje, faça o upgrade para o plano Premium.
                </p>
                <button 
                    onClick={onUpgrade}
                    className="w-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-700 text-black font-black py-4 px-6 rounded-xl shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                    🚀 FAZER UPGRADE PREMIUM
                </button>
            </div>
        </Modal>
    );
};

const TermsModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Termos de Uso e Privacidade" size="xl">
            <div className="text-gray-300 space-y-4 max-h-[60dvh] overflow-y-auto pr-4 scrollbar-hide">
                <p>Ao utilizar nosso sistema de agendamentos, você concorda com estes Termos de Uso e nossa Política de Privacidade.</p>

                <div>
                    <h4 className="font-semibold text-white">2. Uso do Serviço</h4>
                    <p>Você concorda em usar a plataforma apenas para fins legítimos de agendamento de serviços, sendo responsável por todas as informações cadastradas.</p>
                </div>
                
                <div>
                    <h4 className="font-semibold text-white">3. Privacidade e Dados</h4>
                    <p>Seus dados de agendamento são armazenados com segurança em servidores protegidos. Não compartilhamos suas informações com terceiros não autorizados.</p>
                </div>

                <div>
                    <h4 className="font-semibold text-white">4. Responsabilidades</h4>
                    <p>Você é integralmente responsável pela veracidade das informações fornecidas e pelos agendamentos realizados através da plataforma.</p>
                </div>

                <div>
                    <h4 className="font-semibold text-white">5. Limitações de Uso</h4>
                    <p>O serviço pode possuir limitações técnicas conforme seu plano atual (free trial ou premium). Reservamo-nos o direito de suspender contas em caso de uso inadequado.</p>
                </div>

                <div>
                    <h4 className="font-semibold text-white">6. Modificações</h4>
                    <p>Podemos atualizar estes termos periodicamente. O uso continuado após alterações significa sua aceitação.</p>
                </div>
                
                <div className="border-t border-gray-700 pt-4 space-y-2">
                    <p className="text-sm text-gray-400">
                        🔒 <strong>Proteção de Dados:</strong> Este sistema segue as melhores práticas de segurança e proteção de dados pessoais.
                    </p>
                    <p className="text-sm text-gray-400">
                        Ao marcar a caixa de aceite e continuar, você declara ter lido, compreendido e concordado com todos os termos acima.
                    </p>
                </div>

                 <button onClick={onClose} className="w-full mt-6 bg-gray-200 text-black font-bold py-3 px-4 rounded-lg hover:bg-white transition-colors">
                    Entendi
                </button>
            </div>
        </Modal>
    );
};

const AssistantModal = ({ isOpen, onClose, messages, onSendMessage, isLoading }: { isOpen: boolean; onClose: () => void; messages: AssistantMessage[]; onSendMessage: (message: string) => void; isLoading: boolean; }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages, isLoading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSendMessage(input.trim());
            setInput('');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Assistente IA" size="lg">
            <div className="flex flex-col h-[60dvh]">
                <div className="flex-1 overflow-y-auto space-y-4 p-4 scrollbar-hide">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${msg.sender === 'user' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-200'}`}>
                                <p className="text-sm">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-2xl bg-gray-800 text-gray-200">
                                <LoaderIcon className="w-5 h-5 text-gray-400" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSubmit} className="mt-4 flex items-center space-x-2">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Ex: Agendar para João às 15h amanhã"
                        className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading || !input.trim()} className="p-3 bg-gray-600 rounded-lg text-white hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <SendIcon className="w-6 h-6" />
                    </button>
                </form>
            </div>
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

    // Payment States
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
    const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null);

    const dayMap = useMemo(() => ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], []);

    // Salva o sucesso no localStorage para evitar "Link Expirado" após reload
    useEffect(() => {
        if (bookingCompleted) {
            localStorage.setItem(`booking_success_${tokenId}`, 'true');
        }
    }, [bookingCompleted, tokenId]);

    useEffect(() => {
        const validateLinkAndFetchData = async () => {
            // UX: Verifica se já finalizou neste dispositivo para evitar "Link Utilizado" logo após pagar
            if (localStorage.getItem(`booking_success_${tokenId}`) === 'true') {
                setBookingCompleted(true);
                setLinkStatus('valid'); // Sai do loading
                return;
            }

            try {
                setLinkStatus('loading');
                const { data: linkData, error: linkError = null } = await supabase
                    .from('one_time_links')
                    .select('user_id, is_used, appointment_id')
                    .eq('id', tokenId)
                    .single();

                if (linkError || !linkData) {
                    setLinkStatus('invalid');
                    return;
                }
                
                // LOGICA DE RECUPERAÇÃO DE PAGAMENTO
                if (linkData.is_used) {
                    if (linkData.appointment_id) {
                        // O link foi usado, mas vamos ver se o agendamento ainda está "Aguardando Pagamento"
                        const { data: appt = null } = await supabase
                            .from('appointments')
                            .select('*')
                            .eq('id', linkData.appointment_id)
                            .single();
                        
                        // Se status for 'Confirmado', mostra a tela de sucesso
                        if (appt && appt.status === 'Confirmado') {
                            setBookingCompleted(true);
                            setLinkStatus('valid');
                            return;
                        }

                        // Se status for 'Aguardando Pagamento', restaura.
                        if (appt && appt.status === 'Aguardando Pagamento') {
                            // Recupera sessão!
                            setAdminId(linkData.user_id);
                            setPendingAppointmentId(appt.id);
                            setName(appt.name);
                            setPhone(appt.phone || '');
                            setEmail(appt.email || '');
                            
                            // Se possível, restaurar a data e hora para visualização (opcional)
                            const [year, month, day] = appt.date.split('-');
                            setSelectedDate(new Date(Date.UTC(Number(year), Number(month)-1, Number(day))));
                            setSelectedTime(appt.time);

                            // Buscar dados do pagamento existente para mostrar o QR Code de novo
                             const { data: existingPayment = null } = await supabase
                                .from('payments')
                                .select('*')
                                .eq('appointment_id', appt.id)
                                .single();
                            
                            if (existingPayment) {
                                // Tenta buscar os dados completos do pagamento (QR Code) novamente via Edge Function
                                try {
                                    const { data: qrData, error: qrError = null } = await supabase.functions.invoke('create-payment', {
                                        body: {
                                            action: 'retrieve',
                                            paymentId: (existingPayment as any).mp_payment_id,
                                            professionalId: linkData.user_id
                                        }
                                    });
                                    
                                    if (qrData && !qrData.error) {
                                        setPaymentData(qrData);
                                    } else {
                                        console.warn("Falha ao recuperar QR Code completo:", qrData?.error);
                                        // Fallback: usa dados parciais do banco (sem imagem QR)
                                        setPaymentData({
                                            id: parseInt((existingPayment as any).mp_payment_id),
                                            status: (existingPayment as any).status,
                                            qr_code: '', 
                                            qr_code_base64: '',
                                            ticket_url: ''
                                        });
                                    }
                                } catch (e) {
                                    console.error("Erro na chamada da Edge Function para recuperar QR Code:", e);
                                     setPaymentData({
                                        id: parseInt((existingPayment as any).mp_payment_id),
                                        status: (existingPayment as any).status,
                                        qr_code: '',
                                        qr_code_base64: '',
                                        ticket_url: ''
                                    });
                                }
                            }
                        } else {
                            setLinkStatus('used');
                            return;
                        }
                    } else {
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
                
                const defaultWorkingDays = { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false };
                const defaultStartTime = '09:00';
                const defaultEndTime = '17:00';

                setBusinessProfile(businessProfileRes.data ? {
                    ...businessProfileRes.data,
                    blocked_dates: businessProfileRes.data.blocked_dates || [],
                    blocked_times: businessProfileRes.data.blocked_times || {},
                    working_days: businessProfileRes.data.working_days || defaultWorkingDays,
                    start_time: businessProfileRes.data.start_time || defaultStartTime,
                    end_time: businessProfileRes.data.end_time || defaultEndTime,
                    service_price: businessProfileRes.data.service_price || 0
                } : { user_id: currentAdminId, blocked_dates: [], blocked_times: {}, working_days: defaultWorkingDays, start_time: defaultStartTime, end_time: defaultEndTime, service_price: 0 });

                setLinkStatus('valid');
                
            } catch (error) {
                console.error('Erro ao buscar dados do admin:', error);
                setLinkStatus('invalid');
            }
        };
        validateLinkAndFetchData();
    }, [tokenId]);
    
    // Escuta Realtime para confirmação de pagamento (pode falhar para anonimos com RLS restrito)
    useEffect(() => {
        if (!pendingAppointmentId) return;

        const channel = supabase
            .channel(`public-appt-${pendingAppointmentId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `id=eq.${pendingAppointmentId}` },
                (payload) => {
                    if (payload.new.status === 'Confirmado') {
                        setPaymentModalOpen(false);
                        setBookingCompleted(true);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [pendingAppointmentId]);

    // Polling automático robusto
    useEffect(() => {
        let intervalId: any;

        if (paymentData?.id && pendingAppointmentId && !bookingCompleted) {
            const checkStatus = async () => {
                try {
                    const { data, error = null } = await supabase.functions.invoke('mp-webhook', {
                        body: {
                            id: paymentData.id.toString(),
                            action: 'payment.updated'
                        }
                    });

                    if (data && data.status === 'approved') {
                        setPaymentModalOpen(false);
                        setBookingCompleted(true);
                    }
                } catch (e) {
                    // Ignora erros silenciosamente no polling
                }
            };

            intervalId = setInterval(checkStatus, 4000);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [paymentData, pendingAppointmentId, bookingCompleted]);

    const handleManualVerification = async (paymentId: number) => {
        try {
            const { data, error = null } = await supabase.functions.invoke('mp-webhook', {
                body: {
                    id: paymentId.toString(),
                    action: 'payment.updated'
                }
            });

            if (error) throw error;
            
            if (data && data.status === 'approved') {
                setPaymentModalOpen(false);
                setBookingCompleted(true);
            } else {
                alert('O pagamento ainda não foi confirmado pelo banco. Por favor, aguarde mais alguns instantes e tente novamente.');
            }

        } catch (err) {
            console.error("Erro na verificação manual:", err);
            alert('Não foi possível verificar o pagamento no momento. Tente novamente.');
        }
    };


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
            slots.push(`${String(hour).padStart(2, '0')}:30`);
        }

        const dateString = selectedDate.toISOString().split('T')[0];
        const dayOfWeek = dayMap[selectedDate.getUTCDay()];

        const bookedTimes = appointments
            .filter(a => a.date === dateString)
            .map(a => a.time);
            
        const blockedRecurringTimes = businessProfile.blocked_times[dayOfWeek] || [];

        const now = new Date();
        const localTodayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        return slots.filter(slot => {
            const [slotHour, slotMinute] = slot.split(':').map(Number);
            // Bloqueia horários passados hoje
            const isPastTimeToday = (dateString === localTodayString) && (slotHour < currentHour || (slotHour === currentHour && slotMinute <= currentMinute));

            return !isPastTimeToday && 
                   !bookedTimes.includes(slot) && 
                   !blockedRecurringTimes.includes(slot);
        });
    }, [selectedDate, businessProfile, appointments, dayMap]);
    
    const handlePayment = async (appointmentId: string, amount: number) => {
        try {
            const { data, error = null } = await supabase.functions.invoke('create-payment', {
                body: {
                    amount: amount,
                    description: `Agendamento ${name}`,
                    professionalId: adminId,
                    appointmentId: appointmentId,
                    payerEmail: email || 'cliente@oubook.com'
                }
            });
            
            if (error || (data && data.error)) {
                throw new Error((data && data.error) || (error && (error as any).message) || 'Erro ao gerar Pix');
            }
            
            setPaymentData(data);
            setPaymentModalOpen(true);
            
        } catch (err: any) {
            console.error("Erro pagamento:", err);
            setMessage({ type: 'error', text: "Erro ao gerar o pagamento Pix. Tente novamente." });
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (pendingAppointmentId && adminId && businessProfile?.service_price) {
             if (paymentData) {
                 setPaymentModalOpen(true);
             } else {
                 setIsSaving(true);
                 await handlePayment(pendingAppointmentId, businessProfile.service_price);
                 setIsSaving(false);
             }
             return;
        }

        if (!selectedDate || !selectedTime || !adminId) return;

        setMessage(null);
        const unmaskedPhone = phone.replace(/\D/g, '');
        if (unmaskedPhone.length < 10 || unmaskedPhone.length > 11) {
            setMessage({ type: 'error', text: 'Por favor, insira um telefone válido com 10 ou 11 dígitos (DDD + número).' });
            return;
        }

        setIsSaving(true);
        
        try {
            const dateString = selectedDate.toISOString().split('T')[0];
            const { data, error = null } = await supabase.functions.invoke('book-appointment-public', {
                body: {
                    tokenId: tokenId,
                    name: name,
                    phone: unmaskedPhone,
                    email: email,
                    date: dateString,
                    time: selectedTime,
                },
            });

            if (error) {
                const errorMessage = (data as any)?.error || 'Ocorreu um erro ao salvar seu agendamento.';
                throw new Error(errorMessage);
            }
            
            const { appointment: newAppt } = data;
            const newApptId = newAppt.id;
            setPendingAppointmentId(newApptId);

            if (newAppt.status === 'Confirmado') {
                setBookingCompleted(true);
                return;
            }

            if (businessProfile?.service_price && businessProfile.service_price > 0) {
                 await handlePayment(newApptId, businessProfile.service_price);
            } else {
                 setBookingCompleted(true);
                 setMessage({ type: 'success', text: 'Agendamento realizado com sucesso!' });
            }
        } catch (error: any) {
            console.error('Erro ao salvar:', error);
            setMessage({ type: 'error', text: error.message || 'Erro ao realizar agendamento.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (linkStatus === 'loading') return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white"><LoaderIcon className="w-10 h-10" /></div>;
    
    if (bookingCompleted) {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4">
                <div className="glassmorphism max-w-md w-full p-8 rounded-2xl text-center space-y-6 animate-fade-in-up">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircleIcon className="w-10 h-10 text-green-400" />
                    </div>
                    <h2 className="text-3xl font-bold text-white">Agendamento Confirmado!</h2>
                    <p className="text-gray-300">
                        {name}, seu horário foi reservado com sucesso.
                    </p>
                    <div className="bg-black/30 p-4 rounded-xl space-y-2">
                        <div className="flex items-center justify-center space-x-2 text-gray-200">
                            <CalendarIcon className="w-5 h-5 text-gray-400" />
                            <span className="font-semibold text-lg">{selectedDate?.toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div className="flex items-center justify-center space-x-2 text-gray-200">
                            <ClockIcon className="w-5 h-5 text-gray-400" />
                            <span className="font-semibold text-lg">{selectedTime}</span>
                        </div>
                    </div>
                     <p className="text-sm text-gray-500">
                        Você pode fechar esta página agora.
                    </p>
                </div>
            </div>
        );
    }
    
    if (linkStatus === 'invalid' || linkStatus === 'used') {
         return (
            <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4 text-center">
                <AlertCircleIcon className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Link Inválido ou Expirado</h2>
                <p className="text-gray-400">Este link de agendamento não existe ou já foi utilizado.</p>
                 <p className="text-sm text-gray-500 mt-4">Solicite um novo link ao profissional.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-extrabold text-white">Agendar Horário</h1>
                     {adminProfile && <p className="mt-2 text-gray-400">Com: <span className="text-white font-semibold">{adminProfile.full_name || 'Profissional'}</span></p>}
                </div>
                
                {message && (
                    <div className={`p-4 rounded-lg text-center ${message.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {message.text}
                    </div>
                )}
                
                {paymentData && (
                     <PaymentModal 
                        isOpen={paymentModalOpen} 
                        onClose={() => setPaymentModalOpen(false)}
                        paymentData={paymentData}
                        appointmentId={pendingAppointmentId || ''}
                        onManualCheck={handleManualVerification}
                     />
                )}

                <form onSubmit={handleSubmit} className="glassmorphism p-6 sm:p-8 rounded-2xl space-y-6 shadow-xl">
                     {/* Dados Pessoais */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2 mb-4">Seus Dados</h3>
                        <div className="space-y-4">
                            <input 
                                type="text" 
                                placeholder="Seu Nome Completo" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                required 
                                className="w-full bg-black/20 border border-gray-600 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                            />
                            <input 
                                type="tel" 
                                placeholder="Seu WhatsApp (DDD + Número)" 
                                value={phone} 
                                onChange={e => setPhone(maskPhone(e.target.value))} 
                                required 
                                maxLength={15} 
                                className="w-full bg-black/20 border border-gray-600 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                            />
                             <input 
                                type="email" 
                                placeholder="Seu Email (Opcional, para comprovante)" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                className="w-full bg-black/20 border border-gray-600 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                            />
                        </div>
                    </div>

                    {/* Seleção de Data e Hora - Mobile Stacked */}
                    <div className="space-y-4 pt-4">
                        <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2 mb-4">Escolha o Horário</h3>
                        
                        <div className="flex flex-col gap-6">
                            {/* Data - Full Width on Mobile */}
                            <div className="w-full">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Data</label>
                                <input 
                                    type="date" 
                                    required
                                    min={new Date().toISOString().split('T')[0]}
                                    onChange={e => {
                                        const d = parseDateAsUTC(e.target.value);
                                        if (isDayAvailable(d)) {
                                            setSelectedDate(d);
                                            setSelectedTime(null);
                                        } else {
                                            alert("Este dia não está disponível.");
                                            e.target.value = '';
                                            setSelectedDate(null);
                                        }
                                    }}
                                    className="w-full bg-black/20 border border-gray-600 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none min-h-[56px]"
                                    style={{ colorScheme: 'dark' }} 
                                />
                            </div>

                            {/* Horários - Grid Layout */}
                             {selectedDate && (
                                <div className="w-full animate-fade-in">
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Horários Disponíveis</label>
                                    {availableTimeSlots.length > 0 ? (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                            {availableTimeSlots.map(slot => (
                                                <button
                                                    key={slot}
                                                    type="button"
                                                    onClick={() => setSelectedTime(slot)}
                                                    className={`py-3 px-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                                        selectedTime === slot 
                                                        ? 'bg-blue-600 text-white ring-2 ring-blue-400' 
                                                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                                    }`}
                                                >
                                                    {slot}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center p-4 bg-gray-800/50 rounded-xl border border-gray-700 text-gray-400 text-sm">
                                            Nenhum horário disponível para esta data.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isSaving || !selectedDate || !selectedTime} 
                        className="w-full bg-white text-black font-black text-lg py-4 px-6 rounded-xl hover:bg-gray-200 transition-transform active:scale-95 disabled:opacity-50 disabled:scale-100 shadow-lg mt-8"
                    >
                        {isSaving ? <LoaderIcon className="w-6 h-6 mx-auto" /> : (paymentData ? 'Pagar Agora' : 'Confirmar Agendamento')}
                    </button>
                    
                     {businessProfile?.service_price && businessProfile.service_price > 0 && (
                        <p className="text-center text-xs text-gray-500 mt-2">
                            Ao confirmar, você será redirecionado para o pagamento Pix no valor de R$ {businessProfile.service_price.toFixed(2)}.
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
};

// --- COMPONENTES DA APLICAÇÃO ---

const Dashboard = ({ user, profile, onLogout }: { user: User, profile: Profile, onLogout: () => void }) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'todos' | 'hoje' | 'pendentes'>('hoje');
    const [stats, setStats] = useState({ total: 0, pending: 0, revenue: 0 });
    
    // Modals
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isNewApptModalOpen, setIsNewApptModalOpen] = useState(false);
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);

    // Assistant
    const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
        { sender: 'ai', text: 'Olá! Sou seu assistente inteligente. Posso ajudar a verificar sua agenda, criar agendamentos ou tirar dúvidas sobre faturamento. Como posso ajudar hoje?' }
    ]);
    const [isAssistantLoading, setIsAssistantLoading] = useState(false);

    const fetchAppointments = useCallback(async () => {
        setLoading(true);
        const { data, error = null } = await supabase
            .from('appointments')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: true })
            .order('time', { ascending: true });
        
        if (!error && data) {
            setAppointments(data as Appointment[]);
            
            // Calc stats
            const pending = data.filter((a: any) => a.status === 'Pendente' || a.status === 'Aguardando Pagamento').length;
            // Simplificação de receita: assumindo preço fixo ou pegando de payments
            setStats({ total: data.length, pending, revenue: 0 }); 
        }
        setLoading(false);
    }, [user.id]);

    useEffect(() => {
        fetchAppointments();
        
        // Setup Realtime
        const channel = supabase
            .channel(`dashboard-${user.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'appointments', filter: `user_id=eq.${user.id}` },
                (payload) => {
                    fetchAppointments(); // Refresh on any change
                }
            )
            .subscribe();

        // Check Terms
        if (!profile.terms_accepted_at) setIsTermsModalOpen(true);
        
        // Check Permissions
        checkPermissions();

        return () => { supabase.removeChannel(channel); };
    }, [user.id, profile.terms_accepted_at, fetchAppointments]);

    const checkPermissions = async () => {
        if (Capacitor.isNativePlatform()) {
             const permStatus = await PushNotifications.checkPermissions();
             if (permStatus.receive === 'prompt') {
                 PushNotifications.requestPermissions().then(result => {
                    if (result.receive === 'granted') PushNotifications.register();
                 });
             } else if (permStatus.receive === 'granted') {
                 PushNotifications.register();
             }
        } else if (Notification.permission === 'default') {
             Notification.requestPermission().then(permission => {
                 if (permission === 'granted' && messaging) {
                    getToken(messaging, { vapidKey: FIREBASE_VAPID_KEY }).then((currentToken) => {
                        if (currentToken) {
                             supabase.functions.invoke('register-push-token', { body: { token: currentToken } });
                        }
                    });
                 }
             });
        }
    };

    const handleUpdateStatus = async (id: string, status: Appointment['status']) => {
        await supabase.from('appointments').update({ status }).eq('id', id);
        // Optimistic update handled by fetch or realtime
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este agendamento?')) {
            await supabase.from('appointments').delete().eq('id', id);
        }
    };

    const handleManualCreate = async (name: string, phone: string, email: string, date: string, time: string) => {
        // Check limits for Trial
        if (profile.plan === 'trial') {
            const today = new Date().toISOString().split('T')[0];
            const usage = profile.last_usage_date === today ? profile.daily_usage : 0;
            if (usage >= 5) {
                setIsUpgradeModalOpen(true);
                return;
            }
        }
        
        const { error = null } = await supabase.from('appointments').insert({
            user_id: user.id, name, phone, email, date, time, status: 'Confirmado'
        });
        
        if (error) alert('Erro ao criar agendamento');
        else {
            // Update usage locally/optimistically (real sync happens on backend usually, but we do basic here)
            // Ideally backend triggers update
        }
    };

    const handleAssistantMessage = async (text: string) => {
        setAssistantMessages(prev => [...prev, { sender: 'user', text }]);
        setIsAssistantLoading(true);
        
        // Prepare context
        const context = `
            Hoje é: ${new Date().toISOString()}
            Meus Agendamentos: ${JSON.stringify(appointments.slice(0, 10))}
            Estatísticas: ${JSON.stringify(stats)}
        `;

        try {
            const { data, error = null } = await supabase.functions.invoke('deepseek-assistant', {
                body: { 
                    messages: [{role: 'user', content: text}],
                    context,
                    currentDate: new Date().toISOString()
                }
            });
            
            if (error || !data) throw new Error('Erro na IA');
            
            const aiResponse = data.choices[0].message.content;
            setAssistantMessages(prev => [...prev, { sender: 'ai', text: aiResponse }]);

            // Handle tool calls if any (simplified)
            if (data.choices[0].message.tool_calls) {
                // ... logic to handle tool calls like create_appointment ...
                setAssistantMessages(prev => [...prev, { sender: 'system', text: 'Função executada (simulação).' }]);
            }

        } catch (e) {
            setAssistantMessages(prev => [...prev, { sender: 'system', text: 'Desculpe, não consegui processar sua solicitação no momento.' }]);
        } finally {
            setIsAssistantLoading(false);
        }
    };

    // Filtering
    const filteredAppointments = useMemo(() => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        return appointments.filter(a => {
            if (filter === 'pendentes') return a.status === 'Pendente' || a.status === 'Aguardando Pagamento';
            if (filter === 'hoje') return a.date === todayStr;
            return true;
        });
    }, [appointments, filter]);

    return (
        <div className="min-h-screen bg-gray-900 pb-24">
             {/* Header */}
             <div className="bg-black/40 backdrop-blur-md sticky top-0 z-40 border-b border-gray-800 px-4 py-4 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-full flex items-center justify-center font-bold text-white">
                        OB
                    </div>
                    <h1 className="text-xl font-bold text-white">Oubook</h1>
                </div>
                <div className="flex items-center space-x-3">
                    <button onClick={() => setIsAssistantOpen(true)} className="p-2 bg-gray-800 rounded-full text-blue-400 hover:bg-gray-700">
                        <ChatBubbleIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white hover:bg-gray-700">
                        <SettingsIcon className="w-5 h-5" />
                    </button>
                    <button onClick={onLogout} className="p-2 bg-gray-800 rounded-full text-red-400 hover:bg-red-900/20">
                        <LogOutIcon className="w-5 h-5" />
                    </button>
                </div>
             </div>

             {/* Main Content */}
             <div className="p-4 max-w-4xl mx-auto space-y-6">
                 
                 {/* Quick Actions */}
                 <div className="grid grid-cols-2 gap-4">
                     <button onClick={() => setIsNewApptModalOpen(true)} className="bg-white text-black p-4 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 hover:bg-gray-200 transition-colors shadow-lg">
                         <PlusIcon className="w-6 h-6" />
                         Novo Agendamento
                     </button>
                     <button onClick={() => setIsLinkModalOpen(true)} className="bg-gray-800 text-white p-4 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 hover:bg-gray-700 transition-colors border border-gray-700">
                         <LinkIcon className="w-6 h-6" />
                         Gerar Link
                     </button>
                 </div>

                 {/* Filters */}
                 <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                     <button onClick={() => setFilter('hoje')} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === 'hoje' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Hoje</button>
                     <button onClick={() => setFilter('pendentes')} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === 'pendentes' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Pendentes</button>
                     <button onClick={() => setFilter('todos')} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === 'todos' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Todos</button>
                 </div>

                 {/* List */}
                 <div className="space-y-4">
                     {loading ? (
                         <div className="text-center py-10"><LoaderIcon className="w-8 h-8 mx-auto text-blue-500" /></div>
                     ) : filteredAppointments.length > 0 ? (
                         filteredAppointments.map(appt => (
                             <AppointmentCard 
                                key={appt.id} 
                                appointment={appt} 
                                onUpdateStatus={handleUpdateStatus} 
                                onDelete={handleDelete}
                             />
                         ))
                     ) : (
                         <div className="text-center py-10 text-gray-500">
                             <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                             Nenhum agendamento encontrado.
                         </div>
                     )}
                 </div>
             </div>

             {/* Modals */}
             <NewAppointmentModal isOpen={isNewApptModalOpen} onClose={() => setIsNewApptModalOpen(false)} onSave={handleManualCreate} user={user} />
             <LinkGeneratorModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} userId={user.id} />
             <BusinessProfileModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} userId={user.id} />
             <TermsModal isOpen={isTermsModalOpen} onClose={async () => {
                 setIsTermsModalOpen(false);
                 await supabase.from('profiles').update({ terms_accepted_at: new Date().toISOString() }).eq('id', user.id);
                 // Reload profile logic if needed
             }} />
             <UpgradeModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} limit={5} onUpgrade={() => window.open('https://hotmart.com', '_blank')} />
             <AssistantModal isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} messages={assistantMessages} onSendMessage={handleAssistantMessage} isLoading={isAssistantLoading} />
        </div>
    );
};

const Login = ({ onLogin }: { onLogin: () => void }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { error } = isSignUp 
            ? await supabase.auth.signUp({ email, password })
            : await supabase.auth.signInWithPassword({ email, password });
            
        setLoading(false);
        if (error) alert(error.message);
        else if (!error) onLogin(); // Session listener usually handles this
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-6">
            <div className="w-full max-w-sm space-y-8">
                <div className="text-center">
                    <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-2">Oubook</h1>
                    <p className="text-gray-400">Gerencie seus agendamentos com inteligência.</p>
                </div>
                
                <form onSubmit={handleAuth} className="space-y-4">
                    <div className="space-y-4">
                        <input 
                            type="email" 
                            placeholder="Email" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                            required 
                        />
                        <input 
                            type="password" 
                            placeholder="Senha" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                            required 
                        />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20">
                        {loading ? <LoaderIcon className="w-6 h-6 mx-auto" /> : (isSignUp ? 'Criar Conta' : 'Entrar')}
                    </button>
                </form>
                
                <div className="text-center">
                    <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-gray-400 hover:text-white transition-colors">
                        {isSignUp ? 'Já tem uma conta? Entre aqui.' : 'Não tem conta? Cadastre-se grátis.'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Main = () => {
    const [session, setSession] = useState<any>(null);
    const [userProfile, setUserProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentPath, setCurrentPath] = useState(window.location.pathname);

    useEffect(() => {
        // Router check
        const checkPath = () => setCurrentPath(window.location.pathname);
        window.addEventListener('popstate', checkPath);

        // Auth check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) fetchProfile(session.user.id);
            else setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) fetchProfile(session.user.id);
            else { setUserProfile(null); setLoading(false); }
        });

        return () => {
            window.removeEventListener('popstate', checkPath);
            subscription.unsubscribe();
        };
    }, []);

    const fetchProfile = async (userId: string) => {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (data) setUserProfile(data);
        else if (error && error.code === 'PGRST116') {
             // Create profile if missing (fallback)
             await supabase.from('profiles').insert({ id: userId, plan: 'trial', daily_usage: 0, last_usage_date: new Date().toISOString().split('T')[0] });
             fetchProfile(userId);
             return;
        }
        setLoading(false);
    };

    // Routing Logic
    if (currentPath.startsWith('/book-link/')) {
        const tokenId = currentPath.split('/book-link/')[1];
        return <PaginaDeAgendamento tokenId={tokenId} />;
    }
    
    // Check for Query Params fallback (e.g. ?token=...)
    const params = new URLSearchParams(window.location.search);
    if (params.get('token')) {
        return <PaginaDeAgendamento tokenId={params.get('token')!} />;
    }

    if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><LoaderIcon className="w-10 h-10 text-blue-500" /></div>;

    if (!session) return <Login onLogin={() => {}} />;

    if (userProfile) return <Dashboard user={session.user} profile={userProfile} onLogout={() => supabase.auth.signOut()} />;
    
    return null;
};

const root = createRoot(document.getElementById('root')!);
root.render(<Main />);