
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { PushNotifications } from '@capacitor/push-notifications';
import { Purchases } from '@revenuecat/purchases-capacitor';


declare let jspdf: any;

// As chaves agora são carregadas de forma segura a partir das variáveis de ambiente.
// Certifique-se de configurar VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e VITE_PRODUCTION_URL no seu ambiente de build (Vercel).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PRODUCTION_URL = import.meta.env.VITE_PRODUCTION_URL;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !PRODUCTION_URL) {
  const missingVars = [
    !SUPABASE_URL && "VITE_SUPABASE_URL",
    !SUPABASE_ANON_KEY && "VITE_SUPABASE_ANON_KEY",
    !PRODUCTION_URL && "VITE_PRODUCTION_URL"
  ].filter(Boolean).join(', ');
  throw new Error(`Variáveis de ambiente ausentes: ${missingVars}. Por favor, configure-as no seu arquivo .env ou nas configurações do seu provedor de hospedagem.`);
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
    // Month is 0-indexed for Date.UTC
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
const PlusIcon = (props: any) => <Icon {...props}><line x1="12" cy="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></Icon>;
const UserIcon = (props: any) => <Icon {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></Icon>;
const MailIcon = (props: any) => <Icon {...props}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></Icon>;
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
        const { error } = await supabase.from('business_profiles').upsert(profileToSave, { onConflict: 'user_id' });
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

        if (!clientId || !redirectUri) {
            alert(`ERRO DE CONFIGURAÇÃO: Variáveis de ambiente do Mercado Pago não encontradas.
            
            Verifique no Vercel:
            VITE_MP_CLIENT_ID: ${clientId ? 'OK' : 'FALTA'}
            VITE_MP_REDIRECT_URL: ${redirectUri ? 'OK' : 'FALTA'}
            
            Após configurar, faça um novo Deploy.`);
            return;
        }
        
        // Codificar a URL corretamente
        const encodedRedirect = encodeURIComponent(redirectUri);
        
        // Gera um estado aleatório (pode ser o ID do usuário) para segurança
        const state = userId;
        
        const mpAuthUrl = `https://auth.mercadopago.com.br/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodedRedirect}`;
        
        console.log("Redirecionando para:", mpAuthUrl); // Debug
        window.location.href = mpAuthUrl;
    };

    const handleDisconnect = async () => {
        const confirmDisconnect = window.confirm("Deseja realmente desconectar sua conta do Mercado Pago? Você não poderá receber pagamentos Pix até conectar novamente.");
        if (!confirmDisconnect) return;

        setIsLoading(true);
        const { error } = await supabase
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
                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 scrollbar-hide">
                    
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
                    className="hotmart-fb hotmart__button-checkout w-full"
                >
                    🚀 Fazer Upgrade Ilimitado
                </button>
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
    
    const [linkStatus, setLinkStatus] = useState<'loading' | 'valid' | 'invalid' | 'used'>('loading');
    const [bookingCompleted, setBookingCompleted] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());

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
                const { data: linkData, error: linkError } = await supabase
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
                        const { data: appt } = await supabase
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
                             const { data: existingPayment } = await supabase
                                .from('payments')
                                .select('*')
                                .eq('appointment_id', appt.id)
                                .single();
                            
                            if (existingPayment) {
                                // Tenta buscar os dados completos do pagamento (QR Code) novamente via Edge Function
                                try {
                                    const { data: qrData, error: qrError } = await supabase.functions.invoke('create-payment', {
                                        body: {
                                            action: 'retrieve',
                                            paymentId: existingPayment.mp_payment_id,
                                            professionalId: linkData.user_id
                                        }
                                    });
                                    
                                    if (qrData && !qrData.error) {
                                        setPaymentData(qrData);
                                    } else {
                                        console.warn("Falha ao recuperar QR Code completo:", qrData?.error);
                                        // Fallback: usa dados parciais do banco (sem imagem QR)
                                        setPaymentData({
                                            id: parseInt(existingPayment.mp_payment_id),
                                            status: existingPayment.status,
                                            qr_code: '', 
                                            qr_code_base64: '',
                                            ticket_url: ''
                                        });
                                    }
                                } catch (e) {
                                    console.error("Erro na chamada da Edge Function para recuperar QR Code:", e);
                                     setPaymentData({
                                        id: parseInt(existingPayment.mp_payment_id),
                                        status: existingPayment.status,
                                        qr_code: '',
                                        qr_code_base64: '',
                                        ticket_url: ''
                                    });
                                }
                            }

                            // Continua carregando o perfil do admin para exibir infos corretas
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

    // Polling automático robusto: Funciona enquanto houver um pagamento pendente conhecido,
    // independente se o modal está aberto ou fechado.
    useEffect(() => {
        let intervalId: any;

        // Só faz polling se tivermos um ID de pagamento, um agendamento pendente e a reserva ainda não estiver concluída.
        if (paymentData?.id && pendingAppointmentId && !bookingCompleted) {
            const checkStatus = async () => {
                try {
                    // Chama o webhook manualmente apenas para verificar (silent check)
                    const { data, error } = await supabase.functions.invoke('mp-webhook', {
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
                    // Ignora erros silenciosamente no polling para não atrapalhar o UX
                }
            };

            // Verifica a cada 4 segundos
            intervalId = setInterval(checkStatus, 4000);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [paymentData, pendingAppointmentId, bookingCompleted]);

    const handleManualVerification = async (paymentId: number) => {
        try {
            // Tenta chamar o webhook manualmente para forçar a verificação
            const { data, error } = await supabase.functions.invoke('mp-webhook', {
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
    
    const handlePayment = async (appointmentId: string, amount: number) => {
        try {
            const { data, error } = await supabase.functions.invoke('create-payment', {
                body: {
                    amount: amount,
                    description: `Agendamento ${name}`,
                    professionalId: adminId,
                    appointmentId: appointmentId,
                    payerEmail: email || 'cliente@oubook.com'
                }
            });
            
            if (error || data.error) {
                throw new Error(data?.error || error?.message || 'Erro ao gerar Pix');
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
        
        // Caso de recuperação onde o usuário clica em "Abrir Pagamento Pix"
        if (pendingAppointmentId && adminId && businessProfile?.service_price) {
             // Se já temos dados de pagamento na memória, abre modal
             if (paymentData) {
                 setPaymentModalOpen(true);
             } else {
                 // Se não, gera um novo (idempotente) para pegar o QR Code visual
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
            const { data, error } = await supabase.functions.invoke('book-appointment-public', {
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
            setPendingAppointmentId(newApptId); // Salva estado para realtime

            // VERIFICA SE O AGENDAMENTO JÁ FOI CRIADO COMO CONFIRMADO (Grátis ou sem MP)
            if (newAppt.status === 'Confirmado') {
                setBookingCompleted(true);
                return; // Encerra o fluxo aqui, não gera pagamento.
            }

            // Se não confirmado, verificar se precisa de pagamento (dupla verificação com o estado local)
            if (businessProfile?.service_price && businessProfile.service_price > 0) {
                // Inicia fluxo de pagamento
                await handlePayment(newApptId, businessProfile.service_price);
            } else {
                // Fallback: se por algum motivo o back retornou pendente mas o front acha que é 0
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
                <button key={day} onClick={() => handleDateSelect(date)} disabled={!isAvailable} className={classes}>
                    {day}
                </button>
            );
        }

        return (
            <div className="bg-black/20 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-700"><ChevronLeftIcon className="w-5 h-5 text-white"/></button>
                    <h3 className="font-bold text-white text-lg">{currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
                    <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-700"><ChevronRightIcon className="w-5 h-5 text-white"/></button>
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
                            ? 'Este link de agendamento já foi utilizado e o horário confirmado ou expirado.' 
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
                    
                    {pendingAppointmentId ? (
                        <div className="bg-yellow-500/10 border border-yellow-500/50 p-4 rounded-lg mb-6 text-center">
                            <p className="text-yellow-200 font-bold mb-2">Pagamento Pendente</p>
                            <p className="text-sm text-gray-300 mb-4">Você já iniciou este agendamento. Finalize o pagamento para confirmar.</p>
                            
                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={handleSubmit}
                                    className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-4 rounded w-full transition-colors"
                                >
                                    Abrir Pagamento Pix
                                </button>
                                
                                {paymentData && (
                                    <button 
                                        onClick={() => handleManualVerification(paymentData.id)}
                                        className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 font-bold py-2 px-4 rounded w-full transition-colors flex items-center justify-center gap-2"
                                    >
                                        <RefreshIcon className="w-4 h-4" />
                                        Já realizei o pagamento
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
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
                                <div className="bg-gray-800 p-4 rounded-lg text-center">
                                    <p className="text-gray-400 text-sm">Valor do Serviço</p>
                                    <p className="text-2xl font-bold text-white">R$ {businessProfile.service_price.toFixed(2)}</p>
                                </div>
                            )}

                            <button type="submit" disabled={isSaving || !selectedDate || !selectedTime || !name || !phone} className="w-full bg-gray-200 text-black font-bold py-3 px-4 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                {isSaving ? <LoaderIcon className="w-6 h-6 mx-auto" /> : (businessProfile?.service_price ? 'Ir para Pagamento' : 'Confirmar Agendamento')}
                            </button>
                        </form>
                    )}
                </div>
            </div>
            
            {paymentData && pendingAppointmentId && (
                <PaymentModal 
                    isOpen={paymentModalOpen} 
                    onClose={() => setPaymentModalOpen(false)} 
                    paymentData={paymentData}
                    appointmentId={pendingAppointmentId}
                    onManualCheck={handleManualVerification}
                />
            )}
        </div>
    );
};


const LoginPage = () => {
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    const [hasAcceptedPreviously, setHasAcceptedPreviously] = useState(false);

    useEffect(() => {
        if (localStorage.getItem('termsAccepted') === 'true') {
            setHasAcceptedPreviously(true);
            setTermsAccepted(true); // Pre-approve logically to enable the button
        }
    }, []);
    
    const handleLogin = async () => {
        if (!termsAccepted) {
            alert("Você precisa aceitar os Termos de Uso para continuar.");
            return;
        }
    
        const getRedirectUrl = () => {
            const isNative = Capacitor.isNativePlatform();
            return isNative ? 'com.oubook.app://auth-callback' : window.location.origin;
        };
    
        try {
            const isNative = Capacitor.isNativePlatform();
            const redirectTo = getRedirectUrl();
    
            if (isNative) {
                // For native, we get the URL and open it in the Capacitor Browser
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo,
                        skipBrowserRedirect: true, // Important for native flow
                    },
                });
                if (error) throw error;
                if (data.url) {
                    await Browser.open({ url: data.url, windowName: '_self' });
                }
            } else {
                // For web, Supabase handles the redirect automatically
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo,
                    },
                });
                if (error) throw error;
            }
        } catch (error) {
            console.error("Erro no login com Google:", error);
        }
    };

    return (
        <>
            <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4">
                <div className="text-center w-full max-sm">
                     <CalendarIcon className="w-16 h-16 text-white mx-auto mb-4" />
                     <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2">Oubook</h1>
                     <p className="text-base sm:text-lg text-gray-400 mb-8">A maneira mais inteligente de gerenciar seus agendamentos.</p>
                     
                     <div className="my-6">
                        {hasAcceptedPreviously ? (
                            <p className="text-xs text-gray-500 text-center">
                                Ao continuar, você concorda com nossos <button type="button" onClick={() => setIsTermsModalOpen(true)} className="underline hover:text-white">Termos de Uso</button>.
                            </p>
                        ) : (
                            <label className="flex items-center justify-center space-x-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={termsAccepted}
                                    onChange={() => setTermsAccepted(!termsAccepted)}
                                    className="h-4 w-4 accent-gray-400 bg-gray-800 border-gray-600 rounded focus:ring-gray-500"
                                />
                                <span className="text-sm text-gray-400">Eu li e aceito os <button type="button" onClick={() => setIsTermsModalOpen(true)} className="underline hover:text-white">Termos de Uso</button></span>
                            </label>
                        )}
                     </div>
                     
                     <button 
                        onClick={handleLogin} 
                        disabled={!termsAccepted}
                        className="w-full bg-white text-black font-bold py-3 px-8 rounded-lg transition-all text-lg flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-gray-200"
                     >
                         <svg className="w-6 h-6" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.42-4.55H24v8.51h12.8c-.57 2.74-2.31 5.11-4.81 6.69l7.98 6.19c4.65-4.3 7.3-10.49 7.3-17.84z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.98-6.19c-2.11 1.45-4.81 2.3-7.91 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                        <span>Entrar com Google</span>
                     </button>
                </div>
            </div>
            <TermsModal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} />
        </>
    );
};

const Dashboard = ({ user, profile, setProfile }: { user: User, profile: Profile | null, setProfile: React.Dispatch<React.SetStateAction<Profile | null>>}) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
    const [statusFilter, setStatusFilter] = useState<'Pendente' | 'Confirmado' | 'Cancelado' | 'Todos'>('Todos');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    // State for pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const APPOINTMENTS_PAGE_SIZE = 20;

    const [isAssistantModalOpen, setIsAssistantModalOpen] = useState(false);
    const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
        { sender: 'ai', text: 'Olá! Como posso ajudar a organizar sua agenda hoje?' }
    ]);
    const [isAssistantLoading, setIsAssistantLoading] = useState(false);


    const TRIAL_LIMIT = 5;
    const usage = profile?.daily_usage ?? 0;
    const hasReachedLimit = profile?.plan === 'trial' && usage >= TRIAL_LIMIT;

    useEffect(() => {
        // Inject Hotmart script dynamically to ensure it runs after React mounts
        const scriptId = 'hotmart-script';
        const linkId = 'hotmart-css';
    
        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script'); 
            script.id = scriptId;
            script.src = 'https://static.hotmart.com/checkout/widget.min.js'; 
            script.async = true;
            document.head.appendChild(script); 
        }
    
        if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet'; 
            link.type = 'text/css'; 
            link.href = 'https://static.hotmart.com/css/hotmart-fb.min.css'; 
            document.head.appendChild(link);
        }
    }, []);

    const fetchDashboardData = useCallback(async () => {
        // Não definir isLoading aqui para evitar piscar na tela com o realtime
        try {
            const [appointmentsRes, businessProfileRes] = await Promise.all([
                supabase.from('appointments')
                  .select('*')
                  .eq('user_id', user.id)
                  .order('date', { ascending: false })
                  .order('time', { ascending: false })
                  .range(0, APPOINTMENTS_PAGE_SIZE - 1),
                supabase.from('business_profiles').select('*').eq('user_id', user.id).single()
            ]);

            if (appointmentsRes.error) throw appointmentsRes.error;
            
            const fetchedAppointments = appointmentsRes.data || [];
            setAppointments(fetchedAppointments);
            setHasMore(fetchedAppointments.length === APPOINTMENTS_PAGE_SIZE);
            setCurrentPage(1);
            
            const defaultWorkingDays = { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false };
            const defaultStartTime = '09:00';
            const defaultEndTime = '17:00';
            
            if (businessProfileRes.data) {
                setBusinessProfile({
                    ...businessProfileRes.data,
                    blocked_dates: businessProfileRes.data.blocked_dates || [],
                    blocked_times: businessProfileRes.data.blocked_times || {},
                    working_days: businessProfileRes.data.working_days || defaultWorkingDays,
                    start_time: businessProfileRes.data.start_time || defaultStartTime,
                    end_time: businessProfileRes.data.end_time || defaultEndTime,
                    service_price: businessProfileRes.data.service_price || 0
                });
            } else {
                 setBusinessProfile({ user_id: user.id, blocked_dates: [], blocked_times: {}, working_days: defaultWorkingDays, start_time: defaultStartTime, end_time: defaultEndTime, service_price: 0 });
            }

        } catch (error: any) {
            console.error("Erro ao buscar dados do dashboard:", error);
            setError("Não foi possível carregar os dados.");
        } finally {
            setIsLoading(false); // Definir como falso apenas no final do fetch inicial
        }
    }, [user.id]);
    
    const handleLoadMore = async () => {
        if (isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
    
        const from = currentPage * APPOINTMENTS_PAGE_SIZE;
        const to = from + APPOINTMENTS_PAGE_SIZE - 1;
    
        try {
            const { data: newAppointments, error } = await supabase
                .from('appointments')
                .select('*')
                .eq('user_id', user.id)
                .order('date', { ascending: false })
                .order('time', { ascending: false })
                .range(from, to);
    
            if (error) throw error;
            
            const fetchedAppointments = newAppointments || [];
            setAppointments(prev => [...prev, ...fetchedAppointments]);
            setHasMore(fetchedAppointments.length === APPOINTMENTS_PAGE_SIZE);
            setCurrentPage(prev => prev + 1);
    
        } catch (error: any) {
            console.error("Erro ao carregar mais agendamentos:", error);
            setError("Não foi possível carregar mais agendamentos.");
        } finally {
            setIsLoadingMore(false);
        }
    };

    useEffect(() => {
        if (!user.id) return;
    
        // 1. Fetch inicial dos dados
        fetchDashboardData();
    
        // 2. Assinatura para mudanças diretas no banco de dados (updates, deletes)
        const dbChangesChannel = supabase
            .channel(`db-changes-for-${user.id}`)
            .on<Appointment>(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'appointments', filter: `user_id=eq.${user.id}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setAppointments(prev => {
                            if (prev.some(app => app.id === payload.new.id)) return prev;
                            return [payload.new, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.time.localeCompare(a.time));
                        });
                    }
                    if (payload.eventType === 'UPDATE') {
                        setAppointments(prev => prev.map(app => app.id === payload.new.id ? payload.new : app));
                    }
                    if (payload.eventType === 'DELETE') {
                         setAppointments(prev => prev.filter(app => app.id !== (payload.old as { id: string }).id));
                    }
                }
            )
            .subscribe();
    
        // 3. Assinatura para broadcasts de Edge Functions (novos agendamentos públicos)
        const broadcastChannel = supabase
            .channel(`dashboard-${user.id}`)
            .on('broadcast', { event: 'new_public_appointment' }, ({ payload }) => {
                const newAppointment = payload as Appointment;
                if (newAppointment) {
                    setAppointments(prev => {
                        if (prev.some(app => app.id === newAppointment.id)) return prev;
                        return [newAppointment, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.time.localeCompare(a.time));
                    });
                }
            })
            .subscribe();
    
        // 4. Função de limpeza
        return () => {
            supabase.removeChannel(dbChangesChannel);
            supabase.removeChannel(broadcastChannel);
        };
    }, [user.id, fetchDashboardData]);
    
    // Efeito para registrar para notificações push em plataformas nativas
    useEffect(() => {
        if (Capacitor.isNativePlatform() && user.id) {
            registerForPushNotifications(user.id);
        }
    }, [user.id]);
    
    const registerForPushNotifications = async (userId: string) => {
        try {
            let permStatus = await PushNotifications.checkPermissions();
    
            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }
    
            if (permStatus.receive !== 'granted') {
                console.log('Permissão para notificações não concedida.');
                return;
            }
    
            await PushNotifications.register();
    
            PushNotifications.addListener('registration', async (token) => {
                console.log('Push registration success, token:', token.value);
                // Utiliza a Edge Function para registrar o token,
                // garantindo que o token do dispositivo seja associado ao usuário logado no momento.
                const { error } = await supabase.functions.invoke('register-push-token', {
                    body: { token: token.value }
                });

                if (error) {
                    console.error('Erro ao registrar token de notificação via edge function:', error);
                }
            });
    
            PushNotifications.addListener('registrationError', (error) => {
                console.error('Erro no registro de push:', error);
            });
    
        } catch (error) {
            console.error("Erro ao configurar notificações push:", error);
        }
    };

    const filteredAppointments = useMemo(() => {
        return appointments
            .filter(app => statusFilter === 'Todos' || app.status === statusFilter)
            .filter(app =>
                app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (app.email && app.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (app.phone && app.phone.toLowerCase().includes(searchTerm.toLowerCase()))
            );
    }, [appointments, statusFilter, searchTerm]);

    const handleSaveAppointment = async (name: string, phone: string, email: string, date: string, time: string) => {
        if (!profile) return;
    
        const isDuplicate = appointments.some(
            app => app.date === date && app.time === time && app.status !== 'Cancelado'
        );
    
        if (isDuplicate) {
            alert('Aviso: Já existe um agendamento para esta data e horário. Por favor, escolha outro horário.');
            return; 
        }
        
        if (hasReachedLimit) {
            setIsUpgradeModalOpen(true);
            return;
        }

        const { data: newAppointment, error } = await supabase
            .from('appointments')
            .insert({ name, phone, email, date, time, user_id: user.id, status: 'Confirmado' }) // Agendamento manual já nasce confirmado? Ou pendente? Geralmente confirmado se o próprio dono cria.
            .select()
            .single();

        if (error) {
            console.error('Erro ao salvar:', error);
            throw error;
        } else {
            // Atualiza o estado local imediatamente para uma UI reativa.
            // O Realtime cuidará dos outros clientes, e a prevenção de duplicidade já foi adicionada.
            if (newAppointment) {
                setAppointments(prev => 
                    [newAppointment, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.time.localeCompare(a.time))
                );
            }
            // A atualização do perfil de uso ainda é necessária.
            if (profile.plan === 'trial') {
                const today = new Date().toISOString().split('T')[0];
                const newUsage = profile.last_usage_date === today ? profile.daily_usage + 1 : 1;
                const { data: updatedProfile, error: profileError } = await supabase
                    .from('profiles')
                    .update({ daily_usage: newUsage, last_usage_date: today })
                    .eq('id', user.id)
                    .select()
                    .single();
                if (profileError) {
                    console.error("Erro ao atualizar perfil:", profileError);
                } else if (updatedProfile) {
                    setProfile(updatedProfile);
                    if (updatedProfile.plan === 'trial' && updatedProfile.daily_usage >= TRIAL_LIMIT) {
                        setIsUpgradeModalOpen(true);
                    }
                }
            }
        }
    };
    
    const handleSendMessageToAssistant = async (message: string) => {
        const currentMessages = [...assistantMessages, { sender: 'user' as const, text: message }];
        setAssistantMessages(currentMessages);
        setIsAssistantLoading(true);
    
        try {
            const context = `
                - Dias de trabalho: ${JSON.stringify(businessProfile?.working_days)}
                - Horário de funcionamento: De ${businessProfile?.start_time} a ${businessProfile?.end_time}
                - Datas bloqueadas: ${JSON.stringify(businessProfile?.blocked_dates)}
                - Horários recorrentes bloqueados: ${JSON.stringify(businessProfile?.blocked_times)}
                - Agendamentos existentes (ocupados): ${JSON.stringify(appointments.filter(a => a.status !== 'Cancelado').map(a => ({ date: a.date, time: a.time })))}
            `;

            const { data, error } = await supabase.functions.invoke('deepseek-assistant', {
                body: {
                  messages: currentMessages.map(m => ({
                    role: m.sender === 'ai' ? 'assistant' : m.sender,
                    content: m.text
                  })),
                  context,
                  currentDate: new Date().toISOString(),
                },
            });

            if (error) throw error;
            
            const aiResponse = data.choices[0].message;
            
            if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
                const toolCall = aiResponse.tool_calls[0].function;
                if (toolCall.name === 'create_appointment') {
                    const args = JSON.parse(toolCall.arguments);
                    const { name, date, time, phone = '', email = '' } = args;

                    await handleSaveAppointment(name, phone, email, date, time);
                    setAssistantMessages(prev => [...prev, { sender: 'ai', text: `Agendamento para ${name} em ${parseDateAsUTC(date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} às ${time} foi criado com sucesso.` }]);
                }
            } else {
                 setAssistantMessages(prev => [...prev, { sender: 'ai', text: aiResponse.content }]);
            }
    
        } catch (error) {
            console.error("Erro do assistente de IA:", error);
            setAssistantMessages(prev => [...prev, { sender: 'ai', text: 'Desculpe, ocorreu um erro ao processar sua solicitação.' }]);
        } finally {
            setIsAssistantLoading(false);
        }
    };


    const handleUpdateStatus = async (id: string, status: Appointment['status']) => {
        // 1. Salva o estado original para um possível rollback.
        const originalAppointments = [...appointments];
    
        // 2. Aplica a atualização otimista na UI imediatamente.
        setAppointments(prev => 
            prev.map(app => app.id === id ? { ...app, status } : app)
        );
    
        // 3. Realiza a operação no banco de dados em segundo plano.
        const { error } = await supabase
            .from('appointments')
            .update({ status })
            .eq('id', id);
    
        // 4. Lida com erros e reverte a alteração se necessário.
        if (error) {
            console.error("Erro ao atualizar status, revertendo:", error);
            alert("Não foi possível atualizar o status. A alteração foi desfeita.");
            setAppointments(originalAppointments);
        }
        // Em caso de sucesso, não faz nada, pois a UI já está atualizada.
    };

    const handleDeleteAppointment = async (id: string) => {
        const isConfirmed = window.confirm('Tem certeza que deseja excluir este agendamento? Esta ação é permanente e não pode ser desfeita.');
        if (isConfirmed) {
            const { error } = await supabase
                .from('appointments')
                .delete()
                .eq('id', id);
    
            if (error) {
                console.error("Erro ao excluir agendamento:", error);
            } else {
                // Atualiza a UI imediatamente após o sucesso da exclusão.
                setAppointments(prev => prev.filter(app => app.id !== id));
            }
        }
    };
    
    const handleDownloadPDF = () => {
        if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
            console.error("jsPDF library not loaded.");
            alert("Não foi possível gerar o PDF. Por favor, recarregue a página e tente novamente.");
            return;
        }
    
        const { jsPDF } = jspdf;
        const doc = new jsPDF();
    
        doc.text("Relatório de Agendamentos", 14, 16);
    
        const tableColumn = ["Cliente", "Data", "Hora", "Status", "Contato"];
        const tableRows: (string | undefined)[][] = [];
    
        filteredAppointments.forEach(app => {
            const appointmentData = [
                app.name,
                parseDateAsUTC(app.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
                app.time,
                app.status,
                app.phone ? maskPhone(app.phone) : (app.email || 'N/A')
            ];
            tableRows.push(appointmentData);
        });
    
        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            theme: 'striped',
            headStyles: { fillColor: [28, 28, 30] },
        });
    
        doc.save("agendamentos.pdf");
    };

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
    
        if (error) {
            // Apenas registra o erro no console para depuração. Não exibe um alerta para o usuário
            // em casos comuns de falha de rede ou sessão já expirada.
            console.error("Error signing out:", error);
        }
    
        // Recarregar a página é uma maneira robusta de garantir que todo o estado do cliente seja limpo.
        // A lógica de inicialização aprimorada cuidará de qualquer sessão inválida que possa ter permanecido.
        window.location.reload();
    };

    const handleUpgrade = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const offerings = await Purchases.getOfferings();
          if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
            // Isso abre a interface nativa da Google Play Store
            const purchaseResult = await Purchases.purchasePackage({ aPackage: offerings.current.availablePackages[0] });
            const customerInfo = purchaseResult.customerInfo;

            // Verifica se a compra foi aprovada
            if (typeof customerInfo.entitlements.active['premium'] !== "undefined") {
              // Atualize o status no seu Supabase aqui
              const { data: updatedProfile, error: profileError } = await supabase
                .from('profiles')
                .update({ plan: 'premium' })
                .eq('id', user.id)
                .select()
                .single();
              if (updatedProfile) setProfile(updatedProfile);
              alert("Upgrade realizado com sucesso!");
            }
          }
        } else {
          window.open("https://pay.hotmart.com/U102480243K?checkoutMode=2", "_blank");
        }
      } catch (e: any) {
        if (!e.userCancelled) {
          alert("Erro ao processar compra: " + (e.message || e));
        }
      }
    };


    return (
      <div className="flex h-screen bg-black overflow-hidden">
        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
            <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
        )}
        {/* Sidebar */}
        <aside className={`fixed md:relative h-full w-64 glassmorphism p-6 flex flex-col z-40 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden absolute top-4 right-4 text-gray-400 hover:text-white z-50">
                <XIcon className="w-6 h-6" />
            </button>
            <div className="flex items-center space-x-2 mb-10">
                <CalendarIcon className="w-8 h-8 text-white"/>
                <h1 className="text-2xl font-bold text-white">Oubook</h1>
            </div>
            <nav className="flex-grow">
                <ul className="space-y-2">
                    <li><button onClick={() => {}} className="w-full flex items-center space-x-3 text-gray-300 bg-gray-700/50 p-3 rounded-lg"><CalendarIcon className="w-5 h-5"/><span>Agendamentos</span></button></li>
                    <li>
                        <div 
                            onClick={() => { if (hasReachedLimit) setIsUpgradeModalOpen(true); }}
                            className="w-full"
                        >
                            <button 
                                onClick={() => { if (!hasReachedLimit) setIsLinkModalOpen(true); }}
                                disabled={hasReachedLimit}
                                style={hasReachedLimit ? { pointerEvents: 'none' } : {}}
                                className="w-full flex items-center space-x-3 text-gray-300 hover:bg-gray-700/50 p-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <LinkIcon className="w-5 h-5"/><span>Links de Reserva</span>
                            </button>
                        </div>
                    </li>
                     <li>
                        <button 
                            onClick={() => setIsProfileModalOpen(true)} 
                            className="w-full flex items-center space-x-3 text-gray-300 hover:bg-gray-700/50 p-3 rounded-lg"
                        >
                            <SettingsIcon className="w-5 h-5"/><span>Configurações</span>
                        </button>
                    </li>
                </ul>
            </nav>
             <div className="border-t border-gray-700/50 pt-4">
                <div className="flex items-center space-x-3 mb-4">
                    <UserIcon className="w-10 h-10 p-2 bg-gray-700 rounded-full"/>
                    <div>
                        <p className="font-semibold text-white">{user.email?.split('@')[0]}</p>
                        <p className="text-sm text-gray-400">{user.email}</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="w-full flex items-center space-x-3 text-gray-300 hover:bg-red-500/20 hover:text-red-300 p-3 rounded-lg transition-colors">
                    <LogOutIcon className="w-5 h-5"/><span>Sair</span>
                </button>
             </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-screen overflow-y-auto scrollbar-hide">
          <header className="glassmorphism p-4 sm:p-6 border-b border-gray-800/50 flex flex-wrap justify-between items-center gap-4 sticky top-0 z-20">
             <div className="flex items-center gap-2">
                <button onClick={() => setIsMobileMenuOpen(true)} className="p-1 md:hidden text-gray-300">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Seus Agendamentos</h2>
             </div>
             <div className="flex flex-wrap items-center justify-center gap-2">
                {profile?.plan === 'premium' ? (
                    <div className="glassmorphism py-2 px-4 rounded-lg text-sm flex items-center space-x-2 bg-green-500/20 border border-green-400/30">
                        <StarIcon className="w-5 h-5 text-yellow-400" />
                        <span className="font-bold text-white">Plano Premium</span>
                    </div>
                ) : (
                    <div className="glassmorphism py-2 px-4 rounded-lg text-sm flex items-center space-x-3">
                        <span className="font-bold text-white">{`Plano Trial: ${usage}/${TRIAL_LIMIT} usos hoje`}</span>
                        <button
                            onClick={handleUpgrade}
                            className="hotmart-fb hotmart__button-checkout"
                        >
                            UPGRADE
                        </button>
                    </div>
                )}
                <button
                    onClick={handleDownloadPDF}
                    className="glassmorphism p-2 rounded-lg text-gray-300 hover:bg-gray-700/50 transition-colors"
                    aria-label="Baixar agendamentos em PDF"
                    title="Baixar agendamentos em PDF"
                >
                    <DownloadIcon className="w-5 h-5" />
                </button>
                 <button
                    onClick={() => setIsAssistantModalOpen(true)}
                    className="glassmorphism p-2 rounded-lg text-gray-300 hover:bg-gray-700/50 transition-colors"
                    aria-label="Abrir Assistente IA"
                    title="Abrir Assistente IA"
                >
                    <ChatBubbleIcon className="w-5 h-5" />
                </button>
                <div 
                  onClick={() => { if (hasReachedLimit) setIsUpgradeModalOpen(true); }}
                  className="inline-block"
                >
                    <button 
                        onClick={() => { if (!hasReachedLimit) setIsModalOpen(true); }}
                        disabled={hasReachedLimit}
                        style={hasReachedLimit ? { pointerEvents: 'none' } : {}}
                        className="bg-white text-black font-bold py-2 px-5 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <PlusIcon className="w-5 h-5"/>
                        <span className="hidden sm:inline">Novo Agendamento</span>
                    </button>
                </div>
             </div>
          </header>

          <div className="p-4 sm:p-6 flex-1">
             {/* Filtros e Busca */}
             <div className="mb-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex flex-wrap justify-center gap-1 glassmorphism p-1 rounded-lg">
                        {(['Todos', 'Pendente', 'Confirmado', 'Cancelado'] as const).map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${statusFilter === status ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                     <div className="relative w-full md:max-w-xs">
                         <input
                             type="text"
                             placeholder="Buscar por nome ou email..."
                             value={searchTerm}
                             onChange={e => setSearchTerm(e.target.value)}
                             className="w-full bg-black/20 border border-gray-700 rounded-lg p-3 pl-10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
                         />
                         <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                     </div>
                </div>
             </div>

             {/* Lista de Agendamentos */}
             {isLoading ? (
                <div className="flex justify-center items-center h-full"><LoaderIcon className="w-12 h-12"/></div>
             ) : error ? (
                <div className="text-center text-red-400">{error}</div>
             ) : filteredAppointments.length === 0 ? (
                <div className="text-center text-gray-500 py-16">
                    <CalendarIcon className="w-16 h-16 mx-auto mb-4"/>
                    <h3 className="text-xl font-semibold">Nenhum agendamento encontrado</h3>
                    <p>Crie um novo agendamento para começar.</p>
                </div>
             ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredAppointments.map(app => <AppointmentCard key={app.id} appointment={app} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteAppointment}/>)}
                </div>
             )}
             {!isLoading && hasMore && (
                <div className="mt-8 text-center">
                    <button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className="bg-gray-700/50 hover:bg-gray-600/50 text-white font-bold py-3 px-8 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center mx-auto"
                    >
                        {isLoadingMore ? <LoaderIcon className="w-6 h-6" /> : 'Carregar Mais'}
                    </button>
                </div>
            )}
          </div>
        </main>

        <NewAppointmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveAppointment} user={user} />
        <LinkGeneratorModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} userId={user.id} />
        <BusinessProfileModal isOpen={isProfileModalOpen} onClose={() => { setIsProfileModalOpen(false); fetchDashboardData(); }} userId={user.id} />
        <UpgradeModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} limit={TRIAL_LIMIT} onUpgrade={handleUpgrade} />
        <AssistantModal isOpen={isAssistantModalOpen} onClose={() => setIsAssistantModalOpen(false)} messages={assistantMessages} onSendMessage={handleSendMessageToAssistant} isLoading={isAssistantLoading} />
      </div>
    );
};


const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [path, setPath] = useState(window.location.pathname);

    useEffect(() => {
      const setupPurchases = async () => {
        if (Capacitor.isNativePlatform()) {
          try {
            // Configure com a sua Chave Pública do RevenueCat vinda do env
            await Purchases.configure({ apiKey: import.meta.env.VITE_REVENUECAT_ANDROID_KEY || 'goog_tXGzFUmdhKasrUrygDIgLxOVTPs' });
            console.log("RevenueCat pronto!");
          } catch (e) {
            console.error("Erro ao configurar RevenueCat", e);
          }
        }
      };
      setupPurchases();
    }, []);

    useEffect(() => {
        // Verifica se há retorno do Mercado Pago na URL (Web)
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state'); // UserId

        if (code && state) {
            const connectMercadoPago = async () => {
                setIsLoading(true);
                try {
                    const { data, error } = await supabase.functions.invoke('mercadopago-connect', {
                        body: { code, state }
                    });

                    if (error) throw error;
                    
                    if (data?.success) {
                        alert('Conta do Mercado Pago conectada com sucesso!');
                        // Remove os parâmetros da URL para limpar
                        window.history.replaceState({}, document.title, window.location.pathname);
                        // Recarrega a página para atualizar o estado do perfil
                        window.location.reload();
                    } else {
                         throw new Error(data?.error || 'Erro desconhecido');
                    }
                } catch (err: any) {
                    console.error('Erro ao processar callback do Mercado Pago:', err);
                    alert(`Erro ao conectar: ${err.message}`);
                } finally {
                    setIsLoading(false);
                }
            };

            connectMercadoPago();
        }
    }, []);
    
    useEffect(() => {
        // Handle native OAuth callback
        CapacitorApp.addListener('appUrlOpen', async (event) => {
            const url = new URL(event.url);
            
            // Check if it's the correct callback URL
            if (`${url.protocol}//${url.hostname}` !== 'com.oubook.app://auth-callback') {
                return;
            }

            const hash = url.hash.substring(1); // Remove '#'
            const params = new URLSearchParams(hash);

            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken && refreshToken) {
                const { error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });

                if (error) {
                    console.error('Erro ao definir a sessão do Supabase:', error);
                }
                
                // Always close the browser after attempting to set session
                await Browser.close();
                // onAuthStateChange will handle the UI update
            } else {
                 await Browser.close();
            }
        });
        
        Browser.addListener('browserFinished', () => {
            console.log('Browser fechado pelo usuário.');
        });
    }, []);

    useEffect(() => {
        const syncUserAndProfile = async () => {
            setIsLoading(true);
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) throw sessionError;
                if (!session) {
                    // No session, user is logged out.
                    setUser(null);
                    setProfile(null);
                    return;
                }
                const currentUser = session.user;
        
                // Step 1: Fetch profile. This is the main validation point.
                // If this fails (e.g., with a 406 error), the session is considered invalid.
                let { data: userProfile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', currentUser.id)
                    .single();
                
                // Step 2: Handle new user creation (PGRST116 is Supabase code for "exact one row not found")
                if (profileError && profileError.code === 'PGRST116') { 
                    const { data: { user: authUser } } = await supabase.auth.getUser();
                    const { data: newProfile, error: insertError } = await supabase
                        .from('profiles')
                        .insert({ 
                            id: currentUser.id, 
                            terms_accepted_at: new Date().toISOString() 
                        })
                        .select()
                        .single();
        
                    if (insertError) throw insertError; // Throw to main catch block
                    userProfile = newProfile;
                } else if (profileError) {
                    throw profileError; // Throw any other profile fetch error to the catch block
                }
        
                if (!userProfile) { // Safeguard
                    throw new Error("User profile not found or could not be created.");
                }
        
                // Step 3: Check for premium expiration
                const isPremium = userProfile.plan === 'premium';
                const premiumExpired = isPremium && userProfile.premium_expires_at && new Date(userProfile.premium_expires_at) < new Date();
        
                if (premiumExpired) {
                    const { data: revertedProfile } = await supabase
                        .from('profiles')
                        .update({ plan: 'trial', premium_expires_at: null })
                        .eq('id', currentUser.id)
                        .select()
                        .single();
                    if (revertedProfile) userProfile = revertedProfile;
                }
        
                // Step 4: Check for daily usage reset for trial users
                const today = new Date().toISOString().split('T')[0];
                if (userProfile.plan === 'trial' && userProfile.last_usage_date !== today) {
                    const { data: updatedProfile } = await supabase
                        .from('profiles')
                        .update({ daily_usage: 0, last_usage_date: today })
                        .eq('id', currentUser.id)
                        .select()
                        .single();
                    if (updatedProfile) userProfile = updatedProfile;
                }
                
                // Step 5: If all checks pass, set the user and profile state to logged-in
                setUser({ id: currentUser.id, email: currentUser.email });
                setProfile(userProfile);

                // Initialize RevenueCat with UID
                if (Capacitor.isNativePlatform()) {
                    await Purchases.configure({ 
                        apiKey: import.meta.env.VITE_REVENUECAT_ANDROID_KEY,
                        appUserID: currentUser.id 
                    });
                }

            } catch (error) {
                // If any step fails, the session is invalid. Clear user state to force logout.
                console.error("Failed to sync user profile; session is likely invalid.", error);
                setUser(null);
                setProfile(null);
            } finally {
                setIsLoading(false);
            }
        };
      
        // Initial check when the component mounts.
        syncUserAndProfile();

        const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
            // Re-sync profile on sign-in event.
            if (event === 'SIGNED_IN') {
                syncUserAndProfile();
                if (localStorage.getItem('termsAccepted') !== 'true') {
                    localStorage.setItem('termsAccepted', 'true');
                }
            }
            // Clear state on sign-out event.
            if (event === 'SIGNED_OUT') {
                setUser(null);
                setProfile(null);
            }
        });
      
        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const router = useMemo(() => {
        const pathParts = path.split('/').filter(Boolean);
        if (pathParts[0] === 'book-link' && pathParts[1]) {
            return <PaginaDeAgendamento tokenId={pathParts[1]} />;
        }
        if (user && profile) {
            return <Dashboard user={user} profile={profile} setProfile={setProfile} />;
        }
        if(!user && !isLoading) {
             return <LoginPage />;
        }
        return null; // Return null or a loader while loading
    }, [path, user, profile, isLoading]);

    if (isLoading) {
        return (
             <div className="min-h-screen bg-black flex justify-center items-center">
                 <LoaderIcon className="w-16 h-16 text-white"/>
             </div>
        );
    }
    
    return router;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
