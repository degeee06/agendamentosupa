export type DayKey = 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado' | 'Domingo';

export interface Profile {
  id: string; // uuid from auth.users
  updated_at?: string;
  full_name: string;
  employee_id: string;
  role: 'super_admin' | 'admin' | 'employee';
}

export interface BusinessProfile {
  user_id: string;
  blocked_dates: string[];
  blocked_times: Record<string, string[]>;
  working_days: Record<string, boolean>;
  start_time: string;
  end_time: string;
  service_price: number;
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