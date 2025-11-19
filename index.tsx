import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { PushNotifications } from '@capacitor/push-notifications';

// As chaves agora são carregadas de forma segura a partir das variáveis de ambiente.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PRODUCTION_URL = import.meta.env.VITE_PRODUCTION_URL;
// Client ID do Mercado Pago (Público) para o botão de conectar
const MP_CLIENT_ID = import.meta.env.VITE_MP_CLIENT_ID; 

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !PRODUCTION_URL) {
  console.error("Variáveis de ambiente ausentes. Verifique seu .env ou configurações do Vercel.");
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');

// Tipos
type Appointment = {
  id: string;
  created_at: string;
  name: string;
  email?: string;
  phone?: string;
  date: string;
  time: string;
  status: 'Pendente' | 'Confirmado' | 'Cancelado' | 'Pago';
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
}

type User = {
    id: string;
    email?: string;
};

type AssistantMessage = {
    sender: 'user' | 'ai' | 'system';
    text: string;
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
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
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
const DollarSignIcon = (props: any) => <Icon {...props}><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></Icon>;


// --- Componentes de UI ---
const StatusBadge = ({ status }: { status: Appointment['status'] }) => {
  const baseClasses = "px-3 py-1 text-xs font-medium rounded-full text-white";
  const statusClasses = {
    Pendente: "bg-yellow-500/20 text-yellow-300",
    Confirmado: "bg-green-500/20 text-green-300",
    Cancelado: "bg-red-500/20 text-red-300",
    Pago: "bg-blue-500/20 text-blue-300",
  };
  return <span className={`${baseClasses} ${statusClasses[status] || statusClasses.Pendente}`}>{status}</span>;
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
              {appointment.status === 'Pendente' && (
                <button
                    onClick={() => onUpdateStatus(appointment.id, 'Confirmado')}
                    className="w-full flex justify-center items-center space-x-2 bg-green-500/20 hover:bg-green-500/40 text-green-300 font-semibold py-2 px-4 rounded-lg transition-colors duration-300"
                >
                    <CheckCircleIcon className="w-4 h-4" />
                    <span>Confirmar</span>
                </button>
              )}
               {appointment.status === 'Pago' && (
                <div className="w-full flex justify-center items-center space-x-2 bg-blue-500/20 text-blue-300 font-semibold py-2 px-4 rounded-lg">
                    <CheckCircleIcon className="w-4 h-4" />
                    <span>Pago via Pix</span>
                </div>
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
                <h2 className="text-2xl font-bold text-white mb-6 pr-8">{title}</h2>
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

const PaymentModal = ({ isOpen, onClose, paymentData }: { isOpen: boolean, onClose: () => void, paymentData: any }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (paymentData?.qr_code) {
            navigator.clipboard.writeText(paymentData.qr_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!paymentData) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Pagamento via Pix">
            <div className="flex flex-col items-center space-y-6 text-center">
                <p className="text-gray-300">
                    Escaneie o QR Code abaixo ou copie o código Pix para pagar.
                </p>
                
                {paymentData.qr_code_base64 ? (
                    <div className="bg-white p-4 rounded-xl">
                        <img src={`data:image/png;base64,${paymentData.qr_code_base64}`} alt="QR Code Pix" className="w-48 h-48" />
                    </div>
                ) : (
                    <div className="w-48 h-48 bg-gray-700 rounded-xl flex items-center justify-center animate-pulse">
                        <LoaderIcon className="w-8 h-8" />
                    </div>
                )}

                <div className="w-full space-y-2">
                    <p className="text-sm text-gray-400">Pix Copia e Cola</p>
                    <div className="flex items-center space-x-2 bg-black/30 p-3 rounded-lg border border-gray-600">
                        <input type="text" value={paymentData.qr_code} readOnly className="bg-transparent text-white w-full outline-none text-xs font-mono truncate" />
                        <button onClick={handleCopy} className="text-gray-400 hover:text-white p-1">
                            {copied ? <CheckCircleIcon className="w-5 h-5 text-green-400" /> : <CopyIcon className="w-5 h-5" />}
                        </button>
                    </div>
                    <button 
                        onClick={handleCopy}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-colors mt-2"
                    >
                        {copied ? 'Copiado!' : 'Copiar Código Pix'}
                    </button>
                </div>

                <div className="text-xs text-yellow-400/80 flex items-center gap-2 bg-yellow-500/10 p-3 rounded-lg w-full text-left">
                    <AlertCircleIcon className="w-4 h-4 flex-shrink-0" />
                    <span>O agendamento será confirmado automaticamente assim que o pagamento for identificado.</span>
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
            
            if (error || !data) {
                throw error || new Error("Não foi possível obter o ID do link gerado.");
            }
            
            const newLink = `${PRODUCTION_URL}/book-link/${data.id}`;
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
    const [profile, setProfile] = useState<BusinessProfile>({ user_id: userId, blocked_dates: [], blocked_times: {}, working_days: {}, start_time: '09:00', end_time: '17:00' });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [newBlockedDate, setNewBlockedDate] = useState('');
    const [newBlockedTime, setNewBlockedTime] = useState('');
    const [selectedDay, setSelectedDay] = useState('monday');
    const [mpConnected, setMpConnected] = useState(false);

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
                     supabase.from('mp_connections').select('user_id').eq('user_id', userId).single()
                ]);

                if (profileRes.data) {
                    setProfile({
                        ...profileRes.data,
                        blocked_dates: profileRes.data.blocked_dates || [],
                        blocked_times: profileRes.data.blocked_times || {},
                        working_days: profileRes.data.working_days || defaultWorkingDays,
                        start_time: profileRes.data.start_time || defaultStartTime,
                        end_time: profileRes.data.end_time || defaultEndTime,
                    });
                } else {
                    setProfile({ user_id: userId, blocked_dates: [], blocked_times: {}, working_days: defaultWorkingDays, start_time: defaultStartTime, end_time: defaultEndTime });
                }
                setMpConnected(!!mpRes.data);
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
    
    const connectMercadoPago = () => {
        if (!MP_CLIENT_ID) {
            alert("Configure VITE_MP_CLIENT_ID nas variáveis de ambiente.");
            return;
        }
        // Use SUPABASE_URL to construct the redirect URI pointing directly to the edge function
        const baseUrl = SUPABASE_URL.replace(/\/$/, '');
        const redirectUri = `${baseUrl}/functions/v1/mercadopago-connect`;
        
        // Constrói URL de autorização
        const url = `https://auth.mercadopago.com.br/authorization?client_id=${MP_CLIENT_ID}&response_type=code&platform_id=mp&state=${userId}&redirect_uri=${redirectUri}`;
        
        window.open(url, '_blank');
        
        // Polling simples para atualizar o status da conexão na UI
        const interval = setInterval(async () => {
            const { data } = await supabase.from('mp_connections').select('user_id').eq('user_id', userId).single();
            if (data) {
                setMpConnected(true);
                clearInterval(interval);
            }
        }, 3000);
        setTimeout(() => clearInterval(interval), 120000);
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
                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 scrollbar-hide">
                     <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/30">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-1 rounded">
                                    <img src="https://http2.mlstatic.com/frontend-assets/mp-web-navigation/ui-navigation/5.19.5/mercadopago/logo__large.png" alt="MP" className="h-6" />
                                </div>
                                <span className="text-sm text-gray-300">Receba via PIX automático</span>
                            </div>
                            {mpConnected ? (
                                <span className="text-green-400 text-xs font-bold flex items-center gap-1">
                                    <CheckCircleIcon className="w-4 h-4" /> Conectado
                                </span>
                            ) : (
                                <button onClick={connectMercadoPago} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-md font-bold">
                                    Conectar
                                </button>
                            )}
                        </div>
                    </div>

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

const UpgradeModal = ({ isOpen, onClose, limit }: { isOpen: boolean, onClose: () => void, limit: number }) => {
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
                <a 
                    href="https://pay.hotmart.com/U102480243K?checkoutMode=2"
                    className="hotmart-fb hotmart__button-checkout w-full"
                >
                    🚀 Fazer Upgrade Ilimitado
                </a>
            </div>
        </Modal>
    );
};

const TermsModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Termos de Uso e Privacidade" size="xl">
            <div className="text-gray-300 space-y-4 max-h-[60vh] overflow-y-auto pr-4 scrollbar-hide">
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
            <div className="flex flex-col h-[60vh]">
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
    const [adminHasMP, setAdminHasMP] = useState(false);
    
    const [linkStatus, setLinkStatus] = useState<'loading' | 'valid' | 'invalid' | 'used'>('loading');
    const [bookingCompleted, setBookingCompleted] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [paymentData, setPaymentData] = useState<any>(null);

    const [currentMonth, setCurrentMonth] = useState(new Date());

    const dayMap = useMemo(() => ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], []);

    useEffect(() => {
        const validateLinkAndFetchData = async () => {
            try {
                setLinkStatus('loading');
                const { data: linkData, error: linkError } = await supabase
                    .from('one_time_links')
                    .select('user_id, is_used')
                    .eq('id', tokenId)
                    .single();

                if (linkError || !linkData) {
                    setLinkStatus('invalid');
                    return;
                }
                if (linkData.is_used) {
                    setLinkStatus('used');
                    return;
                }

                const currentAdminId = linkData.user_id;
                setAdminId(currentAdminId);

                const [profileRes, businessProfileRes, appointmentsRes, mpRes] = await Promise.all([
                    supabase.from('profiles').select('*').eq('id', currentAdminId).single(),
                    supabase.from('business_profiles').select('*').eq('user_id', currentAdminId).single(),
                    supabase.from('appointments').select('date, time').eq('user_id', currentAdminId).in('status', ['Pendente', 'Confirmado']),
                    supabase.from('mp_connections').select('user_id').eq('user_id', currentAdminId).single()
                ]);

                if (profileRes.error) throw profileRes.error;
                
                setAdminProfile(profileRes.data);
                setAppointments(appointmentsRes.data || []);
                setAdminHasMP(!!mpRes.data);
                
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
                } : { user_id: currentAdminId, blocked_dates: [], blocked_times: {}, working_days: defaultWorkingDays, start_time: defaultStartTime, end_time: defaultEndTime });

                setLinkStatus('valid');
            } catch (error) {
                console.error('Erro ao buscar dados do admin:', error);
                setLinkStatus('invalid');
            }
        };
        validateLinkAndFetchData();
    }, [tokenId]);
    
    useEffect(() => {
        if (!paymentModalOpen || !paymentData?.id) return;
        
        const channel = supabase
            .channel(`payment-update-${paymentData.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'payments', filter: `mp_payment_id=eq.${paymentData.id}` },
                (payload: any) => {
                    if (payload.new.status === 'approved') {
                        setPaymentModalOpen(false);
                        setBookingCompleted(true);
                    }
                }
            )
            .subscribe();
            
        return () => { supabase.removeChannel(channel); };
    }, [paymentModalOpen, paymentData]);


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
            
        const blockedRecurringTimes = businessProfile.blocked_times[dayOfWeek] || [];

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
            const { data: appointmentRes, error: bookError } = await supabase.functions.invoke('book-appointment-public', {
                body: {
                    tokenId: tokenId,
                    name: name,
                    phone: unmaskedPhone,
                    email: email,
                    date: dateString,
                    time: selectedTime,
                },
            });

            if (bookError) {
                const errorMessage = (appointmentRes as any)?.error || 'Ocorreu um erro ao salvar seu agendamento. Tente novamente.';
                throw new Error(errorMessage);
            }
            
            if (adminHasMP) {
                const { data: appointmentData } = await supabase.from('appointments').select('id').eq('date', dateString).eq('time', selectedTime).eq('user_id', adminId).single();
                
                if (appointmentData) {
                    const { data: payData, error: payError } = await supabase.functions.invoke('create-payment', {
                        body: {
                            amount: 10.00, 
                            description: `Agendamento com ${name}`,
                            professionalId: adminId,
                            appointmentId: appointmentData.id,
                            payerEmail: email || 'cliente@sememail.com'
                        }
                    });
                    
                    if (payError || !payData) {
                        console.error("Payment creation failed", payError);
                        alert("Agendamento realizado, mas houve um erro ao gerar o Pix. O pagamento deverá ser feito no local.");
                        setBookingCompleted(true);
                    } else {
                        setPaymentData(payData);
                        setPaymentModalOpen(true);
                    }
                } else {
                    setBookingCompleted(true);
                }
            } else {
                setBookingCompleted(true);
            }

        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setIsSaving(false);
        }
    };

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
                <button key={day} type="button" onClick={() => handleDateSelect(date)} disabled={!isAvailable} className={classes}>
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
                <div className="glassmorphism rounded-2xl p-8">
                    <CheckCircleIcon className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">Agendamento Concluído</h1>
                    <p className="text-gray-400">
                        Seu horário foi agendado com sucesso.
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
                        
                        <button 
                            type="submit" 
                            disabled={isSaving || !selectedDate || !selectedTime}
                            className="w-full bg-white text-black font-bold py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 mt-6"
                        >
                            {isSaving ? <LoaderIcon className="w-6 h-6 mx-auto" /> : 'Confirmar Agendamento'}
                        </button>
                    </form>
                </div>
            </div>
            <PaymentModal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} paymentData={paymentData} />
        </div>
    );
};

// --- Auth Component ---
const Auth = ({ onLogin }: { onLogin: () => void }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                alert('Cadastro realizado! Verifique seu email para confirmar.');
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                onLogin();
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex justify-center items-center p-4">
            <div className="glassmorphism rounded-2xl p-8 w-full max-w-md">
                <h1 className="text-3xl font-bold text-white mb-6 text-center">Oubook</h1>
                <form onSubmit={handleAuth} className="space-y-4">
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" />
                    <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" />
                    {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full bg-white text-black font-bold py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50">
                        {loading ? <LoaderIcon className="w-6 h-6 mx-auto" /> : (isSignUp ? 'Cadastrar' : 'Entrar')}
                    </button>
                </form>
                <button onClick={() => setIsSignUp(!isSignUp)} className="w-full mt-4 text-gray-400 text-sm hover:text-white">
                    {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Cadastre-se'}
                </button>
            </div>
        </div>
    );
};

// --- Dashboard Component ---
const Dashboard = ({ user }: { user: User }) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    const [isAssistantModalOpen, setIsAssistantModalOpen] = useState(false);
    const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([{ sender: 'ai', text: 'Olá! Sou sua assistente virtual. Como posso ajudar com seus agendamentos hoje?' }]);
    const [isAssistantLoading, setIsAssistantLoading] = useState(false);
    const [profile, setProfile] = useState<Profile | null>(null);

    const fetchAppointments = useCallback(async () => {
        const { data } = await supabase.from('appointments').select('*').eq('user_id', user.id).order('date', { ascending: true });
        if (data) setAppointments(data);
    }, [user.id]);

    const fetchProfile = useCallback(async () => {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) {
            setProfile(data);
            if (!data.terms_accepted_at) setIsTermsModalOpen(true);
        }
    }, [user.id]);

    useEffect(() => {
        Promise.all([fetchAppointments(), fetchProfile()]).then(() => setLoading(false));
        
        const channel = supabase.channel(`dashboard-${user.id}`)
            .on('broadcast', { event: 'new_public_appointment' }, (payload) => {
                setAppointments(prev => [...prev, payload.payload].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
                new Notification('Novo Agendamento', { body: `${payload.payload.name} agendou para ${payload.payload.date}` });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user.id, fetchAppointments, fetchProfile]);
    
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            PushNotifications.requestPermissions().then(result => {
                if (result.receive === 'granted') PushNotifications.register();
            });
            PushNotifications.addListener('registration', (token) => {
                supabase.functions.invoke('register-push-token', { body: { token: token.value } });
            });
        }
    }, []);

    const handleCreateAppointment = async (name: string, phone: string, email: string, date: string, time: string) => {
        if (profile?.plan === 'trial') {
            const today = new Date().toISOString().split('T')[0];
            if (profile.last_usage_date === today && profile.daily_usage >= 5) {
                setIsUpgradeModalOpen(true);
                return;
            }
        }
        const { data, error } = await supabase.from('appointments').insert({ user_id: user.id, name, phone, email, date, time, status: 'Confirmado' }).select().single();
        if (!error && data) {
            setAppointments(prev => [...prev, data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
            fetchProfile();
        } else {
             alert('Erro ao criar agendamento.');
        }
    };

    const handleUpdateStatus = async (id: string, status: Appointment['status']) => {
        const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
        if (!error) setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir?')) {
            const { error } = await supabase.from('appointments').delete().eq('id', id);
            if (!error) setAppointments(prev => prev.filter(a => a.id !== id));
        }
    };
    
    const handleSendMessageToAssistant = async (text: string) => {
        setAssistantMessages(prev => [...prev, { sender: 'user', text }]);
        setIsAssistantLoading(true);
        try {
            // Contexto básico dos agendamentos atuais
            const context = appointments.map(a => `${a.date} ${a.time}: ${a.name} (${a.status})`).join('\n');
            const currentDate = new Date().toISOString();

            const { data, error } = await supabase.functions.invoke('deepseek-assistant', {
                body: { 
                    messages: [{ role: 'user', content: text }],
                    context: context,
                    currentDate: currentDate
                }
            });
            
            if (error) throw error;
            
            const aiResponse = data.choices[0].message;
            
            // Se a IA decidiu chamar uma função (criar agendamento)
            if (aiResponse.tool_calls) {
                 for (const toolCall of aiResponse.tool_calls) {
                    if (toolCall.function.name === 'create_appointment') {
                        const args = JSON.parse(toolCall.function.arguments);
                        await handleCreateAppointment(args.name, args.phone || '', args.email || '', args.date, args.time);
                        setAssistantMessages(prev => [...prev, { sender: 'system', text: `✅ Agendamento criado para ${args.name} em ${args.date} às ${args.time}.` }]);
                    }
                 }
            } else {
                 setAssistantMessages(prev => [...prev, { sender: 'ai', text: aiResponse.content }]);
            }

        } catch (err) {
            console.error(err);
            setAssistantMessages(prev => [...prev, { sender: 'system', text: 'Desculpe, tive um erro ao processar seu pedido.' }]);
        } finally {
            setIsAssistantLoading(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-black flex justify-center items-center"><LoaderIcon className="w-12 h-12 text-white" /></div>;

    return (
        <div className="min-h-screen bg-black text-white p-4 sm:p-6">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold">Olá, Profissional</h1>
                    <p className="text-gray-400 text-sm">Gerencie seus agendamentos</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsAssistantModalOpen(true)} className="bg-purple-600 p-2 rounded-full hover:bg-purple-500"><BotIcon className="w-5 h-5" /></button>
                    <button onClick={() => setIsProfileModalOpen(true)} className="bg-gray-800 p-2 rounded-full hover:bg-gray-700"><SettingsIcon className="w-5 h-5" /></button>
                    <button onClick={() => supabase.auth.signOut()} className="bg-red-900/50 p-2 rounded-full hover:bg-red-800"><LogOutIcon className="w-5 h-5" /></button>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <button onClick={() => setIsNewModalOpen(true)} className="bg-gray-200 text-black p-4 rounded-2xl font-bold hover:bg-white transition flex items-center justify-center gap-2">
                    <PlusIcon className="w-5 h-5" /> Novo
                </button>
                <button onClick={() => setIsLinkModalOpen(true)} className="glassmorphism p-4 rounded-2xl font-bold hover:bg-white/10 transition flex items-center justify-center gap-2">
                    <LinkIcon className="w-5 h-5" /> Link
                </button>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-bold mb-4">Próximos Agendamentos</h2>
                {appointments.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Nenhum agendamento encontrado.</p>
                ) : (
                    appointments.map(app => (
                        <AppointmentCard key={app.id} appointment={app} onUpdateStatus={handleUpdateStatus} onDelete={handleDelete} />
                    ))
                )}
            </div>
            
            <NewAppointmentModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} onSave={handleCreateAppointment} user={user} />
            <LinkGeneratorModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} userId={user.id} />
            <BusinessProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} userId={user.id} />
            <UpgradeModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} limit={5} />
            <TermsModal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} />
            <AssistantModal isOpen={isAssistantModalOpen} onClose={() => setIsAssistantModalOpen(false)} messages={assistantMessages} onSendMessage={handleSendMessageToAssistant} isLoading={isAssistantLoading} />
        </div>
    );
};

// --- Main App Component ---
const App = () => {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [path, setPath] = useState(window.location.pathname);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });
        return () => subscription.unsubscribe();
    }, []);

    if (loading) return <div className="min-h-screen bg-black flex justify-center items-center"><LoaderIcon className="w-12 h-12 text-white" /></div>;

    // Roteamento simples baseado na URL
    if (path.startsWith('/book-link/')) {
        const tokenId = path.split('/book-link/')[1];
        return <PaginaDeAgendamento tokenId={tokenId} />;
    }

    return session ? <Dashboard user={session.user} /> : <Auth onLogin={() => {}} />;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
