import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO SUPABASE ---
const supabaseUrl = 'https://ehosmvbealefukkbqggp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVob3NtdmJlYWxlZnVra2JxZ2dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMjIzMDgsImV4cCI6MjA3NzU5ODMwOH0.IKqwxawiPnZT__Djj6ISgnQOawKnbboJ1TfqhSTf89M';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- TIPOS ---
type Appointment = {
  id: string;
  name: string;
  email: string;
  date: string;
  time: string;
  status: 'Pendente' | 'Confirmado' | 'Cancelado';
  user_id: string;
};

type User = {
  id: string;
  email?: string;
  user_metadata: {
    avatar_url?: string;
    full_name?: string;
  }
};

type Session = {
  access_token: string;
  user: User;
};


// --- COMPONENTES DE ÍCONES ---
const Icon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    {...props}
  />
);

const HomeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon {...props}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Icon>;
const CalendarIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></Icon>;
const LinkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" /></Icon>;
const SettingsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></Icon>;
const LogOutIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></Icon>;
const PlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon {...props}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Icon>;
const CheckIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon {...props}><polyline points="20 6 9 17 4 12" /></Icon>;
const XIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon {...props}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Icon>;
const ClockIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon {...props}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Icon>;
const UserIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Icon>;
const MailIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon {...props}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></Icon>;
const CopyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Icon>;


// --- PÁGINA DE LOGIN ---
const LoginPage = () => {
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      console.error('Erro no login com Google:', error.message);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="text-center p-8 glassmorphism rounded-xl max-w-md w-full">
        <h1 className="text-3xl font-bold text-white mb-2">Bem-vindo(a)</h1>
        <p className="text-gray-400 mb-8">Faça login para gerenciar seus agendamentos.</p>
        <button
          onClick={handleGoogleLogin}
          className="w-full bg-white text-black font-semibold py-3 px-6 rounded-lg flex items-center justify-center space-x-2 hover:bg-gray-200 transition-colors"
        >
          <svg className="w-6 h-6" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.35 6.52C12.91 13.46 18.06 9.5 24 9.5z"></path>
            <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6.02C44.19 39.42 46.98 32.77 46.98 24.55z"></path>
            <path fill="#FBBC05" d="M10.91 28.74c-.52-1.57-.82-3.24-.82-5.04s.3-3.47.82-5.04l-8.35-6.52C.99 15.65 0 19.72 0 24c0 4.28.99 8.35 2.56 12.26l8.35-6.52z"></path>
            <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6.02c-2.17 1.45-4.92 2.3-8.16 2.3-5.94 0-11.09-3.96-12.91-9.28l-8.35 6.52C6.51 42.62 14.62 48 24 48z"></path>
            <path fill="none" d="M0 0h48v48H0z"></path>
          </svg>
          <span>Entrar com Google</span>
        </button>
      </div>
    </div>
  );
};


// --- COMPONENTES DO DASHBOARD ---
const Sidebar: React.FC<{ user: User | null; onLinkClick: () => void }> = ({ user, onLinkClick }) => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="w-64 bg-[#111] p-4 flex flex-col fixed h-full">
      <h1 className="text-2xl font-bold text-white mb-10">AgendaSupa</h1>
      <nav className="flex flex-col space-y-2 flex-grow">
        <a href="#" className="flex items-center space-x-3 p-3 text-gray-300 rounded-lg bg-gray-700/50">
          <HomeIcon className="w-5 h-5" />
          <span>Início</span>
        </a>
        <a href="#" className="flex items-center space-x-3 p-3 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors">
          <CalendarIcon className="w-5 h-5" />
          <span>Agendamentos</span>
        </a>
        <button onClick={onLinkClick} className="flex items-center space-x-3 p-3 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors w-full text-left">
          <LinkIcon className="w-5 h-5" />
          <span>Links de Reserva</span>
        </button>
        <a href="#" className="flex items-center space-x-3 p-3 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors">
          <SettingsIcon className="w-5 h-5" />
          <span>Configurações</span>
        </a>
      </nav>
      <div className="mt-auto">
        {user && (
          <div className="flex items-center space-x-3 p-2">
            <img src={user.user_metadata.avatar_url} alt="User Avatar" className="w-10 h-10 rounded-full" />
            <div className="flex-grow">
              <p className="text-sm font-semibold text-white">{user.user_metadata.full_name}</p>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-white">
              <LogOutIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const AppointmentCard: React.FC<{ appointment: Appointment, onUpdate: (id: string, status: 'Confirmado' | 'Cancelado') => void }> = ({ appointment, onUpdate }) => {
  const statusColors = {
    Pendente: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Confirmado: 'bg-green-500/20 text-green-400 border-green-500/30',
    Cancelado: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const formattedDate = new Date(appointment.date + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="glassmorphism p-5 rounded-xl flex flex-col space-y-4 hover:border-gray-500 transition-all">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-lg text-white">{appointment.name}</h3>
          <p className="text-sm text-gray-400">{appointment.email}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${statusColors[appointment.status]}`}>
          {appointment.status}
        </span>
      </div>
      <div className="border-t border-gray-700/50 my-2"></div>
      <div className="flex items-center justify-between text-gray-300">
        <div className="flex items-center space-x-2">
          <CalendarIcon className="w-4 h-4" />
          <span className="text-sm">{formattedDate}</span>
        </div>
        <div className="flex items-center space-x-2">
          <ClockIcon className="w-4 h-4" />
          <span className="text-sm">{appointment.time}</span>
        </div>
      </div>
      {appointment.status === 'Pendente' && (
        <div className="flex space-x-2 pt-2">
            <button onClick={() => onUpdate(appointment.id, 'Confirmado')} className="flex-1 bg-green-500/20 text-green-400 py-2 rounded-lg text-sm font-semibold hover:bg-green-500/40 transition-colors flex items-center justify-center space-x-1">
                <CheckIcon className="w-4 h-4"/>
                <span>Confirmar</span>
            </button>
            <button onClick={() => onUpdate(appointment.id, 'Cancelado')} className="flex-1 bg-red-500/20 text-red-400 py-2 rounded-lg text-sm font-semibold hover:bg-red-500/40 transition-colors flex items-center justify-center space-x-1">
                <XIcon className="w-4 h-4"/>
                <span>Cancelar</span>
            </button>
        </div>
      )}
    </div>
  );
};

const NewAppointmentModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (name: string, email: string, date: string, time: string) => Promise<void> }> = ({ isOpen, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave(name, email, date, time);
        setIsSaving(false);
        onClose();
        setName(''); setEmail(''); setDate(''); setTime('');
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="glassmorphism p-8 rounded-2xl w-full max-w-md m-4">
                <h2 className="text-2xl font-bold mb-6 text-white">Novo Agendamento</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm text-gray-400 block mb-1">Nome Completo</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full bg-[#111] p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-c-gray-500" />
                    </div>
                    <div>
                        <label className="text-sm text-gray-400 block mb-1">Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-[#111] p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-500" />
                    </div>
                    <div className="flex space-x-4">
                        <div className="flex-1">
                            <label className="text-sm text-gray-400 block mb-1">Data</label>
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full bg-[#111] p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-500" />
                        </div>
                        <div className="flex-1">
                            <label className="text-sm text-gray-400 block mb-1">Horário</label>
                            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className="w-full bg-[#111] p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-500" />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-4 pt-4">
                        <button type="button" onClick={onClose} className="py-2 px-5 text-gray-300 rounded-lg hover:bg-gray-700/50">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="py-2 px-5 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-50">
                            {isSaving ? 'Salvando...' : 'Salvar Agendamento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const LinkGeneratorModal: React.FC<{ isOpen: boolean; onClose: () => void; userId: string | undefined }> = ({ isOpen, onClose, userId }) => {
    const [copied, setCopied] = useState(false);
    if (!isOpen) return null;

    const bookingLink = `${window.location.origin}/book/${userId}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(bookingLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="glassmorphism p-8 rounded-2xl w-full max-w-lg m-4 text-center">
                <h2 className="text-2xl font-bold mb-4 text-white">Seu Link de Agendamento</h2>
                <p className="text-gray-400 mb-6">Compartilhe este link com seus clientes para que eles possam agendar um horário com você.</p>
                
                <div className="bg-[#111] p-4 rounded-lg flex items-center justify-between border border-gray-700 mb-6">
                    <span className="text-gray-300 truncate">{bookingLink}</span>
                    <button onClick={handleCopy} className="text-sm bg-gray-600/50 px-3 py-1 rounded-md hover:bg-gray-500/50 flex items-center space-x-2">
                        <CopyIcon className="w-4 h-4" />
                        <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                </div>

                <button onClick={onClose} className="py-2 px-5 bg-white text-black font-semibold rounded-lg hover:bg-gray-200">
                    Fechar
                </button>
            </div>
        </div>
    );
};


const Dashboard = ({ user }: { user: User }) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [filter, setFilter] = useState<'Todos' | 'Pendente' | 'Confirmado' | 'Cancelado'>('Todos');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isNewAppointmentModalOpen, setIsNewAppointmentModalOpen] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

    const fetchAppointments = useCallback(async () => {
        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .order('date', { ascending: false })
            .order('time', { ascending: false });

        if (error) {
            setError('Não foi possível carregar os agendamentos.');
            console.error(error);
        } else {
            setAppointments(data as Appointment[]);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchAppointments();
        const interval = setInterval(fetchAppointments, 15000); // Polling a cada 15 segundos
        return () => clearInterval(interval);
    }, [fetchAppointments]);

    const handleSaveAppointment = async (name: string, email: string, date: string, time: string) => {
        const { data, error } = await supabase
            .from('appointments')
            .insert([{ name, email, date, time, status: 'Pendente', user_id: user.id }])
            .select();
        
        if (error) {
            alert('Erro ao salvar agendamento!');
        } else if (data) {
            // Atualiza a lista imediatamente
            setAppointments(prev => [data[0] as Appointment, ...prev]);
        }
    };

    const handleUpdateStatus = async (id: string, status: 'Confirmado' | 'Cancelado') => {
        const { data, error } = await supabase
            .from('appointments')
            .update({ status })
            .eq('id', id)
            .select();
        
        if (error) {
            alert('Erro ao atualizar status!');
        } else if (data) {
            setAppointments(prev => prev.map(app => app.id === id ? { ...app, status } : app));
        }
    };

    const filteredAppointments = useMemo(() => {
        return appointments
            .filter(app => filter === 'Todos' || app.status === filter)
            .filter(app =>
                app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [appointments, filter, searchTerm]);

    return (
        <div className="flex h-screen bg-black">
            <Sidebar user={user} onLinkClick={() => setIsLinkModalOpen(true)} />
            <main className="flex-1 ml-64 p-8 overflow-y-auto scrollbar-hide">
                <header className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold text-white">Agendamentos</h2>
                    <div className="flex items-center space-x-4">
                        <div className="text-right">
                           <p className="text-sm font-semibold text-white">Plano Trial</p>
                           <p className="text-xs text-gray-400">0/5 usos hoje</p>
                        </div>
                        <button 
                            onClick={() => setIsNewAppointmentModalOpen(true)}
                            className="bg-white text-black font-semibold py-2 px-4 rounded-lg flex items-center space-x-2 hover:bg-gray-200"
                        >
                            <PlusIcon className="w-5 h-5" />
                            <span>Novo Agendamento</span>
                        </button>
                    </div>
                </header>

                <div className="mb-6 flex justify-between items-center">
                    <div className="flex space-x-1 glassmorphism p-1 rounded-lg">
                        {(['Todos', 'Pendente', 'Confirmado', 'Cancelado'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                                    filter === f ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800/50'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="w-full max-w-xs">
                        <input
                            type="text"
                            placeholder="Buscar por nome ou email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-[#1C1C1E] p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-500 placeholder-gray-500"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-10">Carregando agendamentos...</div>
                ) : error ? (
                    <div className="text-center py-10 text-red-500">{error}</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredAppointments.length > 0 ? (
                            filteredAppointments.map(app => <AppointmentCard key={app.id} appointment={app} onUpdate={handleUpdateStatus}/>)
                        ) : (
                            <p className="col-span-full text-center text-gray-500 py-10">Nenhum agendamento encontrado.</p>
                        )}
                    </div>
                )}
            </main>
            <NewAppointmentModal 
                isOpen={isNewAppointmentModalOpen} 
                onClose={() => setIsNewAppointmentModalOpen(false)}
                onSave={handleSaveAppointment}
            />
            <LinkGeneratorModal 
                isOpen={isLinkModalOpen}
                onClose={() => setIsLinkModalOpen(false)}
                userId={user?.id}
            />
        </div>
    );
};

// --- PÁGINA PÚBLICA DE AGENDAMENTO ---
const PaginaDeAgendamento = () => {
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);

    useEffect(() => {
        const pathParts = window.location.pathname.split('/');
        const id = pathParts[pathParts.length - 1];
        if (id) {
            setUserId(id);
        }
    }, []);

    const handleAgendamentoSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        const name = formData.get('name') as string;
        const email = formData.get('email') as string;
        const date = formData.get('date') as string;
        const time = formData.get('time') as string;

        if (!userId) {
            setError("ID do proprietário não encontrado. Não é possível agendar.");
            setIsLoading(false);
            return;
        }

        const { error: insertError } = await supabase
            .from('appointments')
            .insert([{ name, email, date, time, status: 'Pendente', user_id: userId }]);

        if (insertError) {
            setError("Ocorreu um erro ao salvar seu agendamento. Tente novamente.");
            console.error(insertError);
        } else {
            setSuccess(true);
            (e.target as HTMLFormElement).reset();
        }
        setIsLoading(false);
    };
    
    return (
        <div className="flex items-center justify-center min-h-screen bg-black p-4">
            <div className="w-full max-w-md">
                <div className="glassmorphism p-8 rounded-2xl">
                    <h1 className="text-3xl font-bold text-white text-center mb-2">Marcar Horário</h1>
                    <p className="text-gray-400 text-center mb-8">Preencha os campos abaixo para agendar.</p>
                    {success ? (
                         <div className="text-center bg-green-500/20 text-green-400 p-4 rounded-lg">
                            <h3 className="font-bold">Agendamento Enviado!</h3>
                            <p className="text-sm">Seu horário foi solicitado com sucesso. Aguarde a confirmação.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleAgendamentoSubmit} className="space-y-5">
                            <div>
                                <label className="text-sm text-gray-400 block mb-1.5" htmlFor="name">Nome Completo</label>
                                <div className="relative">
                                    <UserIcon className="w-5 h-5 text-gray-500 absolute top-1/2 left-3 -translate-y-1/2" />
                                    <input id="name" name="name" type="text" required className="w-full bg-[#111] p-3 pl-10 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-500" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 block mb-1.5" htmlFor="email">Email</label>
                                <div className="relative">
                                    <MailIcon className="w-5 h-5 text-gray-500 absolute top-1/2 left-3 -translate-y-1/2" />
                                    <input id="email" name="email" type="email" required className="w-full bg-[#111] p-3 pl-10 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-500" />
                                </div>
                            </div>
                            <div className="flex space-x-4">
                                <div className="flex-1">
                                    <label className="text-sm text-gray-400 block mb-1.5" htmlFor="date">Data</label>
                                    <input id="date" name="date" type="date" required className="w-full bg-[#111] p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-500" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-sm text-gray-400 block mb-1.5" htmlFor="time">Horário</label>
                                    <input id="time" name="time" type="time" required className="w-full bg-[#111] p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-500" />
                                </div>
                            </div>
                            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                            <div className="pt-2">
                                <button type="submit" disabled={isLoading} className="w-full py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors">
                                    {isLoading ? 'Enviando...' : 'Confirmar Agendamento'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- COMPONENTE PRINCIPAL E ROTEAMENTO ---
const App = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [isBookingPage, setIsBookingPage] = useState(false);

    useEffect(() => {
        // Roteamento simples baseado na URL
        if (window.location.pathname.startsWith('/book/')) {
            setIsBookingPage(true);
            setLoading(false);
        } else {
            // Lógica de autenticação para a página principal
            const getSession = async () => {
                const { data: { session } } = await supabase.auth.getSession();
                setSession(session as Session | null);
                setLoading(false);
            };
            getSession();

            const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
                setSession(session as Session | null);
            });

            return () => {
                authListener.subscription.unsubscribe();
            };
        }
    }, []);

    if (loading) {
        return <div className="h-screen bg-black flex items-center justify-center text-white">Carregando...</div>;
    }
    
    if (isBookingPage) {
        return <PaginaDeAgendamento />;
    }

    if (session && session.user) {
        return <Dashboard user={session.user} />;
    }
    
    return <LoginPage />;
};


const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
