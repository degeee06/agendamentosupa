export type DayKey = 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado' | 'Domingo';

// FIX: Added Appointment type and exported it to resolve import error in components/DashboardView.tsx.
export type Appointment = {
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

export interface Profile {
  id: string; // uuid from auth.users
  updated_at?: string;
  full_name: string;
  employee_id: string;
  role: 'super_admin' | 'admin' | 'employee';
}

export interface AttendanceRecord {
  id?: number;
  user_id: string;
  week_id: string;
  day: DayKey;
  is_present: boolean;
  created_at?: string;
}

// This will be the transformed structure for easier use in components
export type Attendance = {
  [personId: string]: {
    [day in DayKey]?: boolean;
  };
};

export interface HistoryEntry {
  weekId: string;
  people: Profile[];
  attendance: Attendance;
}