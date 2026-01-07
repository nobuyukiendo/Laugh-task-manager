import { v4 as uuidv4 } from 'uuid';
import React, { createContext, useContext, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Department, WorkType, DetailTask } from '../db';

interface MasterContextType {
    departments: Department[];
    workTypes: WorkType[];
    detailTasks: DetailTask[];

    // Basic CRUD... simplified for now, components can also use db directly if complex
    addDepartment: (dept: Department) => Promise<string>;
    updateDepartment: (id: string, updates: Partial<Department>) => Promise<number>;
    deleteDepartment: (id: string) => Promise<void>;

    // Similar for others would be here
    addWorkType: (wt: Omit<WorkType, 'id'>) => Promise<string>;
    updateWorkType: (id: string, u: Partial<WorkType>) => Promise<number>;
    deleteWorkType: (id: string) => Promise<void>;

    addDetailTask: (dt: Omit<DetailTask, 'id' | 'order' | 'enabled'> & Partial<DetailTask>) => Promise<string>;
    updateDetailTask: (id: string, u: Partial<DetailTask>) => Promise<number>;
    deleteDetailTask: (id: string) => Promise<void>;

}

const MasterContext = createContext<MasterContextType | undefined>(undefined);

export const MasterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const departments = useLiveQuery(() => db.departments.orderBy('order').toArray(), []) || [];
    const workTypes = useLiveQuery(() => db.workTypes.orderBy('order').toArray(), []) || [];
    const detailTasks = useLiveQuery(() => db.detailTasks.orderBy('order').toArray(), []) || [];

    const addDepartment = async (dept: Department) => {
        return await db.departments.add(dept);
    };

    const updateDepartment = async (id: string, updates: Partial<Department>) => {
        return await db.departments.update(id, updates);
    };

    const deleteDepartment = async (id: string) => {
        await db.departments.delete(id);
    };

    // WorkTypes
    const addWorkType = async (wt: Omit<WorkType, 'id'>) => {
        const id = uuidv4();
        await db.workTypes.add({ ...wt, id });
        return id;
    };
    const updateWorkType = async (id: string, u: Partial<WorkType>) => db.workTypes.update(id, u);
    const deleteWorkType = async (id: string) => { await db.workTypes.delete(id); };

    // DetailTasks
    const addDetailTask = async (dt: Omit<DetailTask, 'id' | 'order' | 'enabled'> & Partial<DetailTask>) => {
        const id = uuidv4();
        // Allow defaults if partial
        const full = {
            order: 0,
            enabled: true,
            ...dt,
            id
        } as DetailTask;
        await db.detailTasks.add(full);
        return id;
    };
    const updateDetailTask = async (id: string, u: Partial<DetailTask>) => db.detailTasks.update(id, u);
    const deleteDetailTask = async (id: string) => { await db.detailTasks.delete(id); };

    return (
        <MasterContext.Provider value={{
            departments,
            workTypes,
            detailTasks,
            addDepartment, updateDepartment, deleteDepartment,
            addWorkType, updateWorkType, deleteWorkType,
            addDetailTask, updateDetailTask, deleteDetailTask
        }}>
            {children}
        </MasterContext.Provider>
    );
};

export const useMaster = () => {
    const context = useContext(MasterContext);
    if (!context) {
        throw new Error('useMaster must be used within a MasterProvider');
    }
    return context;
};
