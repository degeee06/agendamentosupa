
import React from 'react';
import { DayKey } from '../types';

interface DaySelectorProps {
  currentDay: DayKey;
  onSelectDay: (day: DayKey) => void;
  daysToDisplay: DayKey[];
}

const DaySelector: React.FC<DaySelectorProps> = ({ currentDay, onSelectDay, daysToDisplay }) => {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {daysToDisplay.map(day => (
        <button
          key={day}
          onClick={() => onSelectDay(day)}
          className={`px-3 py-2 sm:px-4 text-sm font-semibold rounded-full transition-all duration-300 transform hover:scale-105 ${
            currentDay === day
              ? 'bg-brand-primary text-white shadow-md'
              : 'bg-gray-700 text-gray-300 hover:bg-brand-accent hover:text-white'
          }`}
        >
          {day}
        </button>
      ))}
    </div>
  );
};

export default DaySelector;