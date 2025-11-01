import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, Session } from '@supabase/supabase-js';
import QRCode from 'react-qr-code';

// --- CONFIGURAÇÃO DO CLIENTE SUPABASE ---
const supabaseUrl = 'https://ehosmvbealefukkbqggp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVob3NtdmJlYWxlZnVra2JxZ2dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMjIzMDgsImV4cCI6MjA3NzU5ODMwOH0.IKqwxawiPnZT__Djj6ISgnQOawKnbboJ1TfqhSTf89M';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- ÍCONES (Feather Icons como Componentes React) ---
const Icon = ({ children, className = '', ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`feather ${className}`} {...props}>{children}</svg>
);
const HomeIcon = (props) => <Icon {...props}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></Icon>;
const CalendarIcon = (props) => <Icon {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></Icon>;
const LinkIcon = (props) => <Icon {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></Icon>;
const SettingsIcon = (props) => <Icon {...props}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></Icon>;
const LogOutIcon = (props) => <Icon {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></Icon>;
const SearchIcon = (props) => <Icon {...props}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></Icon>;
const PlusIcon = (props) => <Icon {...props}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></Icon>;
const FilterIcon = (props) => <Icon {...props}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></Icon>;
const XIcon = (props) => <Icon {...props}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></Icon>;
const CheckCircleIcon = (props) => <Icon {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></Icon>;
const XCircleIcon = (props) => <Icon {...props}><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></Icon>;

// --- TIPOS ---
type AppointmentStatus = 'Pendente' | 'Confirmado' | 'Cancelado';
interface Appointment {
  id: string;
  name: string;
  email: string;
  date: string;
  time: string;
  status: AppointmentStatus;
}

// --- COMPONENTES DE UI ---
const Sidebar = ({ onOpenLinkModal, onLogout }) => {
  const navItems = [
    { icon: <HomeIcon />, name: 'Painel' },
    { icon: <CalendarIcon />, name: 'Agendamentos' },
    { icon: <LinkIcon />, name: 'Links de Reserva' },
    { icon: <SettingsIcon />, name: 'Configurações' },
  ];

  return (
    <div className="h-screen w-64 bg-[#111111] text-[#F5F5F7] flex flex-col p-4 border-r border-white/10 fixed">
      <div className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 bg-[#C0C0C0] rounded-lg"></div>
        <h1 className="text-xl font-bold text-white">Scheduler</h1>
      </div>
      <nav className="flex-1">
        <ul>
          {navItems.map((item, index) => (
            <li key={index} className="mb-2">
              <button onClick={item.name === 'Links de Reserva' ? onOpenLinkModal : null} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${index === 1 ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-400'}`}>
                {React.cloneElement(item.icon, { className: 'w-5 h-5' })}
                <span className="font-medium">{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div>
         <button onClick={onLogout} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 text-gray-400 transition-colors">
            <LogOutIcon className="w-5 h-5"/>
            <span className="font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
};

const Header = ({ onNewAppointmentClick }) => (
  <header className="flex items-center justify-between p-6">
    <h1 className="text-3xl font-bold text-white">Agendamentos</h1>
    <div className="flex items-center gap-4">
      <div className="glassmorphism text-xs font-semibold px-3 py-1.5 rounded-full text-[#C0C0C0]">
        TESTE PREMIUM: 3/5 USOS RESTANTES
      </div>
      <button onClick={onNewAppointmentClick} className="bg-white/5 hover:bg-white/10 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2">
        <PlusIcon className="w-5 h-5"/> Novo Agendamento
      </button>
    </div>
  </header>
);

const AppointmentCard: React.FC<{ appointment: Appointment; onUpdateStatus: (id: string, status: AppointmentStatus) => Promise<void> }> = ({ appointment, onUpdateStatus }) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const statusStyles: { [key in AppointmentStatus]: string } = {
        Pendente: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        Confirmado: 'bg-green-500/10 text-green-400 border-green-500/20',
        Cancelado: 'bg-red-500/10 text-red-400 border-red-500/20',
    };

    const handleStatusUpdate = async (status: AppointmentStatus) => {
        setIsUpdating(true);
        await onUpdateStatus(appointment.id, status);
        setIsUpdating(false);
    };

    return (
        <div className="glassmorphism p-5 rounded-xl hover:border-white/20 transition-all duration-300 flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-lg text-white">{appointment.name}</h3>
                        <p className="text-sm text-gray-400">{appointment.email}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusStyles[appointment.status]}`}>
                        {appointment.status}
                    </span>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-gray-300">
                    <div className="flex items-center gap-2 text-sm">
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                        <span>{new Date(appointment.date).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</span>
                    </div>
                    <span className="font-semibold text-white">{appointment.time}</span>
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 flex justify-end gap-2">
                {appointment.status === 'Pendente' && (
                    <>
                        <button onClick={() => handleStatusUpdate('Cancelado')} disabled={isUpdating} className="flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50">
                            <XCircleIcon className="w-4 h-4" /> Cancelar
                        </button>
                        <button onClick={() => handleStatusUpdate('Confirmado')} disabled={isUpdating} className="flex items-center gap-1 text-xs font-semibold text-green-400 bg-green-500/10 hover:bg-green-500/20 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50">
                            <CheckCircleIcon className="w-4 h-4" /> Confirmar
                        </button>
                    </>
                )}
                {appointment.status === 'Confirmado' && (
                     <button onClick={() => handleStatusUpdate('Cancelado')} disabled={isUpdating} className="flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50">
                        <XCircleIcon className="w-4 h-4" /> Cancelar
                    </button>
                )}
            </div>
        </div>
    );
};


const AppointmentModal = ({ isOpen, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave({ name, email, date, time, status: 'Pendente' });
        setIsSaving(false);
        setName(''); setEmail(''); setDate(''); setTime('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#1C1C1E] rounded-xl p-8 border border-white/10 w-full max-w-md">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">Novo Agendamento</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><XIcon className="w-6 h-6"/></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <input type="text" placeholder="Nome do Cliente" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C0C0C0]/50" />
                        <input type="email" placeholder="Email do Cliente" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C0C0C0]/50" />
                        <div className="flex gap-4">
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C0C0C0]/50" />
                            <input type="time" value={time} onChange={e => setTime(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C0C0C0]/50" />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="py-2 px-4 text-sm font-semibold rounded-lg text-gray-300 hover:bg-white/5">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="bg-[#C0C0C0] text-black py-2 px-4 text-sm font-semibold rounded-lg hover:bg-white disabled:opacity-50">
                            {isSaving ? 'Salvando...' : 'Salvar Agendamento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const LinkGeneratorModal = ({ isOpen, onClose, userId }) => {
    const [copyButtonText, setCopyButtonText] = useState('Copiar Link');
    if (!isOpen) return null;

    const bookingLink = `${window.location.origin}/book/${userId}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(bookingLink);
        setCopyButtonText('Copiado!');
        setTimeout(() => setCopyButtonText('Copiar Link'), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#1C1C1E] rounded-xl p-8 border border-white/10 w-full max-w-md text-center">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">Seu Link de Agendamento</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><XIcon className="w-6 h-6"/></button>
                </div>
                <p className="text-sm text-gray-400 mb-4">Compartilhe este QR Code ou link para seus clientes agendarem um horário com você.</p>
                <div className="bg-white p-4 rounded-lg inline-block mb-4">
                    <QRCode value={bookingLink} size={128} />
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-left mb-6">
                    <p className="text-white truncate">{bookingLink}</p>
                </div>
                <button onClick={handleCopy} className="w-full bg-[#C0C0C0] text-black py-2 px-4 text-sm font-semibold rounded-lg hover:bg-white transition-colors">
                    {copyButtonText}
                </button>
            </div>
        </div>
    );
};


const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"></div></div>
);

const AppointmentsDashboard = ({ appointments, loading, error, onUpdateStatus }) => {
    const [activeTab, setActiveTab] = useState<AppointmentStatus | 'Todos'>('Todos');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredAppointments = appointments
        .filter(appointment => activeTab === 'Todos' || appointment.status === activeTab)
        .filter(appointment =>
            appointment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            appointment.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    
    const tabs: (AppointmentStatus | 'Todos')[] = ['Todos', 'Pendente', 'Confirmado', 'Cancelado'];

    return (
        <div className="p-6">
            <div className="mb-6"><div className="flex items-center justify-between"><div className="flex border-b border-white/10">
                {tabs.map(tab => (<button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab ? 'text-white border-b-2 border-[#C0C0C0]' : 'text-gray-400 hover:text-white'}`}>{tab}</button>))}
            </div><div className="flex items-center gap-4"><div className="relative">
                <input type="text" placeholder="Buscar por nome ou email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 w-64 text-sm focus:outline-none focus:ring-2 focus:ring-[#C0C0C0]/50" />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div><button className="bg-white/5 hover:bg-white/10 text-white font-medium py-2 px-3 rounded-lg transition-colors flex items-center gap-2 text-sm"><FilterIcon className="w-4 h-4" /> Filtrar</button></div></div></div>
            {loading ? <LoadingSpinner /> : error ? <div className="text-center text-red-400">{error}</div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAppointments.length > 0 ? (
                        filteredAppointments.map(app => <AppointmentCard key={app.id} appointment={app} onUpdateStatus={onUpdateStatus} />)
                    ) : (<p className="text-gray-400 col-span-full text-center">Nenhum agendamento encontrado.</p>)}
                </div>
            )}
        </div>
    );
};

const LoginPage = () => {
    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
        if (error) console.error("Erro no login com Google:", error);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-black">
            <div className="text-center p-8 bg-[#111111] rounded-xl border border-white/10">
                 <div className="flex items-center gap-2 mb-6 justify-center">
                    <div className="w-10 h-10 bg-[#C0C0C0] rounded-lg"></div>
                    <h1 className="text-3xl font-bold text-white">Scheduler</h1>
                </div>
                <p className="text-gray-400 mb-8">Faça login para gerenciar seus agendamentos.</p>
                <button onClick={handleGoogleLogin} className="bg-white/5 hover:bg-white/10 text-white font-semibold py-3 px-6 rounded-lg transition-colors w-full">
                    Entrar com Google
                </button>
            </div>
        </div>
    );
};


const MainApp = ({ session }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAppointments = useCallback(async () => {
        const { data, error } = await supabase.from('appointments').select('*').order('date', { ascending: true });
        if (error) {
            console.error('Erro ao buscar agendamentos:', error);
            setError('Não foi possível buscar os agendamentos.');
        } else {
            setAppointments(data as Appointment[]);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchAppointments();
        const intervalId = setInterval(fetchAppointments, 15000);
        return () => clearInterval(intervalId);
    }, [fetchAppointments]);

    const handleSave = async (newAppointmentData) => {
        const { error } = await supabase.from('appointments').insert([{ ...newAppointmentData, user_id: session.user.id }]);
        if (error) console.error('Falha ao salvar agendamento', error);
        else {
            setIsModalOpen(false);
            fetchAppointments();
        }
    };
    
    const handleUpdateStatus = async (id: string, status: AppointmentStatus) => {
        const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
        if (error) console.error('Falha ao atualizar status', error);
        else fetchAppointments(); // Re-busca para atualizar a UI
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };
    
    return (
        <div className="flex min-h-screen bg-black">
          <Sidebar onOpenLinkModal={() => setIsLinkModalOpen(true)} onLogout={handleLogout} />
          <main className="ml-64 flex-1 flex flex-col">
            <Header onNewAppointmentClick={() => setIsModalOpen(true)} />
            <div className="flex-1 overflow-y-auto scrollbar-hide">
                <AppointmentsDashboard appointments={appointments} loading={loading} error={error} onUpdateStatus={handleUpdateStatus} />
            </div>
             <AppointmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} />
             <LinkGeneratorModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} userId={session.user.id} />
          </main>
        </div>
    );
};

const App = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return <div className="flex justify-center items-center h-screen bg-black"><LoadingSpinner /></div>;
    }

    return session ? <MainApp session={session} /> : <LoginPage />;
};

const container = document.getElementById('root');
if (container) {
    createRoot(container).render(<App />);
}