import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ehosmvbealefukkbqggp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVob3NtdmJlYWxlZnVra2JxZ2dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMjIzMDgsImV4cCI6MjA3NzU5ODMwOH0.IKqwxawiPnZT__Djj6ISgnQOawKnbboJ1TfqhSTf89M';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Tipos
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

type Profile = {
    id: string;
    plan: 'trial' | 'premium';
    daily_usage: number;
    last_usage_date: string;
};

type User = {
    id: string;
    email?: string;
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
const LinkIcon = (props: any) => <Icon {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></Icon>;
const LogOutIcon = (props: any) => <Icon {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></Icon>;
const CopyIcon = (props: any) => <Icon {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></Icon>;
const AlertCircleIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></Icon>;
const LoaderIcon = (props: any) => <Icon {...props} className="animate-spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></Icon>;
const XIcon = (props: any) => <Icon {...props}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></Icon>;

// --- Componentes de UI ---
const StatusBadge = ({ status }: { status: Appointment['status'] }) => {
  const baseClasses = "px-3 py-1 text-xs font-medium rounded-full text-white";
  const statusClasses = {
    Pendente: "bg-yellow-500/20 text-yellow-300",
    Confirmado: "bg-green-500/20 text-green-300",
    Cancelado: "bg-red-500/20 text-red-300",
  };
  return <span className={`${baseClasses} ${statusClasses[status]}`}>{status}</span>;
};

const AppointmentCard = ({ appointment, onUpdateStatus, onDelete }: { appointment: Appointment; onUpdateStatus: (id: string, status: Appointment['status']) => void; onDelete: (id: string) => void; }) => {
    return (
      <div className="glassmorphism rounded-2xl p-6 flex flex-col space-y-4 transition-all duration-300 hover:border-gray-400 relative">
        <button
            onClick={() => onDelete(appointment.id)}
            className="absolute top-4 right-4 text-gray-500 hover:text-red-400 transition-colors opacity-50 hover:opacity-100 z-10"
            aria-label="Excluir agendamento"
        >
            <XIcon className="w-5 h-5" />
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-white">{appointment.name}</h3>
            <p className="text-sm text-gray-400">{appointment.email}</p>
          </div>
          <StatusBadge status={appointment.status} />
        </div>
        <div className="border-t border-gray-700/50 my-4"></div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0 text-sm text-gray-300">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-4 h-4 text-gray-500" />
            <span>{new Date(appointment.date + 'T00:00:00').toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
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

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="glassmorphism w-full max-w-md rounded-2xl p-6 border border-gray-700 relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                    <XIcon className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>
                {children}
            </div>
        </div>
    );
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, children }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, title: string, children: React.ReactNode }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="text-gray-300 mb-6">
                {children}
            </div>
            <div className="flex justify-end space-x-4">
                <button onClick={onClose} className="bg-gray-700/50 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600/50 transition-colors">
                    Cancelar
                </button>
                <button onClick={onConfirm} className="bg-red-500/80 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-500 transition-colors">
                    Excluir Permanentemente
                </button>
            </div>
        </Modal>
    );
};


const NewAppointmentModal = ({ isOpen, onClose, onSave, user }: { isOpen: boolean, onClose: () => void, onSave: (name: string, email: string, date: string, time: string) => Promise<boolean>, user: User }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSaving(true);
        const success = await onSave(name, email, date, time);
        setIsSaving(false);
        if (success) {
            setName(''); setEmail(''); setDate(''); setTime('');
            onClose();
        } else {
            setError('Você atingiu o limite diário de agendamentos do seu plano.');
        }
    };
    
    useEffect(() => {
        if (!isOpen) {
            setError('');
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Novo Agendamento">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <p className="text-red-400 bg-red-500/10 p-3 rounded-lg text-center">{error}</p>}
                <input type="text" placeholder="Nome do Cliente" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                <input type="email" placeholder="Email do Cliente" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                <input type="time" value={time} onChange={e => setTime(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                <button type="submit" disabled={isSaving} className="w-full bg-gray-200 text-black font-bold py-3 px-4 rounded-lg hover:bg-white transition-colors disabled:opacity-50">
                    {isSaving ? <LoaderIcon className="w-6 h-6 mx-auto" /> : 'Salvar Agendamento'}
                </button>
            </form>
        </Modal>
    );
};

const LinkGeneratorModal = ({ isOpen, onClose, userId }: { isOpen: boolean; onClose: () => void; userId: string }) => {
    const link = `${window.location.origin}/book/${userId}`;
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Seu Link de Agendamento">
            <p className="text-gray-300 mb-4">Compartilhe este link com seus clientes para que eles possam agendar um horário com você.</p>
            <div className="flex items-center space-x-2 bg-black/30 p-3 rounded-lg border border-gray-600">
                <LinkIcon className="w-5 h-5 text-gray-400" />
                <input type="text" value={link} readOnly className="bg-transparent text-white w-full outline-none" />
                <button onClick={handleCopy} className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-500 transition-colors">
                    {copied ? 'Copiado!' : 'Copiar'}
                </button>
            </div>
        </Modal>
    );
};

const PaginaDeAgendamento = ({ adminId }: { adminId: string }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAdminProfile = async () => {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', adminId)
                .single();
            
            if (error) {
                console.error('Erro ao buscar perfil do admin:', error);
                setMessage({ type: 'error', text: 'Não foi possível carregar a página de agendamento.' });
            } else if (data) {
                const today = new Date().toISOString().split('T')[0];
                if(data.last_usage_date !== today) {
                    setAdminProfile({ ...data, daily_usage: 0 });
                } else {
                    setAdminProfile(data);
                }
            }
            setIsLoading(false);
        };
        fetchAdminProfile();
    }, [adminId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        // A verificação no frontend é boa para UX, mas a segurança real está no backend (Trigger do Supabase)
        if (adminProfile && adminProfile.plan === 'trial' && adminProfile.daily_usage >= 5) {
            setMessage({ type: 'error', text: 'Este profissional atingiu o limite de agendamentos para hoje. Tente novamente amanhã.' });
            return;
        }

        setIsSaving(true);
        const { error } = await supabase.from('appointments').insert({
            name, email, date, time, user_id: adminId, status: 'Pendente'
        });

        if (error) {
            // Verifica se o erro é o nosso erro customizado do banco de dados
            if (error.message.includes('Limite diário de agendamentos atingido')) {
                 setMessage({ type: 'error', text: 'Este profissional atingiu o limite de agendamentos para hoje. Tente novamente amanhã.' });
            } else {
                setMessage({ type: 'error', text: 'Ocorreu um erro ao salvar seu agendamento. Tente novamente.' });
            }
            console.error(error);
        } else {
             // Increment usage for admin
            if (adminProfile) {
                const today = new Date().toISOString().split('T')[0];
                const newUsage = adminProfile.last_usage_date === today ? adminProfile.daily_usage + 1 : 1;
                await supabase.from('profiles').update({ daily_usage: newUsage, last_usage_date: today }).eq('id', adminId);
            }
            setMessage({ type: 'success', text: 'Agendamento realizado com sucesso!' });
            setName(''); setEmail(''); setDate(''); setTime('');
        }
        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4">
                <LoaderIcon className="w-12 h-12 text-white" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md mx-auto">
                <div className="glassmorphism rounded-2xl p-8">
                    <h1 className="text-3xl font-bold text-center text-white mb-2">Agendar Horário</h1>
                    <p className="text-gray-400 text-center mb-8">Preencha os dados abaixo para confirmar seu horário.</p>

                    {message && (
                        <div className={`p-4 rounded-lg mb-4 text-center ${message.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <input type="text" placeholder="Seu Nome" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                        <input type="email" placeholder="Seu Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                        <input type="time" value={time} onChange={e => setTime(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" />
                        <button type="submit" disabled={isSaving || (adminProfile?.plan === 'trial' && (adminProfile?.daily_usage ?? 0) >= 5)} className="w-full bg-gray-200 text-black font-bold py-3 px-4 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            {isSaving ? <LoaderIcon className="w-6 h-6 mx-auto" /> : 'Confirmar Agendamento'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};


const LoginPage = () => {
    const handleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });
        if (error) console.error("Erro no login:", error);
    };

    return (
        <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4">
            <div className="text-center">
                 <CalendarIcon className="w-16 h-16 text-white mx-auto mb-4" />
                 <h1 className="text-5xl font-bold text-white mb-2">Scheduler Pro</h1>
                 <p className="text-lg text-gray-400 mb-8">A maneira mais inteligente de gerenciar seus agendamentos.</p>
                 <button onClick={handleLogin} className="bg-white text-black font-bold py-3 px-8 rounded-lg hover:bg-gray-200 transition-colors text-lg flex items-center mx-auto space-x-3">
                     <svg className="w-6 h-6" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.42-4.55H24v8.51h12.8c-.57 2.74-2.31 5.11-4.81 6.69l7.98 6.19c4.65-4.3 7.3-10.49 7.3-17.84z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.98-6.19c-2.11 1.45-4.81 2.3-7.91 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                    <span>Entrar com Google</span>
                 </button>
            </div>
        </div>
    );
};

const Dashboard = ({ user, profile, setProfile }: { user: User, profile: Profile | null, setProfile: React.Dispatch<React.SetStateAction<Profile | null>>}) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [statusFilter, setStatusFilter] = useState<'Pendente' | 'Confirmado' | 'Cancelado' | 'Todos'>('Todos');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);


    const TRIAL_LIMIT = 5;
    const usage = profile?.daily_usage ?? 0;
    const hasReachedLimit = profile?.plan === 'trial' && usage >= TRIAL_LIMIT;

    const fetchAppointments = useCallback(async () => {
        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false })
            .order('time', { ascending: false });

        if (error) {
            console.error("Erro ao buscar agendamentos:", error);
            setError("Não foi possível carregar os agendamentos.");
        } else {
            setAppointments(data || []);
        }
        setIsLoading(false);
    }, [user.id]);

    useEffect(() => {
        fetchAppointments();
        const intervalId = setInterval(fetchAppointments, 15000); // Polling a cada 15s
        return () => clearInterval(intervalId);
    }, [fetchAppointments]);

    const filteredAppointments = useMemo(() => {
        return appointments
            .filter(app => statusFilter === 'Todos' || app.status === statusFilter)
            .filter(app =>
                app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [appointments, statusFilter, searchTerm]);

    const handleSaveAppointment = async (name: string, email: string, date: string, time: string): Promise<boolean> => {
        if (!profile) return false;
        const { data, error } = await supabase
            .from('appointments')
            .insert({ name, email, date, time, user_id: user.id })
            .select()
            .single();

        if (error) {
            console.error('Erro ao salvar:', error);
            if (error.message.includes('Limite diário de agendamentos atingido')) {
                 // A segurança do backend bloqueou, o retorno é 'false'
                 return false;
            }
        } else if (data) {
            setAppointments(prev => [data, ...prev]);
            const today = new Date().toISOString().split('T')[0];
            const newUsage = profile.last_usage_date === today ? profile.daily_usage + 1 : 1;
            const { data: updatedProfile, error: profileError } = await supabase
                .from('profiles')
                .update({ daily_usage: newUsage, last_usage_date: today })
                .eq('id', user.id)
                .select()
                .single();
            if (profileError) console.error("Erro ao atualizar perfil:", profileError);
            else setProfile(updatedProfile);
            return true;
        }
        return false;
    };

    const handleUpdateStatus = async (id: string, status: Appointment['status']) => {
        const { data, error } = await supabase
            .from('appointments')
            .update({ status })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error("Erro ao atualizar status:", error);
        } else if (data) {
            setAppointments(prev => prev.map(app => app.id === id ? data : app));
        }
    };

    const openDeleteModal = (id: string) => {
        setAppointmentToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteAppointment = async () => {
        if (!appointmentToDelete) return;

        const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', appointmentToDelete);
        
        if (error) {
            console.error("Erro ao excluir agendamento:", error);
        } else {
            setAppointments(prev => prev.filter(app => app.id !== appointmentToDelete));
        }

        setIsDeleteModalOpen(false);
        setAppointmentToDelete(null);
    };


    return (
      <div className="flex h-screen bg-black">
        {/* Sidebar */}
        <aside className="w-64 glassmorphism p-6 flex-col hidden md:flex">
            <div className="flex items-center space-x-2 mb-10">
                <CalendarIcon className="w-8 h-8 text-white"/>
                <h1 className="text-2xl font-bold text-white">Scheduler Pro</h1>
            </div>
            <nav className="flex-grow">
                <ul className="space-y-2">
                    <li><button onClick={() => {}} className="w-full flex items-center space-x-3 text-gray-300 hover:bg-gray-700/50 p-3 rounded-lg"><CalendarIcon className="w-5 h-5"/><span>Agendamentos</span></button></li>
                    <li>
                        <button 
                            onClick={() => setIsLinkModalOpen(true)} 
                            disabled={hasReachedLimit}
                            className="w-full flex items-center space-x-3 text-gray-300 hover:bg-gray-700/50 p-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <LinkIcon className="w-5 h-5"/><span>Links de Reserva</span>
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
                <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center space-x-3 text-gray-300 hover:bg-red-500/20 hover:text-red-300 p-3 rounded-lg transition-colors">
                    <LogOutIcon className="w-5 h-5"/><span>Sair</span>
                </button>
             </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-screen">
          <header className="glassmorphism p-6 border-b border-gray-800/50 flex justify-between items-center">
             <h2 className="text-3xl font-bold text-white">Seus Agendamentos</h2>
             <div className="flex items-center space-x-4">
                <div className="glassmorphism py-2 px-4 rounded-lg text-sm">
                    <span className="font-bold text-white">{`Plano Trial: ${usage}/${TRIAL_LIMIT} usos hoje`}</span>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    disabled={hasReachedLimit}
                    className="bg-white text-black font-bold py-2 px-5 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <PlusIcon className="w-5 h-5"/>
                    <span>Novo Agendamento</span>
                </button>
             </div>
          </header>

          <div className="p-6 flex-1 overflow-y-auto scrollbar-hide">
             {/* Filtros e Busca */}
             <div className="mb-6">
                <div className="flex justify-between items-center">
                    <div className="flex space-x-1 glassmorphism p-1 rounded-lg">
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
                     <div className="relative w-full max-w-xs">
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
                    {filteredAppointments.map(app => <AppointmentCard key={app.id} appointment={app} onUpdateStatus={handleUpdateStatus} onDelete={openDeleteModal} />)}
                </div>
             )}
          </div>
        </main>

        <NewAppointmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveAppointment} user={user} />
        <LinkGeneratorModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} userId={user.id} />
        <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeleteAppointment}
            title="Confirmar Exclusão"
        >
            <p>Você tem certeza que deseja excluir este agendamento?</p>
            <p className="font-bold text-yellow-400 mt-2">Esta ação é permanente e não pode ser desfeita.</p>
        </ConfirmationModal>
      </div>
    );
};


const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [path, setPath] = useState(window.location.pathname);
    
    useEffect(() => {
      const checkUser = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          const currentUser = session?.user ?? null;

          if (currentUser) {
              const { data: userProfiles, error } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', currentUser.id);

              if (error) {
                  console.error("Erro ao buscar perfil:", error);
              } else if (userProfiles && userProfiles.length > 0) {
                  const userProfile = userProfiles[0];
                  const today = new Date().toISOString().split('T')[0];
                  if (userProfile.last_usage_date !== today) {
                      // Reset usage if it's a new day
                      const { data: updatedProfile, error: updateError } = await supabase
                          .from('profiles')
                          .update({ daily_usage: 0, last_usage_date: today })
                          .eq('id', currentUser.id)
                          .select()
                          .single();
                      if (updateError) console.error("Erro ao resetar uso:", updateError);
                      else setProfile(updatedProfile);
                  } else {
                      setProfile(userProfile);
                  }
              } else {
                  // Perfil não encontrado, então vamos criá-lo.
                  const { data: newProfile, error: insertError } = await supabase
                    .from('profiles')
                    .insert({ id: currentUser.id })
                    .select()
                    .single();

                  if (insertError) {
                      console.error("Erro ao criar perfil:", insertError);
                  } else {
                      setProfile(newProfile);
                  }
              }
              setUser({id: currentUser.id, email: currentUser.email});
          }
          setIsLoading(false);
      };
      
      checkUser();

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
          const currentUser = session?.user ?? null;
          if (currentUser) {
            setUser({id: currentUser.id, email: currentUser.email});
            checkUser(); // Re-fetch profile on auth change
          } else {
            setUser(null);
            setProfile(null);
          }
      });
      
      return () => {
          authListener.subscription.unsubscribe();
      };
    }, []);

    // FIX: Renamed `router` to `pageContent` to avoid potential naming collisions.
    const pageContent = useMemo(() => {
        const pathParts = path.split('/').filter(Boolean);
        if (pathParts[0] === 'book' && pathParts[1]) {
            return <PaginaDeAgendamento adminId={pathParts[1]} />;
        }
        if (user && profile) {
            return <Dashboard user={user} profile={profile} setProfile={setProfile} />;
        }
        if (user && !profile) {
             // This state occurs briefly after login while the profile is being created/fetched.
             // Instead of rendering nothing, we show a loader.
             return (
                 <div className="min-h-screen bg-black flex justify-center items-center">
                     <LoaderIcon className="w-16 h-16 text-white" />
                 </div>
             );
        }
        if(!user && !isLoading) {
             return <LoginPage />;
        }
        return null; 
    }, [path, user, profile, isLoading]);

    if (isLoading) {
        return (
             <div className="min-h-screen bg-black flex justify-center items-center">
                 <LoaderIcon className="w-16 h-16 text-white"/>
             </div>
        );
    }
    
    return pageContent;
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