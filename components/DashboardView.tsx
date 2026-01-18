import React, { useState, useMemo } from 'react';
// FIX: Imported Appointment from the common types file where it is now exported.
import { Appointment } from '../types';
import { supabase } from '../supabase';
import { CheckIcon, XIcon, SearchIcon } from './icons';
import Modal from './Modal';

interface DashboardViewProps {
  appointments: Appointment[];
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
}

// FIX: Added a return statement and properly completed the component logic to resolve the 'void' return error.
const DashboardView: React.FC<DashboardViewProps> = ({ appointments, setAppointments }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastLinkId, setLastLinkId] = useState<string | null>(null);

  const dailyAppointments = useMemo(() => {
    return appointments.filter(a => a.date === selectedDate);
  }, [appointments, selectedDate]);

  const handleUpdateStatus = async (id: string, newStatus: Appointment['status']) => {
    const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
    if (!error) {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    }
  };

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.from('one_time_links').insert({ user_id: user.id }).select().single();
      if (error) throw error;
      
      const link = `${window.location.origin}/book/${data.id}`;
      setLastLinkId(data.id);
      alert(`Link de agendamento gerado: ${link}`);
    } catch (e: any) {
      console.error(e);
      alert("Erro ao gerar link de agendamento.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard de Agendamentos</h2>
          <p className="text-gray-400 text-sm">Gerencie seus compromissos e links de reserva.</p>
        </div>
        <button 
          onClick={handleGenerateLink}
          disabled={isGenerating}
          className="bg-white text-black font-bold py-2 px-6 rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          <SearchIcon /> {isGenerating ? 'Gerando...' : 'Gerar Link Público'}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-full sm:w-auto">
          <label className="block text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider">Filtrar por data</label>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-gray-700 text-white p-2 rounded-lg border border-gray-600 focus:ring-2 focus:ring-brand-primary outline-none"
          />
        </div>
        <div className="flex-1" />
        <div className="text-right">
          <p className="text-gray-400 text-sm">Total no dia: <span className="text-white font-bold">{dailyAppointments.length}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {dailyAppointments.length > 0 ? (
          dailyAppointments.map(app => (
            <div key={app.id} className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl hover:border-gray-600 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{app.name}</h3>
                  <p className="text-gray-400 text-sm">{app.email || 'Sem e-mail'}</p>
                </div>
                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md ${
                  app.status === 'Confirmado' ? 'bg-green-500/20 text-green-400' :
                  app.status === 'Cancelado' ? 'bg-red-500/20 text-red-400' :
                  app.status === 'Aguardando Pagamento' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {app.status}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-gray-300 mb-6">
                <span className="text-sm font-medium">{app.time}</span>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => handleUpdateStatus(app.id, 'Confirmado')}
                  className="flex-1 bg-green-900/40 hover:bg-green-800/40 text-green-400 py-2 rounded-lg transition-colors flex justify-center items-center"
                  title="Confirmar"
                >
                  <CheckIcon />
                </button>
                <button 
                  onClick={() => handleUpdateStatus(app.id, 'Cancelado')}
                  className="flex-1 bg-red-900/40 hover:bg-red-800/40 text-red-400 py-2 rounded-lg transition-colors flex justify-center items-center"
                  title="Cancelar"
                >
                  <XIcon />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-gray-900/50 border border-dashed border-gray-700 rounded-2xl py-20 text-center">
            <p className="text-gray-500">Nenhum agendamento encontrado para esta data.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardView;