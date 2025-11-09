import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HistoryEntry, Profile, AttendanceRecord } from '../types';
import HistoryTable from './HistoryTable';
import { PDFIcon } from './icons';
import { DAYS_OF_WEEK } from '../constants';
import { getDatesForWeekId, getReadableWeekRange } from '../utils';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { getWeekId } from '../App';

interface HistoryViewProps {
  allProfiles: Profile[];
  allAttendances: AttendanceRecord[];
}

const HistoryView: React.FC<HistoryViewProps> = ({ allProfiles, allAttendances }) => {
  const [loadingWeek, setLoadingWeek] = useState<string | null>(null);

  const historyData: HistoryEntry[] = useMemo(() => {
    const groupedByWeek: { [weekId: string]: AttendanceRecord[] } = allAttendances.reduce((acc, record) => {
        (acc[record.week_id] = acc[record.week_id] || []).push(record);
        return acc;
    }, {});
    
    const profileMap = new Map(allProfiles.map(p => [p.id, p]));
    
    return Object.entries(groupedByWeek).map(([weekId, records]) => {
      const userIdsInWeek = new Set(records.map(r => r.user_id));
      const peopleForWeek = Array.from(userIdsInWeek).map(id => profileMap.get(id)).filter(Boolean) as Profile[];

      const attendanceForWeek = records.reduce((acc, record) => {
          if (!acc[record.user_id]) acc[record.user_id] = {};
          acc[record.user_id][record.day] = record.is_present;
          return acc;
      }, {});

      return {
        weekId,
        people: peopleForWeek,
        attendance: attendanceForWeek
      };
    }).sort((a, b) => b.weekId.localeCompare(a.weekId)); // Sort descending
  }, [allProfiles, allAttendances]);

const generatePdf = async (weekData: HistoryEntry) => {
  setLoadingWeek(weekData.weekId);
  try {
    const doc = new jsPDF();
    const { weekId, people, attendance } = weekData;
    const weekTitle = `Relatório de Presença - Semana de ${getReadableWeekRange(weekId)}`;
    doc.text(weekTitle, 14, 15);
    
    const weekDates = getDatesForWeekId(weekId);
    const formatDate = (date: Date) => `${date.getUTCDate().toString().padStart(2, '0')}/${(date.getUTCMonth() + 1).toString().padStart(2, '0')}`;

    const tableColumn = ['Nome', ...DAYS_OF_WEEK.map((day, index) => `${day.substring(0,3)} (${formatDate(weekDates[index])})`)];
    const tableRows: (string | null)[][] = [];

    const sortedPeople = [...people].sort((a, b) => a.full_name.localeCompare(b.full_name));

    sortedPeople.forEach((person) => {
      const rowData = [
        person.full_name,
        ...DAYS_OF_WEEK.map((day) => {
          const status = attendance[person.id]?.[day];
          if (status === true) return 'P';
          if (status === false) return 'X';
          return '-';
        }),
      ];
      tableRows.push(rowData);
    });

    const totalsRow = ['TOTAL'];
    DAYS_OF_WEEK.forEach((day) => {
      const presentCount = sortedPeople.filter((p) => attendance[p.id]?.[day] === true).length;
      totalsRow.push(presentCount.toString());
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      foot: [totalsRow],
      startY: 25,
      theme: 'grid',
      headStyles: {
          fillColor: [13, 71, 161],
          textColor: 255,
      },
      footStyles: {
        fontStyle: 'bold',
        fillColor: [245, 245, 245],
        textColor: 20,
      },
      willDrawCell: (data: any) => {
        if ((data.section === 'body' || data.section === 'foot') && data.column.index > 0) {
          data.cell.styles.halign = 'center';
        }
        if (data.section === 'body' && data.column.index > 0 && (data.cell.raw === 'P' || data.cell.raw === 'X')) {
          data.cell.text = '';
        }
      },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index > 0) {
          const cell = data.cell;
          const x = cell.x + cell.width / 2;
          const y = cell.y + cell.height / 2;
          const size = Math.min(cell.width, cell.height) * 0.25;
          const lineWidth = 0.8;

          if (cell.raw === 'P') {
            doc.setLineWidth(lineWidth);
            doc.setDrawColor(46, 125, 50);
            doc.line(x - size * 0.8, y, x - size * 0.2, y + size * 0.6);
            doc.line(x - size * 0.2, y + size * 0.6, x + size, y - size * 0.8);
          } else if (cell.raw === 'X') {
            doc.setLineWidth(lineWidth);
            doc.setDrawColor(198, 40, 40);
            doc.line(x - size, y - size, x + size, y + size);
            doc.line(x + size, y - size, x - size, y + size);
          }
        }
      },
    });

    const fileName = `relatorio-presenca-${weekId}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const pdfBlob = doc.output('blob');
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        try {
          const base64data = reader.result as string;
          const base64 = base64data.split(',')[1];

          const result = await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Cache,
          });

          await Share.share({
            title: `Relatório de Presença - ${weekId}`,
            text: `Relatório de presença em PDF para a semana de ${getReadableWeekRange(weekId)}.`,
            url: result.uri,
            dialogTitle: 'Compartilhar Relatório',
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
          if (errorMessage.toLowerCase().includes('share cancelled')) {
            console.log('Share was cancelled by user.');
            return;
          }
          console.error('Erro ao compartilhar PDF:', error);
          alert('Erro ao compartilhar PDF. Verifique as permissões.');
        } finally {
          setLoadingWeek(null);
        }
      };
      reader.onerror = (error) => {
          console.error('File Reader error:', error);
          alert('Erro ao ler o arquivo PDF para compartilhamento.');
          setLoadingWeek(null);
      };
    } else {
      doc.save(fileName);
      setLoadingWeek(null);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('Falha ao gerar o PDF:', error);
    alert(`Ocorreu um erro ao gerar o PDF: ${errorMessage}`);
    setLoadingWeek(null);
  }
};

  if (historyData.length === 0) {
    return (
      <div className="text-center py-10 px-4 bg-gray-800 rounded-lg shadow">
        <p className="text-gray-400">Nenhum histórico para exibir ainda.</p>
        <p className="text-gray-400 mt-2">
          Os registros de presença aparecerão aqui após serem salvos.
        </p>
      </div>
    );
  }
  
  const currentWeekId = getWeekId(new Date());

  return (
    <div className="flex flex-col gap-4">
      {historyData.map((entry) => {
        const isLoadingPdf = loadingWeek === entry.weekId;
        return (
          <details
            key={entry.weekId}
            className="bg-gray-800 rounded-lg shadow overflow-hidden"
            open={entry.weekId === currentWeekId}
          >
            <summary className="cursor-pointer p-4 font-semibold text-lg text-gray-200 flex justify-between items-center hover:bg-gray-700">
              <span className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span>Semana de {getReadableWeekRange(entry.weekId)}</span>
                <span className="text-xs text-gray-400 font-normal">({entry.weekId})</span>
                {entry.weekId === currentWeekId && (
                  <span className="text-sm font-normal text-brand-primary">(Atual)</span>
                )}
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isLoadingPdf) generatePdf(entry);
                }}
                disabled={isLoadingPdf}
                className={`flex items-center gap-2 font-bold py-1 px-3 rounded-md text-sm transition duration-300 ${
                  isLoadingPdf
                    ? 'bg-gray-600 cursor-not-allowed text-gray-300'
                    : 'bg-brand-primary hover:bg-brand-secondary text-white'
                }`}
              >
                {isLoadingPdf ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                    <span>Gerando...</span>
                  </>
                ) : (
                  <>
                    <PDFIcon /> Baixar PDF
                  </>
                )}
              </button>
            </summary>
            <div className="border-t border-gray-700 p-4">
              <HistoryTable weekData={entry} />
            </div>
          </details>
        );
      })}
    </div>
  );
};

export default HistoryView;
