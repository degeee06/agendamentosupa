
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './supabase';
import { Profile, AttendanceRecord, Attendance, DayKey } from './types';
import AuthView from './components/AuthView';
import Header from './components/Header';
import CurrentWeekView from './components/CurrentWeekView';
import HistoryView from './components/HistoryView';
import EmployeeWeekView from './components/EmployeeWeekView';
import ManageUsersView from './components/ManageUsersView';
import { CalendarIcon, HistoryIcon, UsersIcon } from './components/icons';

// Function to get ISO week number (e.g., 2024-W42)
export const getWeekId = (date: Date): string => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

function getPastWeeksIds(numWeeks: number): string[] {
    const ids = [];
    const today = new Date();
    for(let i=0; i < numWeeks; i++){
        const pastDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (i * 7));
        ids.push(getWeekId(pastDate));
    }
    return ids;
}


function App() {
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekId] = useState<string>(getWeekId(new Date()));
  const [view, setView] = useState<'current' | 'history' | 'manage_users'>('current');

const fetchData = useCallback(async (currentSession: any) => {
  try {
    setLoading(true);
    
    // 1. Primeiro busca APENAS o próprio perfil (sempre funciona com RLS)
    const { data: userProfileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentSession.user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      throw profileError;
    }
    
    if (!userProfileData) {
      console.error(`Inconsistent state: User ${currentSession.user.id} authenticated but profile is missing.`);
      alert("Erro: Seu perfil não foi encontrado. Por favor, tente se cadastrar novamente ou contate o suporte. Você será desconectado.");
      await (supabase.auth as any).signOut();
      setLoading(false);
      return;
    }

    setProfile(userProfileData);

    // 2. Se for admin, tenta buscar dados adicionais
    if (userProfileData.role === 'admin' || userProfileData.role === 'super_admin') {
      try {
        // Tenta buscar todos os profiles (se política de admin funcionar)
        const { data: allProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true });
        
        if (profilesError) {
          console.warn('Admin cannot fetch all profiles, using own profile only:', profilesError);
          setProfiles([userProfileData]);
        } else {
          setProfiles(allProfiles || []);
        }

        // Busca attendances sem filtro (admin pode ver tudo se política funcionar)
        const recentWeeks = getPastWeeksIds(8);
        const { data: recentAttendances, error: attendancesError } = await supabase
          .from('attendances')
          .select('*')
          .in('week_id', recentWeeks);

        if (attendancesError) {
          console.warn('Admin cannot fetch all attendances:', attendancesError);
          setAttendanceRecords([]);
        } else {
          setAttendanceRecords(recentAttendances || []);
        }

      } catch (adminError) {
        console.error('Admin data fetch failed, using fallback:', adminError);
        // Fallback: usa apenas dados básicos
        setProfiles([userProfileData]);
        setAttendanceRecords([]);
      }
    } else {
      // 3. Usuário normal - apenas seus dados (sempre funciona com RLS)
      setProfiles([userProfileData]);
      
      // Apenas suas próprias attendances
      const recentWeeks = getPastWeeksIds(8);
      const { data: userAttendances, error: attendancesError } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', currentSession.user.id)  // 🔥 CRÍTICO: filtra por user_id
        .in('week_id', recentWeeks);

      if (attendancesError) {
        console.error('User attendances fetch error:', attendancesError);
        setAttendanceRecords([]);
      } else {
        setAttendanceRecords(userAttendances || []);
      }
    }

  } catch (error) {
    console.error('Error fetching data:', error);
    alert('Falha ao carregar os dados.');
  } finally {
    setLoading(false);
  }
}, []);

  // Auth listener
  useEffect(() => {
    // Handling v1/v2 compatibility
    const authAny = supabase.auth as any;
    
    const initSession = async () => {
        let sessionData = null;
        if (typeof authAny.getSession === 'function') {
            const { data } = await authAny.getSession();
            sessionData = data.session;
        } else if (typeof authAny.session === 'function') {
            sessionData = authAny.session();
        }

        setSession(sessionData);
        if (sessionData) {
            fetchData(sessionData);
        } else {
            setLoading(false);
        }
    };
    initSession();

    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange((_event: any, session: any) => {
      setSession(session);
      if (session) {
        fetchData(session);
      } else {
        setProfile(null);
        setProfiles([]);
        setAttendanceRecords([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchData]);

  // Realtime listener for profile changes (for admin)
  useEffect(() => {
    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') return;

    const channel = supabase
      .channel('profiles-changes')
      .on<Profile>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
            if (payload.eventType === 'INSERT') {
                setProfiles((currentProfiles) => 
                  [...currentProfiles, payload.new]
                  .sort((a, b) => a.full_name.localeCompare(b.full_name))
                );
            } else if (payload.eventType === 'UPDATE') {
                setProfiles((currentProfiles) =>
                    currentProfiles.map(p => p.id === payload.new.id ? payload.new : p)
                );
            } else if (payload.eventType === 'DELETE') {
                const deletedProfileId = (payload.old as { id: string }).id;
                setProfiles((currentProfiles) =>
                    currentProfiles.filter(p => p.id !== deletedProfileId)
                );
            }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  // Realtime listener for attendance changes
  useEffect(() => {
    // FIX: Only subscribe after the initial load is complete and we have a session.
    // This prevents a race condition where realtime updates are overwritten by the initial fetch.
    if (loading || !session) {
      return;
    }

    const channel = supabase
      .channel('attendances-changes')
      .on<AttendanceRecord>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendances' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAttendanceRecords(prev => 
              [...prev.filter(r => !(r.user_id === payload.new.user_id && r.week_id === payload.new.week_id && r.day === payload.new.day)), payload.new]
            );
          } else if (payload.eventType === 'UPDATE') {
            setAttendanceRecords(prev =>
              prev.map(r => (r.user_id === payload.new.user_id && r.week_id === payload.new.week_id && r.day === payload.new.day) ? payload.new : r)
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedRecord = payload.old as { user_id: string; week_id: string; day: DayKey };
            if (deletedRecord.user_id && deletedRecord.week_id && deletedRecord.day) {
                setAttendanceRecords(prev =>
                  prev.filter(r => !(r.user_id === deletedRecord.user_id && r.week_id === deletedRecord.week_id && r.day === deletedRecord.day))
                );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, loading]); // Depend on 'loading' to trigger subscription after fetch is done.


  const handleLogout = async () => {
    const { error } = await (supabase.auth as any).signOut();
    if (error) {
      console.error("Error signing out:", error);
      if (error.name === 'AuthSessionMissingError') {
        console.warn('Session was already missing on sign out. Clearing state manually.');
        setSession(null);
        setProfile(null);
        setProfiles([]);
        setAttendanceRecords([]);
      } else {
        alert("Ocorreu um erro ao sair. Por favor, tente novamente.");
      }
    }
  };
  
  const attendanceData: Attendance = useMemo(() => {
    return attendanceRecords.reduce<Attendance>((acc, record) => {
      if (!acc[record.user_id]) {
        acc[record.user_id] = {};
      }
      acc[record.user_id][record.day] = record.is_present;
      return acc;
    }, {});
  }, [attendanceRecords]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex justify-center items-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthView />;
  }
  
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-7xl">
      <Header session={session} profile={profile} onLogout={handleLogout} />
      <main>
        {isAdmin ? (
          <>
            <nav className="mb-6 flex justify-around sm:justify-center border-b border-gray-700">
              <button
                onClick={() => setView('current')}
                className={`px-2 sm:px-4 py-2 font-semibold transition-colors ${view === 'current' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}
              >
                <span className="flex items-center gap-2"><CalendarIcon /> <span className="hidden sm:inline">Semana Atual</span></span>
              </button>
              <button
                onClick={() => setView('history')}
                className={`px-2 sm:px-4 py-2 font-semibold transition-colors ${view === 'history' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}
              >
                 <span className="flex items-center gap-2"><HistoryIcon /> <span className="hidden sm:inline">Histórico</span></span>
              </button>
              <button
                onClick={() => setView('manage_users')}
                className={`px-2 sm:px-4 py-2 font-semibold transition-colors ${view === 'manage_users' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}
              >
                 <span className="flex items-center gap-2"><UsersIcon /> <span className="hidden sm:inline">Gerenciar Usuários</span></span>
              </button>
            </nav>
            {view === 'current' && (
              <CurrentWeekView
                profiles={profiles}
                attendance={attendanceData}
                attendanceRecords={attendanceRecords}
                setAttendanceRecords={setAttendanceRecords}
                currentWeekId={currentWeekId}
                isAdmin={isAdmin}
                adminProfile={profile}
              />
            )}
            {view === 'history' && <HistoryView allProfiles={profiles} allAttendances={attendanceRecords} />}
            {view === 'manage_users' && (
              <ManageUsersView
                profiles={profiles}
                setProfiles={setProfiles}
                currentUserProfile={profile}
              />
            )}
          </>
        ) : (
          <EmployeeWeekView
            profile={profile}
            attendance={attendanceData}
            attendanceRecords={attendanceRecords}
            setAttendanceRecords={setAttendanceRecords}
            currentWeekId={currentWeekId}
          />
        )}
      </main>
    </div>
  );
}

export default App;
