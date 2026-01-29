import { DayKey } from './types';
import { DAYS_OF_WEEK } from './constants';

/**
 * Retorna um array de objetos Date para cada dia de uma semana específica,
 * com base no formato de ID de semana ISO 8601 (ex: "2024-W42").
 * @param weekId - A string do ID da semana.
 * @returns Um array com 7 objetos Date, de Segunda a Domingo.
 */
export const getDatesForWeekId = (weekId: string): Date[] => {
  const [yearStr, weekStr] = weekId.split('-W');
  const year = parseInt(yearStr, 10);
  const weekNumber = parseInt(weekStr, 10);

  // A semana 1 do padrão ISO 8601 é a que contém o dia 4 de janeiro.
  // Usamos UTC para evitar problemas com fuso horário e horário de verão.
  
  // Primeiro, pegamos a data de 4 de janeiro do ano em questão.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  
  // Ajustamos o dia da semana para que Segunda seja 1 e Domingo seja 7.
  const jan4DayOfWeek = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();

  // Com base nisso, calculamos a data da Segunda-feira da semana 1.
  const mondayOfWeek1 = new Date(jan4.valueOf());
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - jan4DayOfWeek + 1);

  // Agora, calculamos a Segunda-feira da semana que queremos.
  const targetMonday = new Date(mondayOfWeek1.valueOf());
  targetMonday.setUTCDate(mondayOfWeek1.getUTCDate() + (weekNumber - 1) * 7);

  // Por fim, criamos um array com todas as 7 datas da semana.
  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(targetMonday.valueOf());
    day.setUTCDate(targetMonday.getUTCDate() + i);
    weekDates.push(day);
  }

  return weekDates;
};


/**
 * Formata um ID de semana (ex: "2024-W42") em um intervalo de datas legível.
 * @param weekId - A string do ID da semana.
 * @returns Uma string formatada, ex: "21/10 a 27/10/2024".
 */
export const getReadableWeekRange = (weekId: string): string => {
  const dates = getDatesForWeekId(weekId);
  const startDate = dates[0];
  const endDate = dates[6];

  const formatDate = (date: Date, includeYear = false) => {
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    if (includeYear) {
      return `${day}/${month}/${date.getUTCFullYear()}`;
    }
    return `${day}/${month}`;
  };

  return `${formatDate(startDate)} a ${formatDate(endDate, true)}`;
};