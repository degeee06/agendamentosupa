import React, { useState, useEffect } from 'react';
import { Profile } from '../types';
import { supabase } from '../supabase';
import Modal from './Modal';
import { DotsVerticalIcon, UserPlusIcon } from './icons';

interface ManageUsersViewProps {
  profiles: Profile[];
  setProfiles: React.Dispatch<React.SetStateAction<Profile[]>>;
  currentUserProfile: Profile;
}

const ROLES_MAP: Record<Profile['role'], string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  employee: 'Funcionário',
};

const ManageUsersView: React.FC<ManageUsersViewProps> = ({ profiles, setProfiles, currentUserProfile }) => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<Profile | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  // State for the new user modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId && !(event.target as HTMLElement).closest('.actions-menu-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

  const handleRoleChange = async (person: Profile) => {
    const originalRole = person.role;
    const newRole = originalRole === 'admin' ? 'employee' : 'admin';
    
    setLoading(prev => ({ ...prev, [person.id]: true }));
    setError(null);

    setProfiles(prevProfiles =>
      prevProfiles.map(p => (p.id === person.id ? { ...p, role: newRole } : p))
    );

    const { error } = await supabase.functions.invoke('update-user-role', {
      body: { user_id: person.id, new_role: newRole },
    });

    if (error) {
      console.error('Error changing role:', error);
      setError(`Falha ao alterar o cargo: ${error.message}`);
      setProfiles(prevProfiles =>
        prevProfiles.map(p => (p.id === person.id ? { ...p, role: originalRole } : p))
      );
    }

    setLoading(prev => ({ ...prev, [person.id]: false }));
  };
  
const handleRemoveUser = async () => {
    if (!removeConfirm) return;

    const userToDelete = removeConfirm;

    setLoading(prev => ({ ...prev, [userToDelete.id]: true }));
    setError(null);

    try {
      const { error: functionError } = await supabase.functions.invoke('delete-user', {
          body: { user_id: userToDelete.id },
      });

      if (functionError) {
          throw new Error(`A remoção falhou. A conta de autenticação do usuário não pôde ser removida. Detalhes: ${functionError.message}`);
      }
      setProfiles(prevProfiles => prevProfiles.filter(p => p.id !== userToDelete.id));
      setRemoveConfirm(null);

    } catch (err: any) {
        console.error('Error during user removal process:', err);
        setError(err.message || 'Ocorreu um erro desconhecido durante a remoção.');
    } finally {
        setLoading(prev => ({ ...prev, [userToDelete.id]: false }));
    }
};

const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);
    setError(null);

    try {
        const { data, error } = await supabase.functions.invoke('create-user', {
            body: {
                full_name: newFullName,
                employee_id: newEmployeeId,
                password: newPassword,
            },
        });

        if (error) {
            throw error;
        }

        // A realtime subscription in App.tsx should add the user,
        // but we can add it here for immediate feedback if needed.
        // The trigger on auth.users handles profile creation.
        
        // Reset form and close modal
        setIsCreateModalOpen(false);
        setNewFullName('');
        setNewEmployeeId('');
        setNewPassword('');

    } catch (err: any) {
        console.error('Error creating user:', err);
        setError(err.message || 'Falha ao criar usuário. O Nº do Crachá pode já existir.');
    } finally {
        setIsCreatingUser(false);
    }
};

  
  const sortedProfiles = [...profiles].sort((a, b) => {
    const roleOrder = { super_admin: 0, admin: 1, employee: 2 };
    if (roleOrder[a.role] !== roleOrder[b.role]) {
      return roleOrder[a.role] - roleOrder[b.role];
    }
    return a.full_name.localeCompare(b.full_name);
  });

  return (
    <>
      <div className="bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-200">Gerenciar Usuários</h2>
            <button
                onClick={() => { setIsCreateModalOpen(true); setError(null); }}
                className="flex items-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition duration-300"
            >
                <UserPlusIcon />
                <span className="hidden sm:inline">Novo Usuário</span>
            </button>
        </div>

        {error && <p className="mb-4 text-center text-red-400 text-sm bg-red-900/50 p-3 rounded-md">{error}</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th scope="col" className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nome</th>
                <th scope="col" className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nº do Crachá</th>
                <th scope="col" className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cargo</th>
                <th scope="col" className="px-2 sm:px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {sortedProfiles.map(person => {
                const isLoading = loading[person.id];
                const isCurrentUser = person.id === currentUserProfile.id;

                let canManageRole = false;
                let canDelete = false;
                if (currentUserProfile.role === 'super_admin' && !isCurrentUser) {
                    canManageRole = person.role !== 'super_admin';
                    canDelete = true;
                } else if (currentUserProfile.role === 'admin' && person.role === 'employee') {
                    canManageRole = true;
                    canDelete = true;
                }
                
                return (
                  <tr key={person.id} className="hover:bg-gray-700">
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{person.full_name}</td>
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-300">{person.employee_id}</td>
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        person.role === 'super_admin' ? 'bg-red-200 text-red-800' :
                        person.role === 'admin' ? 'bg-indigo-200 text-indigo-800' : 
                        'bg-gray-600 text-gray-200'
                      }`}>
                        {ROLES_MAP[person.role]}
                      </span>
                    </td>
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative inline-block text-left actions-menu-container">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === person.id ? null : person.id)}
                          disabled={isLoading}
                          className="p-2 rounded-full text-gray-400 hover:bg-gray-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-brand-primary"
                          id={`menu-button-${person.id}`}
                          aria-haspopup="true"
                          aria-expanded={openMenuId === person.id}
                        >
                          <span className="sr-only">Opções para {person.full_name}</span>
                          {isLoading ? (
                            <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent block"></span>
                          ) : (
                            <DotsVerticalIcon />
                          )}
                        </button>

                        {openMenuId === person.id && (
                          <div
                            className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 z-10 focus:outline-none"
                            role="menu"
                            aria-orientation="vertical"
                            aria-labelledby={`menu-button-${person.id}`}
                          >
                            <div className="py-1" role="none">
                              <button
                                onClick={() => { handleRoleChange(person); setOpenMenuId(null); }}
                                disabled={!canManageRole}
                                className="w-full text-left block px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                role="menuitem"
                                title={!canManageRole ? 'Você não tem permissão para alterar este cargo.' : (person.role === 'admin' ? 'Rebaixar para Funcionário' : 'Promover para Admin')}
                              >
                                {person.role === 'admin' ? 'Rebaixar para Funcionário' : 'Promover para Admin'}
                              </button>
                              <button
                                onClick={() => { setRemoveConfirm(person); setOpenMenuId(null); }}
                                disabled={!canDelete}
                                className="w-full text-left block px-4 py-2 text-sm text-red-400 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                role="menuitem"
                                title={!canDelete ? 'Você não tem permissão para remover este usuário.' : 'Remover usuário permanentemente'}
                              >
                                Remover Usuário
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      <Modal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Criar Novo Usuário"
      >
        <form onSubmit={handleCreateUser} className="flex flex-col gap-4 mt-4">
             <div className="mb-2">
                <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="newFullName">
                    Nome Completo
                </label>
                <input
                    id="newFullName"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary text-white"
                    type="text"
                    placeholder="Nome completo do funcionário"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    required
                />
            </div>
            <div className="mb-2">
                <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="newEmployeeId">
                    Nº do Crachá / Matrícula
                </label>
                <input
                    id="newEmployeeId"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary text-white"
                    type="text"
                    placeholder="Número de identificação único"
                    value={newEmployeeId}
                    onChange={(e) => setNewEmployeeId(e.target.value)}
                    required
                />
            </div>
            <div className="mb-4">
                <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="newPassword">
                    Senha Provisória
                </label>
                <input
                    id="newPassword"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary text-white"
                    type="password"
                    placeholder="Uma senha forte"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                />
                 <p className="text-xs text-gray-400 mt-2">O funcionário poderá alterar esta senha depois, se necessário.</p>
            </div>
            {error && <p className="text-center text-red-400 text-sm">{error}</p>}
            <button type="submit" className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:bg-gray-600" disabled={isCreatingUser}>
                {isCreatingUser ? 'Criando...' : 'Criar Usuário'}
            </button>
        </form>
      </Modal>

      {/* Remove User Modal */}
      <Modal 
        isOpen={!!removeConfirm}
        onClose={() => setRemoveConfirm(null)}
        title="Confirmar Remoção"
      >
        <div className="mt-4">
            <p className="text-sm text-gray-400">
                Tem certeza que deseja remover permanentemente <strong>{removeConfirm?.full_name}</strong>?
            </p>
            <p className="text-sm text-red-400 mt-2 font-semibold">
                Esta ação é irreversível. A conta do usuário (login e senha) e todos os seus dados de presença serão apagados permanentemente. Para acessar o sistema novamente, o usuário precisará criar uma nova conta.
            </p>
            <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setRemoveConfirm(null)} type="button" className="px-4 py-2 text-sm font-medium text-gray-200 bg-gray-600 border border-gray-500 rounded-md shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white">
                    Cancelar
                </button>
                <button onClick={handleRemoveUser} type="button" className="px-4 py-2 text-sm font-medium text-white bg-status-absent border border-transparent rounded-md shadow-sm hover:bg-red-700 disabled:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500" disabled={loading[removeConfirm?.id || '']}>
                    {loading[removeConfirm?.id || ''] ? 'Removendo...' : 'Sim, Remover'}
                </button>
            </div>
        </div>
      </Modal>
    </>
  );
};

export default ManageUsersView;