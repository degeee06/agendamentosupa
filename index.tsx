import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { PushNotifications } from '@capacitor/push-notifications';

declare let jspdf: any;

// --- Configuração de Ambiente ---
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PRODUCTION_URL = import.meta.env.VITE_PRODUCTION_URL;
const MP_CLIENT_ID = import.meta.env.VITE_MP_CLIENT_ID;
const MP_REDIRECT_URL = import.meta.env.VITE_MP_REDIRECT_URL;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !PRODUCTION_URL) {
  console.error("Variáveis de ambiente críticas ausentes.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Tipos ---
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
const PlusIcon = (props: any) => <Icon {...props}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></Icon>;
const CopyIcon = (props: any) => <Icon {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></Icon>;
const LoaderIcon = (props: any) => <Icon {...props} className="animate-spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></Icon>;
const XIcon = (props: any) => <Icon {...props}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></Icon>;
const SettingsIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></Icon>;
const LinkIcon = (props: any) => <Icon {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></Icon>;
const WalletIcon = (props: any) => <Icon {...props}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></Icon>;
const LogOutIcon = (props: any) => <Icon {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></Icon>;

// --- Componentes ---
const StatusBadge = ({ status }: { status: Appointment['status'] }) => {
  const baseClasses = "px-3 py-1 text-xs font-medium rounded-full text-white";
  const statusClasses = {
    Pendente: "bg-yellow-500/20 text-yellow-300",
    Confirmado: "bg-green-500/20 text-green-300",
    Cancelado: "bg-red-500/20 text-red-300",
    'Aguardando Pagamento': "bg-orange-500/20 text-orange-300"
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
              {appointment.status === 'Pendente' || appointment.status === 'Aguardando Pagamento' ? (
                <button
                    onClick={() => onUpdateStatus(appointment.id, 'Confirmado')}
                    className="w-full flex justify-center items-center space-x-2 bg-green-500/20 hover:bg-green-500/40 text-green-300 font-semibold py-2 px-4 rounded-lg transition-colors duration-300"
                >
                    <CheckCircleIcon className="w-4 h-4" />
                    <span>Confirmar</span>
                </button>
              ) : null}
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
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className={`glassmorphism w-full ${sizeClasses[size]} rounded-2xl p-6 border border-gray-700 relative`} onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white"><XIcon className="w-6 h-6" /></button>
                <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>
                {children}
            </div>
        </div>
    );
};

const PaymentModal = ({ isOpen, onClose, qrCodeBase64, copyPaste, status }: { isOpen: boolean, onClose: () => void, qrCodeBase64?: string, copyPaste?: string, status: string }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        if (copyPaste) {
            navigator.clipboard.writeText(copyPaste);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Pagamento Pix">
            <div className="flex flex-col items-center space-y-6">
                {status === 'approved' || status === 'Confirmado' ? (
                    <div className="text-center">
                        <CheckCircleIcon className="w-20 h-20 text-green-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white">Pagamento Confirmado!</h3>
                        <p className="text-gray-400">Seu agendamento foi realizado com sucesso.</p>
                    </div>
                ) : (
                    <>
                        <p className="text-gray-300 text-center">Escaneie o QR Code ou copie o código Pix.</p>
                        {qrCodeBase64 ? <img src={`data:image/png;base64,${qrCodeBase64}`} className="w-48 h-48 rounded-lg border-4 border-white" /> : <div className="w-48 h-48 bg-gray-700 rounded-lg animate-pulse"></div>}
                        {copyPaste && (
                            <div className="w-full flex items-center space-x-2 bg-black/30 p-3 rounded-lg border border-gray-600">
                                <input type="text" value={copyPaste} readOnly className="bg-transparent text-white w-full outline-none text-xs truncate" />
                                <button onClick={handleCopy} className="bg-gray-600 text-white px-3 py-1 rounded text-sm">{copied ? 'Copiado!' : 'Copiar'}</button>
                            </div>
                        )}
                        <div className="flex items-center space-x-2 text-sm text-yellow-400 bg-yellow-500/10 p-3 rounded-lg w-full">
                            <LoaderIcon className="w-4 h-4" /> <span>Aguardando confirmação do pagamento...</span>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

const LinkGeneratorModal = ({ isOpen, onClose, userId }: { isOpen: boolean; onClose: () => void; userId: string }) => {
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => { if (!isOpen) { setGeneratedLink(null); setCopied(false); } }, [isOpen]);

    const handleGenerateLink = async () => {
        setIsGenerating(true); setCopied(false);
        try {
            const { data, error } = await supabase.from('one_time_links').insert({ user_id: userId }).select('id').single();
            if (error || !data) throw error;
            setGeneratedLink(`${PRODUCTION_URL}/book-link/${data.id}`);
        } catch (err) { alert("Erro ao gerar link."); } finally { setIsGenerating(false); }
    };

    const handleCopy = () => {
        if (generatedLink) { navigator.clipboard.writeText(generatedLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerar Link de Agendamento">
            <div className="space-y-6">
                <p className="text-gray-300">Gere um link único para enviar ao seu cliente.</p>
                <button onClick={handleGenerateLink} disabled={isGenerating} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2">
                    {isGenerating ? <LoaderIcon className="w-5 h-5" /> : <><LinkIcon className="w-5 h-5" /><span>Gerar Novo Link</span></>}
                </button>
                {generatedLink && (
                    <div className="bg-black/30 p-4 rounded-lg border border-gray-600 flex flex-col space-y-2">
                        <span className="text-sm text-gray-400">Link gerado:</span>
                        <div className="flex items-center gap-2">
                            <input type="text" value={generatedLink} readOnly className="bg-transparent text-white w-full outline-none text-sm font-mono" />
                            <button onClick={handleCopy} className="text-gray-400 hover:text-white p-2"><CopyIcon className="w-5 h-5" /></button>
                        </div>
                        {copied && <span className="text-green-400 text-xs">Link copiado!</span>}
                    </div>
                )}
            </div>
        </Modal>
    );
};

const SettingsModal = ({ isOpen, onClose, profile, businessProfile, onSaveBusinessProfile }: any) => {
    const [servicePrice, setServicePrice] = useState(businessProfile?.service_price || 0);
    const [isConnected, setIsConnected] = useState(false);
    const [checkingConnection, setCheckingConnection] = useState(true);

    useEffect(() => {
        if (isOpen && profile) {
            checkConnection();
        }
    }, [isOpen, profile]);

    const checkConnection = async () => {
        setCheckingConnection(true);
        const { data } = await supabase.from('mp_connections').select('mp_user_id').eq('user_id', profile.user_id).single();
        setIsConnected(!!data);
        setCheckingConnection(false);
    };

    const handleConnectMP = () => {
        // Log para debug
        console.log("Tentando conectar MP...");
        console.log("Client ID:", MP_CLIENT_ID);
        console.log("Redirect URL:", MP_REDIRECT_URL);

        if (!MP_CLIENT_ID || !MP_REDIRECT_URL) {
            alert(`ERRO: Variáveis não configuradas.\n\nCLIENT_ID: ${MP_CLIENT_ID || 'VAZIO'}\nREDIRECT_URL: ${MP_REDIRECT_URL || 'VAZIO'}\n\nVerifique o Vercel e faça um Redeploy.`);
            return;
        }

        const state = profile.user_id;
        const authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${MP_CLIENT_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(MP_REDIRECT_URL)}`;
        
        console.log("Redirecionando para:", authUrl);
        window.location.href = authUrl;
    };

    const handleSave = () => {
        onSaveBusinessProfile({ ...businessProfile, service_price: parseFloat(servicePrice) });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Configurações">
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Preço do Serviço (R$)</label>
                    <input type="number" value={servicePrice} onChange={e => setServicePrice(e.target.value)} className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" placeholder="0.00" />
                </div>

                <div className="border-t border-gray-700 pt-4">
                    <h3 className="text-lg font-bold text-white mb-2">Pagamentos</h3>
                    <p className="text-sm text-gray-400 mb-4">Conecte sua conta do Mercado Pago para receber via Pix automaticamente.</p>
                    
                    {checkingConnection ? (
                        <div className="flex items-center text-gray-400"><LoaderIcon className="w-4 h-4 mr-2" /> Verificando conexão...</div>
                    ) : isConnected ? (
                        <div className="flex items-center text-green-400 bg-green-500/10 p-3 rounded-lg border border-green-500/30">
                            <CheckCircleIcon className="w-5 h-5 mr-2" /> Conta Mercado Pago Conectada
                        </div>
                    ) : (
                        <button 
                            onClick={handleConnectMP}
                            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                        >
                            <WalletIcon className="w-5 h-5" /> Conectar Mercado Pago
                        </button>
                    )}
                </div>

                <button onClick={handleSave} className="w-full bg-white text-black font-bold py-3 px-4 rounded-lg hover:bg-gray-200 mt-4">Salvar Configurações</button>
            </div>
        </Modal>
    );
};

// --- App Component ---
const App = () => {
    const [session, setSession] = useState<any>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);

    // Verifica se é uma rota pública de agendamento
    const isBookingRoute = window.location.pathname.startsWith('/book-link/');

    // Efeito para capturar o retorno do Mercado Pago (OAuth Callback)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state'); // user_id

        if (code && state) {
            handleMPCallback(code, state);
        }
    }, []);

    const handleMPCallback = async (code: string, state: string) => {
        try {
            // Limpa a URL visualmente
            window.history.replaceState({}, document.title, window.location.pathname);
            alert("Finalizando conexão com Mercado Pago...");
            
            const { data, error } = await supabase.functions.invoke('mercadopago-connect', {
                body: { code, state } // Envia via Body agora
            });
            
            if (error) throw error;
            alert("Conectado com sucesso! Agora você pode receber pagamentos.");
            window.location.reload(); // Recarrega para atualizar status
        } catch (e: any) {
            console.error("Erro Callback MP:", e);
            alert("Erro ao conectar: " + (e.message || "Erro desconhecido"));
        }
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) fetchUserData(session.user.id);
            else setLoading(false);
        });
        supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) fetchUserData(session.user.id);
        });
    }, []);

    const fetchUserData = async (userId: string) => {
        const [profRes, busRes, apptRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', userId).single(),
            supabase.from('business_profiles').select('*').eq('user_id', userId).single(),
            supabase.from('appointments').select('*').eq('user_id', userId).order('date', { ascending: true })
        ]);
        
        if (profRes.data) setProfile(profRes.data);
        if (busRes.data) setBusinessProfile(busRes.data);
        if (apptRes.data) setAppointments(apptRes.data);
        setLoading(false);

        // Realtime
        supabase.channel('appointments-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `user_id=eq.${userId}` }, 
            (payload) => {
                if (payload.eventType === 'INSERT') setAppointments(prev => [...prev, payload.new as Appointment]);
                else if (payload.eventType === 'UPDATE') setAppointments(prev => prev.map(a => a.id === payload.new.id ? payload.new as Appointment : a));
                else if (payload.eventType === 'DELETE') setAppointments(prev => prev.filter(a => a.id !== payload.old.id));
            }).subscribe();
    };

    if (isBookingRoute) {
        // Simples renderizador para a rota pública (Placeholder, a lógica real estaria em outro componente se o arquivo fosse separado)
        return <div className="min-h-screen bg-black flex items-center justify-center text-white">Carregando Agendamento... (Verifique se o ID do link está correto)</div>;
    }

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><LoaderIcon className="w-10 h-10 text-white" /></div>;

    if (!session) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
                <h1 className="text-4xl font-bold text-white mb-8">Oubook</h1>
                <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })} className="bg-white text-black font-bold py-3 px-6 rounded-lg flex items-center gap-2">
                    Entrar com Google
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 sm:p-6 max-w-4xl mx-auto">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold">Oubook Dashboard</h1>
                <div className="flex gap-2">
                    <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"><SettingsIcon /></button>
                    <button onClick={() => supabase.auth.signOut()} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"><LogOutIcon /></button>
                </div>
            </header>

            <div className="grid gap-6">
                <button onClick={() => setIsLinkModalOpen(true)} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-2xl flex items-center justify-between hover:scale-[1.02] transition-transform">
                    <div>
                        <h3 className="text-xl font-bold">Novo Agendamento</h3>
                        <p className="text-blue-100">Gerar link único para cliente</p>
                    </div>
                    <PlusIcon className="w-8 h-8" />
                </button>

                <div>
                    <h2 className="text-xl font-bold mb-4">Próximos Agendamentos</h2>
                    {appointments.length === 0 ? (
                        <div className="text-center text-gray-500 py-8 bg-gray-900 rounded-2xl">Nenhum agendamento encontrado.</div>
                    ) : (
                        <div className="space-y-4">
                            {appointments.map(appt => (
                                <AppointmentCard 
                                    key={appt.id} 
                                    appointment={appt} 
                                    onUpdateStatus={async (id, status) => { await supabase.from('appointments').update({ status }).eq('id', id); }}
                                    onDelete={async (id) => { if(confirm('Excluir?')) await supabase.from('appointments').delete().eq('id', id); }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <LinkGeneratorModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} userId={session.user.id} />
            <SettingsModal 
                isOpen={isSettingsModalOpen} 
                onClose={() => setIsSettingsModalOpen(false)} 
                profile={{...profile, user_id: session.user.id}} 
                businessProfile={businessProfile}
                onSaveBusinessProfile={async (data: any) => {
                    await supabase.from('business_profiles').upsert({ user_id: session.user.id, ...data });
                    setBusinessProfile(data);
                }}
            />
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
