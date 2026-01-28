
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PRODUCTION_URL = import.meta.env.VITE_PRODUCTION_URL;
// CHAVE PÚBLICA VAPID (Substitua pela sua chave gerada)
const VAPID_PUBLIC_KEY = "BDbq4AnZv5ScaZcr1O7Z2XAo98SQHyH1kTHsfs02mBJr10mhncOyWx8BR1eUxG7mBuDzseIcR2cKYgw_3xLQ2Z8"; 

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !PRODUCTION_URL) {
  const missingVars = [
    !SUPABASE_URL && "VITE_SUPABASE_URL",
    !SUPABASE_ANON_KEY && "VITE_SUPABASE_ANON_KEY",
    !PRODUCTION_URL && "VITE_PRODUCTION_URL"
  ].filter(Boolean).join(', ');
  throw new Error(`Variáveis de ambiente ausentes: ${missingVars}. Por favor, configure-as no seu arquivo .env ou nas configurações do seu provedor de hospedagem.`);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Helpers para Web Push ---
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
const CopyIcon = (props: any) => <Icon {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1-2-2h9a2 2 0 0 1 2 2v1"></path></Icon>;
const AlertCircleIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></Icon>;
const LoaderIcon = (props: any) => <Icon {...props} className="animate-spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></Icon>;
const XIcon = (props: any) => <Icon {...props}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></Icon>;
const SettingsIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1-2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></Icon>;
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
        const encodedRedirect = encodeURIComponent(redirectUri || '');
        const state = userId;
        const mpAuthUrl = `https://auth.mercadopago.com.br/authorization?client_id=${clientId || ''}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodedRedirect}`;
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
            alert("Erro ao desconectar.");
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
                                    setProfile(p => ({ ...p, service_price: val as any }));
                                }}
                                className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 pl-10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
                            />
                         </div>
                         <p className="text-xs text-gray-500 mt-1">Deixe 0 ou vazio para agendamento gratuito.</p>
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
                                        className="h-5 w-5 accent-gray-400 bg-gray-800 border-gray-600 rounded focus:ring-gray-500"
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
                    <p>Você concorda em usar a plataforma apenas para fins legítimos de agendamento de serviços.</p>
                </div>
                <div>
                    <h4 className="font-semibold text-white">3. Privacidade e Dados</h4>
                    <p>Seus dados de agendamento são armazenados com segurança.</p>
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
    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
                    <button type="submit" disabled={isLoading || !input.trim()} className="p-3 bg-gray-600 rounded-lg text-white hover:bg-gray-500 transition-colors">
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
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
    const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null);
    const dayMap = useMemo(() => ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], []);

    useEffect(() => {
        if (bookingCompleted) localStorage.setItem(`booking_success_${tokenId}`, 'true');
    }, [bookingCompleted, tokenId]);

    useEffect(() => {
        const validateLinkAndFetchData = async () => {
            if (localStorage.getItem(`booking_success_${tokenId}`) === 'true') {
                setBookingCompleted(true);
                setLinkStatus('valid');
                return;
            }
            try {
                setLinkStatus('loading');
                const { data: linkData, error: linkError = null } = await supabase.from('one_time_links').select('user_id, is_used, appointment_id').eq('id', tokenId).single();
                if (linkError || !linkData) { setLinkStatus('invalid'); return; }
                if (linkData.is_used) {
                    if (linkData.appointment_id) {
                        const { data: appt = null } = await supabase.from('appointments').select('*').eq('id', linkData.appointment_id).single();
                        if (appt && appt.status === 'Confirmado') { setBookingCompleted(true); setLinkStatus('valid'); return; }
                        if (appt && appt.status === 'Aguardando Pagamento') {
                            setAdminId(linkData.user_id); setPendingAppointmentId(appt.id); setName(appt.name); setPhone(appt.phone || ''); setEmail(appt.email || '');
                            const [year, month, day] = appt.date.split('-');
                            setSelectedDate(new Date(Date.UTC(Number(year), Number(month)-1, Number(day)))); setSelectedTime(appt.time);
                             const { data: existingPayment = null } = await supabase.from('payments').select('*').eq('appointment_id', appt.id).single();
                            if (existingPayment) {
                                try {
                                    const { data: qrData } = await supabase.functions.invoke('create-payment', { body: { action: 'retrieve', paymentId: (existingPayment as any).mp_payment_id, professionalId: linkData.user_id } });
                                    if (qrData && !qrData.error) setPaymentData(qrData);
                                } catch (e) {}
                            }
                        } else { setLinkStatus('used'); return; }
                    } else { setLinkStatus('used'); return; }
                }
                const currentAdminId = linkData.user_id; setAdminId(currentAdminId);
                const [profileRes, businessProfileRes, appointmentsRes] = await Promise.all([
                    supabase.from('profiles').select('*').eq('id', currentAdminId).single(),
                    supabase.from('business_profiles').select('*').eq('user_id', currentAdminId).single(),
                    supabase.from('appointments').select('date, time').eq('user_id', currentAdminId).in('status', ['Pendente', 'Confirmado'])
                ]);
                if (profileRes.error) throw profileRes.error;
                setAdminProfile(profileRes.data); setAppointments(appointmentsRes.data || []);
                const defaultWorkingDays = { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false };
                setBusinessProfile(businessProfileRes.data ? { ...businessProfileRes.data, working_days: businessProfileRes.data.working_days || defaultWorkingDays } : { user_id: currentAdminId, blocked_dates: [], blocked_times: {}, working_days: defaultWorkingDays, start_time: '09:00', end_time: '17:00', service_price: 0 });
                setLinkStatus('valid');
            } catch (error) { setLinkStatus('invalid'); }
        };
        validateLinkAndFetchData();
    }, [tokenId]);
    
    useEffect(() => {
        if (!pendingAppointmentId) return;
        const channel = supabase.channel(`public-appt-${pendingAppointmentId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `id=eq.${pendingAppointmentId}` }, (payload) => { if (payload.new.status === 'Confirmado') { setPaymentModalOpen(false); setBookingCompleted(true); } }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [pendingAppointmentId]);

    useEffect(() => {
        let intervalId: any;
        if (paymentData?.id && pendingAppointmentId && !bookingCompleted) {
            const checkStatus = async () => {
                try {
                    const { data } = await supabase.functions.invoke('mp-webhook', { body: { id: paymentData.id.toString(), action: 'payment.updated' } });
                    if (data && data.status === 'approved') { setPaymentModalOpen(false); setBookingCompleted(true); }
                } catch (e) {}
            };
            intervalId = setInterval(checkStatus, 4000);
        }
        return () => { if (intervalId) clearInterval(intervalId); };
    }, [paymentData, pendingAppointmentId, bookingCompleted]);

    const handleManualVerification = async (paymentId: number) => {
        try {
            const { data } = await supabase.functions.invoke('mp-webhook', { body: { id: paymentId.toString(), action: 'payment.updated' } });
            if (data && data.status === 'approved') { setPaymentModalOpen(false); setBookingCompleted(true); } else alert('Ainda não confirmado.');
        } catch (err) { alert('Erro na verificação.'); }
    };

    const isDayAvailable = useCallback((date: Date): boolean => {
        if (!businessProfile) return false;
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
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
        const [startHour] = (businessProfile.start_time || '09:00').split(':').map(Number);
        const [endHour] = (businessProfile.end_time || '17:00').split(':').map(Number);
        for (let hour = startHour; hour < endHour; hour++) slots.push(`${String(hour).padStart(2, '0')}:00`);
        const dateString = selectedDate.toISOString().split('T')[0];
        const dayOfWeek = dayMap[selectedDate.getUTCDay()];
        const bookedTimes = appointments.filter(a => a.date === dateString).map(a => a.time);
        const blockedRecurringTimes = businessProfile.blocked_times[dayOfWeek] || [];
        const now = new Date();
        const currentHour = now.getHours();
        const localTodayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        return slots.filter(slot => {
            const [slotHour] = slot.split(':').map(Number);
            const isPastTimeToday = (dateString === localTodayString) && (slotHour <= currentHour);
            return !isPastTimeToday && !bookedTimes.includes(slot) && !blockedRecurringTimes.includes(slot);
        });
    }, [selectedDate, businessProfile, appointments, dayMap]);
    
    const handlePayment = async (appointmentId: string, amount: number) => {
        try {
            const { data, error = null } = await supabase.functions.invoke('create-payment', { body: { amount, description: `Agendamento ${name}`, professionalId: adminId, appointmentId, payerEmail: email || 'cliente@oubook.com' } });
            if (error || (data && data.error)) throw new Error('Erro ao gerar Pix');
            setPaymentData(data); setPaymentModalOpen(true);
        } catch (err) { setMessage({ type: 'error', text: "Erro ao gerar Pix." }); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pendingAppointmentId && adminId && businessProfile?.service_price) {
             if (paymentData) setPaymentModalOpen(true); else { setIsSaving(true); await handlePayment(pendingAppointmentId, businessProfile.service_price); setIsSaving(false); }
             return;
        }
        if (!selectedDate || !selectedTime || !adminId) return;
        setMessage(null);
        const unmaskedPhone = phone.replace(/\D/g, '');
        if (unmaskedPhone.length < 10) { setMessage({ type: 'error', text: 'Telefone inválido.' }); return; }
        setIsSaving(true);
        try {
            const { data, error = null } = await supabase.functions.invoke('book-appointment-public', { body: { tokenId, name, phone: unmaskedPhone, email, date: selectedDate.toISOString().split('T')[0], time: selectedTime } });
            if (error) throw new Error('Erro ao salvar.');
            const { appointment: newAppt } = data; setPendingAppointmentId(newAppt.id);
            if (newAppt.status === 'Confirmado') setBookingCompleted(true);
            else if (businessProfile?.service_price) await handlePayment(newAppt.id, businessProfile.service_price);
        } catch (err: any) { setMessage({ type: 'error', text: err.message }); } finally { setIsSaving(false); }
    };

    const Calendar = () => {
        const year = currentMonth.getFullYear(); const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = Array.from({ length: firstDay }, (_, i) => <div key={`empty-${i}`}></div>);
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(Date.UTC(year, month, day)); const isAvailable = isDayAvailable(date);
            const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
            days.push(<button key={day} onClick={() => { setSelectedDate(date); setSelectedTime(null); }} disabled={!isAvailable} className={`w-10 h-10 flex items-center justify-center rounded-full text-sm ${isAvailable ? (isSelected ? "bg-gray-200 text-black font-bold" : "bg-black/20 text-white hover:bg-gray-700") : "text-gray-600 cursor-not-allowed"}`}>{day}</button>);
        }
        return (
            <div className="bg-black/20 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-2"><ChevronLeftIcon className="w-5 h-5 text-white"/></button>
                    <h3 className="font-bold text-white">{currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
                    <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-2"><ChevronRightIcon className="w-5 h-5 text-white"/></button>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-xs text-gray-400 mb-2">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}</div>
                <div className="grid grid-cols-7 gap-2">{days}</div>
            </div>
        );
    };
    
    if (bookingCompleted) return <div className="min-h-screen bg-black flex justify-center items-center text-center p-4"><div className="glassmorphism rounded-2xl p-8"><CheckCircleIcon className="w-16 h-16 text-green-400 mx-auto mb-4" /><h1 className="text-2xl font-bold text-white">Concluído</h1></div></div>;
    if (linkStatus === 'loading') return <div className="min-h-screen bg-black flex justify-center items-center"><LoaderIcon className="w-12 h-12 text-white" /></div>;
    if (linkStatus === 'invalid' || linkStatus === 'used') return <div className="min-h-screen bg-black flex justify-center items-center text-center p-4"><div className="glassmorphism rounded-2xl p-8"><AlertCircleIcon className="w-16 h-16 text-yellow-400 mx-auto mb-4" /><h1 className="text-2xl font-bold text-white">{linkStatus === 'used' ? 'Link Utilizado' : 'Link Inválido'}</h1></div></div>;

    return (
        <div className="min-h-screen bg-black p-4"><div className="flex flex-col justify-center items-center"><div className="w-full max-w-md py-8"><div className="glassmorphism rounded-2xl p-6">
            <h1 className="text-2xl font-bold text-white mb-2">Agendar Horário</h1>
            {message && <div className={`p-4 rounded-lg mb-4 ${message.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{message.text}</div>}
            <form onSubmit={handleSubmit} className="space-y-6">
                <input type="text" placeholder="Seu Nome" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" />
                <input type="tel" placeholder="Telefone" value={phone} onChange={e => setPhone(maskPhone(e.target.value))} required maxLength={15} className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" />
                <Calendar />
                {selectedDate && availableTimeSlots.length > 0 && <div className="grid grid-cols-3 gap-3">{availableTimeSlots.map(time => <button key={time} type="button" onClick={() => setSelectedTime(time)} className={`p-2 rounded-lg text-sm ${selectedTime === time ? 'bg-gray-200 text-black font-bold' : 'bg-black/20 text-white hover:bg-gray-700'}`}>{time}</button>)}</div>}
                <button type="submit" disabled={isSaving || !selectedDate || !selectedTime || !name || !phone} className="w-full bg-gray-200 text-black font-bold py-3 rounded-lg">{isSaving ? <LoaderIcon className="w-6 h-6 mx-auto" /> : 'Confirmar'}</button>
            </form>
        </div></div></div>
        {paymentData && pendingAppointmentId && <PaymentModal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} paymentData={paymentData} appointmentId={pendingAppointmentId} onManualCheck={handleManualVerification} />}
        </div>
    );
};


const LoginPage = () => {
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    useEffect(() => { if (localStorage.getItem('termsAccepted') === 'true') setTermsAccepted(true); }, []);
    const handleLogin = async () => {
        if (!termsAccepted) { alert("Aceite os Termos."); return; }
        const redirectTo = Capacitor.isNativePlatform() ? 'com.oubook.app://auth-callback' : window.location.origin;
        const { data, error = null } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: Capacitor.isNativePlatform() } });
        if (data?.url && Capacitor.isNativePlatform()) await Browser.open({ url: data.url, windowName: '_self' });
    };
    return (
        <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4">
             <CalendarIcon className="w-16 h-16 text-white mb-4" /><h1 className="text-4xl font-bold text-white mb-8">Oubook</h1>
             <div className="my-6"><label className="flex items-center space-x-2"><input type="checkbox" checked={termsAccepted} onChange={() => setTermsAccepted(!termsAccepted)} /><span>Aceito os <button onClick={() => setIsTermsModalOpen(true)} className="underline">Termos</button></span></label></div>
             <button onClick={handleLogin} disabled={!termsAccepted} className="w-full bg-white text-black font-bold py-3 rounded-lg text-lg flex items-center justify-center space-x-3"><span>Entrar com Google</span></button>
             <TermsModal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} />
        </div>
    );
};

const Dashboard = ({ user, profile, setProfile }: { user: User, profile: Profile | null, setProfile: React.Dispatch<React.SetStateAction<Profile | null>>}) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
    const [statusFilter, setStatusFilter] = useState<'Pendente' | 'Confirmado' | 'Cancelado' | 'Todos'>('Todos');
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
    const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([{ sender: 'ai', text: 'Como posso ajudar?' }]);
    const [isAssistantLoading, setIsAssistantLoading] = useState(false);
    const [isAssistantModalOpen, setIsAssistantModalOpen] = useState(false);

    const TRIAL_LIMIT = 5;
    const usage = profile?.daily_usage ?? 0;
    const hasReachedLimit = profile?.plan === 'trial' && usage >= TRIAL_LIMIT;

    useEffect(() => {
        fetchDashboardData();
        const dbChanges = supabase.channel(`db-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData()).subscribe();
        const broadcast = supabase.channel(`dash-${user.id}`).on('broadcast', { event: 'new_public_appointment' }, () => fetchDashboardData()).subscribe();
        return () => { supabase.removeChannel(dbChanges); supabase.removeChannel(broadcast); };
    }, [user.id]);
    
    useEffect(() => {
        if (user.id) registerForPushNotifications(user.id);
    }, [user.id]);
    
    // --- LÓGICA DE NOTIFICAÇÃO PUSH (BROWSER + MOBILE) ---
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
            } else if ("serviceWorker" in navigator) {
                // Registro nativo no Browser (Web Push)
                const registration = await navigator.serviceWorker.ready;
                let subscription = await registration.pushManager.getSubscription();
                
                if (!subscription) {
                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                    });
                }
                
                // Salva a assinatura JSON no banco como se fosse o token
                await supabase.functions.invoke('register-push-token', { 
                    body: { token: JSON.stringify(subscription) } 
                });
            }
        } catch (error) { console.error("Erro push:", error); }
    };

    const fetchDashboardData = async () => {
        setIsLoading(true);
        const { data } = await supabase.from('appointments').select('*').eq('user_id', user.id).order('date', { ascending: false }).range(0, 20);
        setAppointments(data || []); setIsLoading(false);
    };

    const handleSaveAppointment = async (name: string, phone: string, email: string, date: string, time: string) => {
        if (hasReachedLimit) { setIsUpgradeModalOpen(true); return; }
        await supabase.from('appointments').insert({ name, phone, email, date, time, user_id: user.id, status: 'Confirmado' });
        fetchDashboardData();
    };

    const filteredAppointments = appointments.filter(app => (statusFilter === 'Todos' || app.status === statusFilter) && app.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
      <div className="flex h-[100dvh] bg-black overflow-hidden">
        <aside className={`fixed md:relative h-full w-64 glassmorphism p-6 flex flex-col z-40 transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <h1 className="text-2xl font-bold text-white mb-10">Oubook</h1>
            <nav className="flex-grow space-y-2">
                <button className="w-full flex items-center space-x-3 p-3 bg-gray-700/50 rounded-lg"><CalendarIcon /><span>Agendamentos</span></button>
                <button onClick={() => setIsLinkModalOpen(true)} className="w-full flex items-center space-x-3 p-3 rounded-lg"><LinkIcon /><span>Links</span></button>
                <button onClick={() => setIsProfileModalOpen(true)} className="w-full flex items-center space-x-3 p-3 rounded-lg"><SettingsIcon /><span>Configurações</span></button>
            </nav>
            <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center space-x-3 p-3 rounded-lg text-red-400"><LogOutIcon /><span>Sair</span></button>
        </aside>
        <main className="flex-1 overflow-y-auto">
          <header className="glassmorphism p-6 flex justify-between items-center sticky top-0 z-20">
             <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden"><MenuIcon /></button>
             <h2 className="text-2xl font-bold">Dashboard</h2>
             <button onClick={() => setIsModalOpen(true)} className="bg-white text-black font-bold py-2 px-5 rounded-lg">Novo</button>
          </header>
          <div className="p-6">
             <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredAppointments.map(app => <AppointmentCard key={app.id} appointment={app} onUpdateStatus={async () => {}} onDelete={async () => {}}/>)}
             </div>
          </div>
        </main>
        <NewAppointmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveAppointment} user={user} />
        <LinkGeneratorModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} userId={user.id} />
        <BusinessProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} userId={user.id} />
      </div>
    );
};


const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setUser({ id: session.user.id, email: session.user.email });
                supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => setProfile(data));
            }
            setIsLoading(false);
        });
        supabase.auth.onAuthStateChange((_event, session) => {
            if (session) setUser({ id: session.user.id, email: session.user.email });
            else { setUser(null); setProfile(null); }
        });
    }, []);

    if (isLoading) return <div className="min-h-screen bg-black flex justify-center items-center"><LoaderIcon className="w-16 h-16 text-white"/></div>;
    const path = window.location.pathname;
    if (path.startsWith('/book-link/')) return <PaginaDeAgendamento tokenId={path.split('/')[2]} />;
    return user ? <Dashboard user={user} profile={profile} setProfile={setProfile} /> : <LoginPage />;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
