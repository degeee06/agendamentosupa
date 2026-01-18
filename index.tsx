
import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { RevenueCatUI, PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const REVENUECAT_API_KEY_ANDROID = import.meta.env.VITE_REVENUECAT_ANDROID_KEY || "test_tPLkutsSqzCqknrDsjizNHfoZIc";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(`Variáveis do Supabase ausentes.`);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Tipos
type Appointment = {
  id: string;
  name: string;
  date: string;
  time: string;
  user_id: string;
};

type Profile = {
    id: string;
    plan: 'trial' | 'premium';
    daily_usage: number;
};

type User = {
    id: string;
    email?: string;
};

// --- Ícones ---
const Icon = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{children}</svg>
);
const CalendarIcon = (props: any) => <Icon {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></Icon>;
const StarIcon = (props: any) => <Icon {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></Icon>;
const LoaderIcon = (props: any) => <Icon {...props} className="animate-spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line></Icon>;
const XIcon = (props: any) => <Icon {...props}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></Icon>;

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children?: React.ReactNode }) => (
    <div className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}>
        <div className={`glassmorphism w-full max-w-md rounded-2xl p-6 border border-gray-700 relative transition-transform ${isOpen ? 'scale-100' : 'scale-95'}`} onClick={(e) => e.stopPropagation()}>
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white"><XIcon className="w-6 h-6" /></button>
            <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>
            {children}
        </div>
    </div>
);

// --- Dashboard ---
const Dashboard = ({ user, profile, setProfile }: { user: User, profile: Profile | null, setProfile: React.Dispatch<React.SetStateAction<Profile | null>>}) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    
    const isPremium = profile?.plan === 'premium';

    const handleUpgrade = async () => {
        try {
            if (!Capacitor.isNativePlatform()) {
                alert("O Paywall só pode ser visualizado no dispositivo físico.");
                return;
            }

            // Uso do RevenueCatUI conforme o novo SDK
            const { result } = await RevenueCatUI.presentPaywall();

            if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
                // Notifica o backend para atualizar o status do usuário
                await supabase.functions.invoke('verify-google-purchase');
                
                setProfile(prev => prev ? { ...prev, plan: 'premium' } : null);
                setIsUpgradeModalOpen(false);
                alert("Assinatura confirmada! Bem-vindo ao Premium.");
            }
        } catch (e) {
            console.error("Erro no Paywall:", e);
        }
    };

    useEffect(() => {
        const fetchAppointments = async () => {
            const { data } = await supabase.from('appointments').select('*').eq('user_id', user.id).order('date', { ascending: false });
            if (data) setAppointments(data);
        };
        fetchAppointments();
    }, [user.id]);

    return (
        <div className="flex flex-col h-screen bg-black">
            <header className="glassmorphism p-6 flex justify-between items-center border-b border-gray-800">
                <div className="flex items-center gap-2">
                    <CalendarIcon className="w-8 h-8 text-white" />
                    <h1 className="text-2xl font-bold">Oubook</h1>
                </div>
                <div>
                    {isPremium ? (
                        <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <StarIcon className="w-3 h-3" /> PREMIUM
                        </div>
                    ) : (
                        <button onClick={() => setIsUpgradeModalOpen(true)} className="bg-yellow-500 text-black px-4 py-2 rounded-lg text-xs font-bold">
                            UPGRADE
                        </button>
                    )}
                </div>
            </header>

            <main className="p-6 overflow-y-auto flex-1">
                <h2 className="text-xl font-bold mb-6">Meus Agendamentos</h2>
                <div className="grid gap-4">
                    {appointments.map(app => (
                        <div key={app.id} className="glassmorphism p-4 rounded-xl border border-gray-800">
                            <h3 className="font-bold">{app.name}</h3>
                            <p className="text-sm text-gray-400">{app.date} às {app.time}</p>
                        </div>
                    ))}
                </div>
            </main>

            <Modal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} title="Seja Premium">
                <div className="text-center">
                    <StarIcon className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <p className="text-gray-300 mb-6">Agendamentos ilimitados e recursos exclusivos para o seu negócio.</p>
                    <button onClick={handleUpgrade} className="w-full bg-yellow-500 text-black font-bold py-4 rounded-xl shadow-lg">
                        VER PLANOS
                    </button>
                </div>
            </Modal>
        </div>
    );
};

// --- App Root ---
const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function init() {
            try {
                // 1. Configura RevenueCat conforme snippet do SDK
                if (Capacitor.isNativePlatform()) {
                    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
                    const platform = Capacitor.getPlatform();
                    
                    // Substitua pela sua chave real no Dashboard do RevenueCat
                    await Purchases.configure({ apiKey: REVENUECAT_API_KEY_ANDROID });
                }

                // 2. Auth do Supabase
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                    
                    // 3. Checa Entitlement (Assinatura Ativa)
                    if (Capacitor.isNativePlatform()) {
                        const { customerInfo } = await Purchases.getCustomerInfo();
                        
                        // "premium" deve ser o ID do Entitlement configurado no Dashboard
                        // O snippet sugeriu: customerInfo.entitlements.active["OUJ4Y Pro"]
                        const entitlementId = "premium"; 

                        if (typeof customerInfo.entitlements.active[entitlementId] !== "undefined") {
                            if (prof && prof.plan !== 'premium') {
                                // Sincroniza banco de dados caso o usuário tenha assinado mas o DB não saiba
                                await supabase.from('profiles').update({ plan: 'premium' }).eq('id', session.user.id);
                                prof.plan = 'premium';
                            }
                        }
                    }

                    setUser({ id: session.user.id, email: session.user.email });
                    setProfile(prof);
                }
            } catch (e) {
                console.error("Erro no carregamento inicial:", e);
            } finally {
                setIsLoading(false);
            }
        }
        init();
    }, []);

    if (isLoading) return <div className="min-h-screen bg-black flex justify-center items-center"><LoaderIcon className="w-12 h-12 text-white" /></div>;
    
    return user && profile ? (
        <Dashboard user={user} profile={profile} setProfile={setProfile} />
    ) : (
        <div className="p-10 text-center">Aguardando login...</div>
    );
};

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
