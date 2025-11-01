import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ehosmvbealefukkbqggp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVob3NtdmJlYWxlZnVra2JxZ2dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMjIzMDgsImV4cCI6MjA3NzU5ODMwOH0.IKqwxawiPnZT__Djj6ISgnQOawKnbboJ1TfqhSTf89M';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Tipos ---
type Appointment = {
  id: string;
  name: string;
  email: string;
  date: string;
  time: string;
  status: 'Pendente' | 'Confirmado' | 'Cancelado';
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
const Icon = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`feather ${className}`}>{children}</svg>
);
const CalendarIcon = (props: any) => <Icon {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></Icon>;
const UserIcon = (props: any) => <Icon {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></Icon>;
const LinkIcon = (props: any) => <Icon {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></Icon>;
const SettingsIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></Icon>;
const LogOutIcon = (props: any) => <Icon {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></Icon>;
const SearchIcon = (props: any) => <Icon {...props}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></Icon>;
const CheckIcon = (props: any) => <Icon {...props}><polyline points="20 6 9 17 4 12"></polyline></Icon>;
const XIcon = (props: any) => <Icon {...props}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></Icon>;
const CopyIcon = (props: any) => <Icon {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></Icon>;

// --- Componentes de UI ---
const Sidebar: React.FC<{ onNavigate: (page: string) => void; onLogout: () => void }> = ({ onNavigate, onLogout }) => (
  <div className="w-64 bg-black p-6 flex flex-col h-screen fixed">
    <h1 className="text-2xl font-bold text-white mb-12">Scheduler Pro</h1>
    <nav className="flex-grow">
      <ul>
        <li className="mb-4"><a href="#" onClick={() => onNavigate('dashboard')} className="flex items-center text-gray-300 hover:text-white transition-colors"><CalendarIcon className="mr-3" /> Agendamentos</a></li>
        <li className="mb-4"><a href="#" onClick={() => onNavigate('profile')} className="flex items-center text-gray-300 hover:text-white transition-colors"><UserIcon className="mr-3" /> Perfil do Negócio</a></li>
        <li className="mb-4"><a href="#" onClick={() => onNavigate('links')} className="flex items-center text-gray-300 hover:text-white transition-colors"><LinkIcon className="mr-3" /> Links de Reserva</a></li>
        <li className="mb-4"><a href="#" onClick={() => onNavigate('settings')} className="flex items-center text-gray-300 hover:text-white transition-colors"><SettingsIcon className="mr-3" /> Configurações</a></li>
      </ul>
    </nav>
    <div className="mt-auto">
      <button onClick={onLogout} className="flex items-center w-full text-left text-gray-300 hover:text-white transition-colors"><LogOutIcon className="mr-3" /> Sair</button>
    </div>
  </div>
);

const Header: React.FC<{ profile: Profile | null; onNewAppointment: () => void; isUsageLimitReached: boolean }> = ({ profile, onNewAppointment, isUsageLimitReached }) => {
  const usageText = profile ? `${profile.daily_usage}/5 usos hoje` : 'Carregando...';
  return (
    <header className="flex justify-between items-center mb-6">
      <h2 className="text-3xl font-bold text-white">Seus Agendamentos</h2>
      <div className="flex items-center space-x-4">
        <span className="bg-gray-800 text-sm text-gray-300 px-3 py-1 rounded-full">Plano Trial: {usageText}</span>
        <button onClick={onNewAppointment} disabled={isUsageLimitReached} className="bg-white text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
          + Novo Agendamento
        </button>
      </div>
    </header>
  );
};

const AppointmentCard: React.FC<{ appointment: Appointment; onUpdateStatus: (id: string, status: 'Confirmado' | 'Cancelado') => void; }> = React.memo(({ appointment, onUpdateStatus }) => {
  const statusColors = {
    Pendente: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    Confirmado: 'bg-green-500/20 text-green-300 border-green-500/30',
    Cancelado: 'bg-red-500/20 text-red-300 border-red-500/30',
  };
  const formattedDate = new Date(appointment.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="glassmorphism p-5 rounded-xl mb-4 flex justify-between items-center hover:border-gray-500 transition-all duration-300">
      <div>
        <p className="font-bold text-lg text-white">{appointment.name}</p>
        <p className="text-sm text-gray-400">{appointment.email}</p>
        <p className="text-sm text-gray-400 mt-1">{formattedDate} às {appointment.time}</p>
      </div>
      <div className="flex items-center space-x-4">
        <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${statusColors[appointment.status]}`}>{appointment.status}</span>
        {appointment.status === 'Pendente' && (
          <>
            <button onClick={() => onUpdateStatus(appointment.id, 'Confirmado')} className="p-2 rounded-full bg-green-500/20 hover:bg-green-500/40 text-green-300 transition-colors"><CheckIcon className="w-5 h-5" /></button>
            <button onClick={() => onUpdateStatus(appointment.id, 'Cancelado')} className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-300 transition-colors"><XIcon className="w-5 h-5" /></button>
          </>
        )}
      </div>
    </div>
  );
});

const NewAppointmentModal: React.FC<{ onClose: () => void; onSave: (appointment: Omit<Appointment, 'id' | 'status'>) => Promise<void>; }> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSave({ name, email, date, time });
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="glassmorphism p-8 rounded-2xl w-full max-w-md border border-gray-700">
        <h3 className="text-2xl font-bold mb-6 text-white">Novo Agendamento</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <input type="text" placeholder="Nome do Cliente" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-gray-900/50 p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-500" />
            <input type="email" placeholder="Email do Cliente" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-900/50 p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-500" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-gray-900/50 p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-500" />
            <input type="time" value={time} onChange={e => setTime(e.target.value)} required className="w-full bg-gray-900/50 p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-500" />
          </div>
          <div className="flex justify-end space-x-4 mt-8">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-800">Cancelar</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-lg bg-white text-black font-semibold hover:bg-gray-200 disabled:bg-gray-500">{isSaving ? 'Salvando...' : 'Salvar Agendamento'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const LinkGeneratorModal: React.FC<{ onClose: () => void; userId: string | undefined }> = ({ onClose, userId }) => {
  const link = `${window.location.origin}/book/${userId}`;
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!userId) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div className="glassmorphism p-8 rounded-2xl w-full max-w-md text-center">
            <p className="text-red-400">Erro: ID de usuário não encontrado.</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-gray-700 text-white">Fechar</button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="glassmorphism p-8 rounded-2xl w-full max-w-md border border-gray-700">
        <h3 className="text-2xl font-bold mb-4 text-white">Seu Link de Agendamento</h3>
        <p className="text-gray-400 mb-6">Compartilhe este link com seus clientes para que eles possam agendar um horário.</p>
        <div className="flex items-center bg-gray-900/50 p-3 rounded-lg border border-gray-700">
          <input type="text" value={link} readOnly className="bg-transparent w-full text-gray-300 focus:outline-none" />
          <button onClick={copyToClipboard} className="ml-4 px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-sm font-semibold flex items-center">
            <CopyIcon className="w-4 h-4 mr-2"/>
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <div className="flex justify-end mt-8">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-800">Fechar</button>
        </div>
      </div>
    </div>
  );
};

// --- Telas Principais ---
const Dashboard: React.FC<{ user: User, profile: Profile, setProfile: (profile: Profile) => void }> = ({ user, profile, setProfile }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [statusFilter, setStatusFilter] = useState<'All' | Appointment['status']>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [showLinkGeneratorModal, setShowLinkGeneratorModal] = useState(false);

  const isUsageLimitReached = useMemo(() => profile.daily_usage >= 5, [profile.daily_usage]);

  const fetchAppointments = useCallback(async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('time', { ascending: false });

    if (error) {
      console.error('Erro ao buscar agendamentos:', error);
    } else {
      setAppointments(data as Appointment[]);
    }
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    fetchAppointments();
    const interval = setInterval(fetchAppointments, 15000);
    return () => clearInterval(interval);
  }, [fetchAppointments]);

  const handleUpdateStatus = async (id: string, status: 'Confirmado' | 'Cancelado') => {
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar status:', error);
    } else {
      fetchAppointments(); // Re-fetch for immediate update
    }
  };
  
  const handleSaveAppointment = async (appointmentData: Omit<Appointment, 'id' | 'status'>) => {
    if (isUsageLimitReached) {
      alert("Você atingiu o limite diário de agendamentos.");
      return;
    }

    const { data: newAppointment, error } = await supabase
        .from('appointments')
        .insert([{ ...appointmentData, user_id: user.id }])
        .select()
        .single();
    
    if (error) {
        console.error('Erro ao salvar agendamento:', error);
    } else if(newAppointment) {
      // Update profile usage
      const newUsage = profile.daily_usage + 1;
      const { data: updatedProfile, error: profileError } = await supabase
          .from('profiles')
          .update({ daily_usage: newUsage })
          .eq('id', user.id)
          .select()
          .single();
      
      if(profileError) console.error("Erro ao atualizar o perfil:", profileError);
      else setProfile(updatedProfile as Profile);

      fetchAppointments();
    }
  };

  const handleNavigation = (page: string) => {
    if (page === 'links') {
       if (!isUsageLimitReached) {
          setShowLinkGeneratorModal(true);
       } else {
          alert("Limite de usos atingido. Não é possível gerar links hoje.");
       }
    }
    // Add other navigation logic here later
  };
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const filteredAppointments = useMemo(() => {
    return appointments
      .filter(app => statusFilter === 'All' || app.status === statusFilter)
      .filter(app =>
        app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [appointments, statusFilter, searchTerm]);

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar onNavigate={handleNavigation} onLogout={handleLogout} />
      <main className="flex-1 ml-64 p-8 overflow-y-auto scrollbar-hide">
        <Header profile={profile} onNewAppointment={() => setShowNewAppointmentModal(true)} isUsageLimitReached={isUsageLimitReached} />
        <div className="flex justify-between items-center mb-6">
          <div className="flex space-x-1 border border-gray-700 rounded-lg p-1">
            {(['All', 'Pendente', 'Confirmado', 'Cancelado'] as const).map(status => (
              <button key={status} onClick={() => setStatusFilter(status)} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${statusFilter === status ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                {status === 'All' ? 'Todos' : status}
              </button>
            ))}
          </div>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input type="text" placeholder="Buscar por nome ou email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-gray-500" />
          </div>
        </div>
        {loading ? <p>Carregando agendamentos...</p> : (
          <div>
            {filteredAppointments.map(app => <AppointmentCard key={app.id} appointment={app} onUpdateStatus={handleUpdateStatus} />)}
          </div>
        )}
      </main>
      {showNewAppointmentModal && <NewAppointmentModal onClose={() => setShowNewAppointmentModal(false)} onSave={handleSaveAppointment} />}
      {showLinkGeneratorModal && <LinkGeneratorModal onClose={() => setShowLinkGeneratorModal(false)} userId={user?.id} />}
    </div>
  );
};

const PaginaDeAgendamento: React.FC<{ userId: string }> = ({ userId }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    useEffect(() => {
      const fetchOwnerProfile = async () => {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (error || !data) {
          console.error("Erro ao buscar perfil do proprietário", error);
          setMessage({type: 'error', text: 'Não foi possível encontrar este profissional.'});
        } else {
          
          const today = new Date().toISOString().split('T')[0];
          if (data.last_usage_date !== today) {
             setOwnerProfile({ ...data, daily_usage: 0 });
          } else {
             setOwnerProfile(data as Profile);
          }
        }
        setLoadingProfile(false);
      };
      fetchOwnerProfile();
    }, [userId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (ownerProfile && ownerProfile.daily_usage >= 5) {
            setMessage({ type: 'error', text: 'Este profissional atingiu o limite de agendamentos por hoje. Tente novamente amanhã.' });
            return;
        }

        setIsSaving(true);
        setMessage(null);

        const { data: newAppointment, error } = await supabase
            .from('appointments')
            .insert([{ name, email, date, time, user_id: userId }])
            .select().single();

        if (error) {
            setMessage({ type: 'error', text: 'Ocorreu um erro ao salvar seu agendamento. Tente novamente.' });
            console.error(error);
        } else if (newAppointment && ownerProfile) {
            setMessage({ type: 'success', text: 'Agendamento realizado com sucesso!' });
            setName(''); setEmail(''); setDate(''); setTime('');
            // Update owner's usage
             const newUsage = ownerProfile.daily_usage + 1;
             await supabase.from('profiles').update({ daily_usage: newUsage, last_usage_date: new Date().toISOString().split('T')[0] }).eq('id', userId);
        }
        setIsSaving(false);
    };

    if (loadingProfile) {
      return <div className="min-h-screen bg-black flex justify-center items-center"><p className="text-white">Carregando...</p></div>;
    }
    
    return (
        <div className="min-h-screen bg-black flex justify-center items-center p-4">
            <div className="w-full max-w-md">
                <div className="glassmorphism p-8 rounded-2xl border border-gray-700">
                    <h2 className="text-3xl font-bold text-center text-white mb-2">Agendar um Horário</h2>
                    <p className="text-center text-gray-400 mb-8">Preencha os dados abaixo para marcar seu horário.</p>

                    {message && (
                        <div className={`p-3 rounded-lg mb-6 text-center text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                            {message.text}
                        </div>
                    )}
                    
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <input type="text" placeholder="Seu Nome" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-gray-900/50 p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-500" />
                            <input type="email" placeholder="Seu Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-900/50 p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-500" />
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-gray-900/50 p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-500" />
                            <input type="time" value={time} onChange={e => setTime(e.target.value)} required className="w-full bg-gray-900/50 p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-500" />
                        </div>
                        <div className="mt-8">
                            <button type="submit" disabled={isSaving} className="w-full px-4 py-3 rounded-lg bg-white text-black font-semibold hover:bg-gray-200 disabled:bg-gray-500 transition-colors">
                                {isSaving ? 'Agendando...' : 'Confirmar Agendamento'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const LoginPage: React.FC = () => {
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) console.error('Erro no login com Google:', error);
  };

  return (
    <div className="h-screen flex flex-col justify-center items-center text-center p-4">
      <h1 className="text-5xl font-bold text-white mb-4">Bem-vindo ao Scheduler Pro</h1>
      <p className="text-xl text-gray-400 mb-12 max-w-2xl">A ferramenta definitiva para gerenciar seus agendamentos com simplicidade e elegância.</p>
      <button onClick={handleLogin} className="bg-white text-black font-semibold px-8 py-4 rounded-lg hover:bg-gray-200 transition-colors flex items-center">
        <svg className="w-6 h-6 mr-3" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
        Entrar com Google
      </button>
    </div>
  );
};

const LoadingScreen: React.FC = () => (
    <div className="h-screen flex justify-center items-center">
        <p className="text-white text-lg">Carregando...</p>
    </div>
);

const ErrorScreen: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
    <div className="h-screen flex flex-col justify-center items-center text-center p-4">
        <h2 className="text-3xl text-white font-bold mb-4">Ocorreu um problema</h2>
        <p className="text-gray-400 mb-8">Não foi possível carregar seu perfil. Isso pode acontecer devido a um problema de sessão.</p>
        <button onClick={onRetry} className="bg-white text-black font-semibold px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors">
            Sair e Tentar Novamente
        </button>
    </div>
);


const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageContent, setPageContent] = useState<React.ReactNode>(null);

  const checkUser = useCallback(async (currentUser: User | null) => {
    if (currentUser) {
      setUser(currentUser);
      const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id);

      if (error || !data || data.length === 0) {
        console.error('Erro ao buscar perfil ou perfil não encontrado:', error);
        setProfile(null);
      } else {
        const userProfile = data[0] as Profile;
        const today = new Date().toISOString().split('T')[0];
        // Reset usage if it's a new day
        if (userProfile.last_usage_date !== today) {
          const { data: updatedProfile, error: updateError } = await supabase
            .from('profiles')
            .update({ daily_usage: 0, last_usage_date: today })
            .eq('id', currentUser.id)
            .select()
            .single();
          
          if (updateError) console.error("Erro ao resetar uso diário:", updateError);
          setProfile(updatedProfile as Profile);
        } else {
          setProfile(userProfile);
        }
      }
    } else {
      setUser(null);
      setProfile(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setLoading(true);
      await checkUser(session?.user ?? null);
    });

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
        setLoading(true);
        checkUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [checkUser]);

  useEffect(() => {
    const path = window.location.pathname.split('/');
    if (path[1] === 'book' && path[2]) {
      setPageContent(<PaginaDeAgendamento userId={path[2]} />);
    } else {
      if (loading) {
        setPageContent(<LoadingScreen />);
      } else if (user && profile) {
        setPageContent(<Dashboard user={user} profile={profile} setProfile={setProfile} />);
      } else if (user && !profile) {
        setPageContent(<ErrorScreen onRetry={() => supabase.auth.signOut()} />);
      } else {
        setPageContent(<LoginPage />);
      }
    }
  }, [user, profile, loading]);
  
  return <>{pageContent}</>;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
