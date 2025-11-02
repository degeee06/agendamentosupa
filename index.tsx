
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

type BusinessProfile = {
    user_id: string;
    blocked_dates: string[]; // ['2024-12-25', '2025-01-01']
    blocked_times: { [key: string]: string[] }; // { 'monday': ['12:00', '12:30'], 'saturday': [] }
    working_days: { [key: string]: boolean }; // { 'monday': true, 'tuesday': false, ... }
}

type User = {
    id: string;
    email?: string;
};

// --- Helpers ---
const parseDateAsUTC = (dateString: string): Date => {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-').map(Number);
    // Month is 0-indexed for Date.UTC
    return new Date(Date.UTC(year, month - 1, day));
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
const SettingsIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></Icon>;
const StarIcon = (props: any) => <Icon {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></Icon>;
const ChevronLeftIcon = (props: any) => <Icon {...props}><polyline points="15 18 9 12 15 6"></polyline></Icon>;
const ChevronRightIcon = (props: any) => <Icon {...props}><polyline points="9 18 15 12 9 6"></polyline></Icon>;


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
            className="absolute top-3 right-3 text-gray-500 hover:text-red-400 transition-colors z-10 p-1"
            aria-label="Excluir agendamento permanentemente"
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

const Modal = ({ isOpen, onClose, title, children, size = 'md' }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, size?: 'md' | 'lg' }) => {
    const sizeClasses = {
        md: 'max-w-md',
        lg: 'max-w-lg'
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

const NewAppointmentModal = ({ isOpen, onClose, onSave, user }: { isOpen: boolean, onClose: () => void, onSave: (name: string, email: string, date: string, time: string) => Promise<void>, user: User }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave(name, email, date, time);
        setIsSaving(false);
        setName(''); setEmail(''); setDate(''); setTime('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Novo Agendamento">
            <form onSubmit={handleSubmit} className="space-y-4">
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

const BusinessProfileModal = ({ isOpen, onClose, userId }: { isOpen: boolean, onClose: () => void, userId: string }) => {
    const [profile, setProfile] = useState<BusinessProfile>({ user_id: userId, blocked_dates: [], blocked_times: {}, working_days: {} });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [newBlockedDate, setNewBlockedDate] = useState('');
    const [newBlockedTime, setNewBlockedTime] = useState('');
    const [selectedDay, setSelectedDay] = useState('monday');

    const daysOfWeek = { monday: "Segunda", tuesday: "Terça", wednesday: "Quarta", thursday: "Quinta", friday: "Sexta", saturday: "Sábado", sunday: "Domingo" };
    const defaultWorkingDays = { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false };

    useEffect(() => {
        if (isOpen) {
            const fetchProfile = async () => {
                setIsLoading(true);
                const { data, error } = await supabase.from('business_profiles').select('*').eq('user_id', userId).single();
                if (data) {
                    setProfile({
                        ...data,
                        blocked_dates: data.blocked_dates || [],
                        blocked_times: data.blocked_times || {},
                        working_days: data.working_days || defaultWorkingDays,
                    });
                } else {
                    setProfile({ user_id: userId, blocked_dates: [], blocked_times: {}, working_days: defaultWorkingDays });
                }
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

    const handleWorkingDayChange = (day: string) => {
        setProfile(p => ({
            ...p,
            working_days: {
                ...p.working_days,
                [day]: !p.working_days[day]
            }
        }));
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
                                        className="h-5 w-5 accent-gray-400 bg-gray-700 border-gray-600 rounded focus:ring-gray-500"
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
                    onClick={(e) => e.preventDefault()}
                    href="https://pay.hotmart.com/U102480243K?checkoutMode=2"
                    className="hotmart-fb hotmart__button-checkout w-full"
                >
                    🚀 Fazer Upgrade Ilimitado
                </a>
            </div>
        </Modal>
    );
};


const PaginaDeAgendamento = ({ adminId }: { adminId: string }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    
    const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
// FIX: The `appointments` state in `PaginaDeAgendamento` was incorrectly typed as `Appointment[]` but was only ever populated with and used for `date` and `time` properties. This has been corrected to `{ date: string; time: string; }[]` to match its actual usage.
    const [appointments, setAppointments] = useState<{ date: string; time: string; }[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const dayMap = useMemo(() => ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], []);

    useEffect(() => {
        const fetchAdminData = async () => {
            setIsLoading(true);
            try {
                const [profileRes, businessProfileRes, appointmentsRes] = await Promise.all([
                    supabase.from('profiles').select('*').eq('id', adminId).single(),
                    supabase.from('business_profiles').select('*').eq('user_id', adminId).single(),
                    supabase.from('appointments').select('date, time').eq('user_id', adminId).in('status', ['Pendente', 'Confirmado'])
                ]);

                if (profileRes.error) throw profileRes.error;
                
                const today = new Date().toISOString().split('T')[0];
                if (profileRes.data.last_usage_date !== today) {
                    setAdminProfile({ ...profileRes.data, daily_usage: 0 });
                } else {
                    setAdminProfile(profileRes.data);
                }

                setAppointments(appointmentsRes.data || []);
                
                const defaultWorkingDays = { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false };
                if (businessProfileRes.data) {
                    setBusinessProfile({
                        ...businessProfileRes.data,
                        blocked_dates: businessProfileRes.data.blocked_dates || [],
                        blocked_times: businessProfileRes.data.blocked_times || {},
                        working_days: businessProfileRes.data.working_days || defaultWorkingDays,
                    });
                } else {
                    setBusinessProfile({ user_id: adminId, blocked_dates: [], blocked_times: {}, working_days: defaultWorkingDays });
                }

            } catch (error) {
                console.error('Erro ao buscar dados do admin:', error);
                setMessage({ type: 'error', text: 'Não foi possível carregar a página de agendamento.' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchAdminData();
    }, [adminId]);

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
        // Generate slots from 9 AM to 5 PM every 30 minutes
        for (let hour = 9; hour < 17; hour++) {
            slots.push(`${String(hour).padStart(2, '0')}:00`);
            slots.push(`${String(hour).padStart(2, '0')}:30`);
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
        if (!selectedDate || !selectedTime) return;

        setMessage(null);
        setIsSaving(true);
        
        const dateString = selectedDate.toISOString().split('T')[0];

        const { data: existingAppointment } = await supabase
            .from('appointments').select('id').eq('user_id', adminId).eq('email', email).in('status', ['Pendente', 'Confirmado']).limit(1);

        if (existingAppointment && existingAppointment.length > 0) {
            setMessage({ type: 'error', text: 'Você já possui um agendamento ativo com este profissional.' });
            setIsSaving(false);
            return;
        }

        if (adminProfile && adminProfile.plan === 'trial' && adminProfile.daily_usage >= 5) {
            setMessage({ type: 'error', text: 'Este profissional atingiu o limite de agendamentos para hoje. Tente novamente amanhã.' });
            setIsSaving(false);
            return;
        }

        const { error } = await supabase.from('appointments').insert({
            name, email, date: dateString, time: selectedTime, user_id: adminId, status: 'Pendente'
        });

        if (error) {
            setMessage({ type: 'error', text: 'Ocorreu um erro ao salvar seu agendamento.' });
        } else {
            if (adminProfile) {
                const today = new Date().toISOString().split('T')[0];
                const newUsage = adminProfile.last_usage_date === today ? adminProfile.daily_usage + 1 : 1;
                await supabase.from('profiles').update({ daily_usage: newUsage, last_usage_date: today }).eq('id', adminId);
            }
            setMessage({ type: 'success', text: 'Agendamento realizado com sucesso!' });
// FIX: The incorrect type assertion `as Appointment` has been removed. The object being added to the state now correctly matches the updated state type.
            setAppointments(prev => [...prev, { date: dateString, time: selectedTime! }]);
            setName(''); setEmail(''); setSelectedDate(null); setSelectedTime(null);
        }
        setIsSaving(false);
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
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {days}
                </div>
            </div>
        );
    };

    if (isLoading) {
        return <div className="min-h-screen bg-black flex justify-center items-center"><LoaderIcon className="w-12 h-12 text-white" /></div>;
    }

    return (
        <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md mx-auto">
                <div className="glassmorphism rounded-2xl p-8">
                    <h1 className="text-3xl font-bold text-center text-white mb-2">Agendar Horário</h1>
                    <p className="text-gray-400 text-center mb-8">Preencha os dados abaixo para confirmar seu horário.</p>

                    {message && <div className={`p-4 rounded-lg mb-4 text-center ${message.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{message.text}</div>}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <input type="text" placeholder="Seu Nome" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" />
                        <input type="email" placeholder="Seu Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-black/20 border border-gray-600 rounded-lg p-3 text-white" />
                        
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

                        <button type="submit" disabled={isSaving || !selectedDate || !selectedTime || !name || !email} className="w-full bg-gray-200 text-black font-bold py-3 px-4 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);


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

    const handleSaveAppointment = async (name: string, email: string, date: string, time: string) => {
        if (!profile) return;
        
        if (hasReachedLimit) {
            setIsUpgradeModalOpen(true);
            return;
        }

        const { data, error } = await supabase
            .from('appointments')
            .insert({ name, email, date, time, user_id: user.id })
            .select()
            .single();

        if (error) {
            console.error('Erro ao salvar:', error);
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
            if (profileError) {
                console.error("Erro ao atualizar perfil:", profileError);
            } else if (updatedProfile) {
                setProfile(updatedProfile);
                if (updatedProfile.plan === 'trial' && updatedProfile.daily_usage >= TRIAL_LIMIT) {
                    setIsUpgradeModalOpen(true);
                }
            }
        }
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

    const handleDeleteAppointment = async (id: string) => {
        const isConfirmed = window.confirm('Tem certeza que deseja excluir este agendamento? Esta ação é permanente e não pode ser desfeita.');
        if (isConfirmed) {
            const { error } = await supabase
                .from('appointments')
                .delete()
                .eq('id', id);
    
            if (error) {
                console.error("Erro ao excluir agendamento:", error);
                // Você pode adicionar um alerta para o usuário aqui, se desejar
            } else {
                setAppointments(prev => prev.filter(app => app.id !== id));
            }
        }
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
                {profile?.plan === 'premium' ? (
                    <div className="glassmorphism py-2 px-4 rounded-lg text-sm flex items-center space-x-2 bg-green-500/20 border border-green-400/30">
                        <StarIcon className="w-5 h-5 text-yellow-400" />
                        <span className="font-bold text-white">Plano Premium</span>
                    </div>
                ) : (
                    <div className="glassmorphism py-2 px-4 rounded-lg text-sm flex items-center space-x-3">
                        <span className="font-bold text-white">{`Plano Trial: ${usage}/${TRIAL_LIMIT} usos hoje`}</span>
                        <a
                            href="https://pay.hotmart.com/U102480243K?checkoutMode=2"
                            onClick={(e) => e.preventDefault()}
                            className="hotmart-fb hotmart__button-checkout"
                        >
                            UPGRADE
                        </a>
                    </div>
                )}
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
                        <span>Novo Agendamento</span>
                    </button>
                </div>
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
                    {filteredAppointments.map(app => <AppointmentCard key={app.id} appointment={app} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteAppointment}/>)}
                </div>
             )}
          </div>
        </main>

        <NewAppointmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveAppointment} user={user} />
        <LinkGeneratorModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} userId={user.id} />
        <BusinessProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} userId={user.id} />
        <UpgradeModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} limit={TRIAL_LIMIT} />
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
              const { data: userProfile, error } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', currentUser.id)
                  .single();

              if (error) {
                  console.error("Erro ao buscar perfil:", error);
              } else if (userProfile) {
                  const today = new Date().toISOString().split('T')[0];
                  if (userProfile.last_usage_date !== today && userProfile.plan === 'trial') {
                      // Reset usage if it's a new day for trial users
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

    const router = useMemo(() => {
        const pathParts = path.split('/').filter(Boolean);
        if (pathParts[0] === 'book' && pathParts[1]) {
            return <PaginaDeAgendamento adminId={pathParts[1]} />;
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
