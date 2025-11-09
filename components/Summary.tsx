import React from 'react';
import { Attendance, DayKey, Profile } from '../types';

interface SummaryProps {
  people: Profile[];
  attendance: Attendance;
  currentDay: DayKey;
}

const Summary: React.FC<SummaryProps> = ({ people, attendance, currentDay }) => {
  const presentCount = people.filter(
    person => attendance[person.id]?.[currentDay]
  ).length;

  return (
    <div className="bg-gray-800 rounded-lg shadow p-4 text-center">
      <h3 className="font-bold text-lg text-gray-200">Resumo de {currentDay}</h3>
      <p className="text-4xl font-bold text-brand-primary mt-2">{presentCount}</p>
      <p className="text-gray-400">Pessoas presentes</p>
    </div>
  );
};

export default Summary;
