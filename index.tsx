import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import Modal from './components/Modal';
import { LoaderIcon, CheckCircleIcon, LogOutIcon, LinkIcon, XIcon } from './components/icons';
import { BusinessProfile } from './types';
import { User } from '@supabase/supabase-js';
import { parseDateAsUTC, maskPhone } from './utils';

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
