import React from 'react';
import { Profile, Attendance, DayKey } from '../types';
import { CheckIcon, XIcon, UserPlusIcon } from './icons';

interface AttendanceTableProps {
  people: Profile[];
  attendance: Attendance;
  currentDay: DayKey;
  isAdmin: boolean;
  onToggleAttendance: (personId: string, day: DayKey) => void;
  onSubstitute: (person: Profile) => void;
}

const AttendanceTable: React.FC<AttendanceTableProps> = ({ people, attendance, currentDay, isAdmin, onToggleAttendance, onSubstitute }) => {
  // Para administradores, mostramos todas as pessoas para dar controle total.
  const peopleForCurrentDay = people;

  if (peopleForCurrentDay.length === 0) {
    return (
      <div className="text-center py-10 px-4 bg-gray-800 rounded-lg">
        <p className="text-gray-400">Nenhuma pessoa encontrada.</p>
        <p className="text-gray-400 mt-2">Verifique a pesquisa ou adicione novas pessoas ao sistema.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-gray-800 rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-700">
        <thead className="bg-gray-700">
          <tr>
            <th scope="col" className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              Nome
            </th>
            <th scope="col" className="px-2 sm:px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
              Presença ({currentDay})
            </th>
            {isAdmin && (
              <th scope="col" className="px-2 sm:px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                Ações
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-gray-800 divide-y divide-gray-700">
          {peopleForCurrentDay.map(person => {
            const status = attendance[person.id]?.[currentDay];
            return (
                <tr key={person.id} className="hover:bg-gray-700">
                <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {person.full_name}
                </td>
                <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-center">
                    <button
                    onClick={() => onToggleAttendance(person.id, currentDay)}
                    className={`p-2 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95 ${
                        status === true
                        ? 'bg-green-900 hover:bg-green-800 text-green-300'
                        : status === false
                        ? 'bg-red-900 hover:bg-red-800 text-red-300'
                        : 'bg-gray-600 text-gray-400 hover:bg-gray-500'
                    }`}
                    aria-label={`Marcar presença para ${person.full_name}`}
                    >
                    {status === true ? <CheckIcon /> : status === false ? <XIcon /> : <span className="h-5 w-5 flex items-center justify-center font-bold">-</span>}
                    </button>
                </td>
                {isAdmin && (
                  <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                      onClick={() => onSubstitute(person)}
                      className="text-blue-400 hover:text-blue-300 p-2 rounded-full hover:bg-gray-600"
                      aria-label={`Substituir ${person.full_name}`}
                      >
                      <UserPlusIcon />
                      </button>
                  </td>
                )}
                </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AttendanceTable;