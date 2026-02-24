import { v4 as uuidv4 } from 'uuid';
import React, { createContext, useContext, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Department, WorkType, DetailTask, RecentDetailTask, Partner, Location, MetricMaster, MetricHistory } from '../db';

interface MasterContextType {
    departments: Department[];
    workTypes: WorkType[];
    detailTasks: DetailTask[];
    recentDetailTasks: RecentDetailTask[];

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

    addRecentDetailTask: (name: string, workTypeId: string) => Promise<string>;

    partners: Partner[];
    addPartner: (partner: Omit<Partner, 'id'>) => Promise<string>;
    updatePartner: (id: string, u: Partial<Partner>) => Promise<number>;
    deletePartner: (id: string) => Promise<void>;

    locations: Location[];
    addLocation: (location: Omit<Location, 'id'>) => Promise<string>;
    updateLocation: (id: string, u: Partial<Location>) => Promise<number>;
    deleteLocation: (id: string) => Promise<void>;

    metricMasters: MetricMaster[];
    addMetricMaster: (m: Omit<MetricMaster, 'id'>) => Promise<string>;
    updateMetricMaster: (id: string, u: Partial<MetricMaster>) => Promise<number>;
    deleteMetricMaster: (id: string) => Promise<void>;

    metricHistories: MetricHistory[];
    addMetricHistory: (name: string, unit: string) => Promise<string>;
}

const MasterContext = createContext<MasterContextType | undefined>(undefined);

export const MasterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const departments = useLiveQuery(() => db.departments.orderBy('order').toArray(), []) || [];
    const workTypes = useLiveQuery(() => db.workTypes.orderBy('order').toArray(), []) || [];
    const detailTasks = useLiveQuery(() => db.detailTasks.orderBy('order').toArray(), []) || [];
    const recentDetailTasks = useLiveQuery(() => db.recentDetailTasks.orderBy('lastUsedAt').reverse().toArray(), []) || [];
    const partners = useLiveQuery(() => db.partners.orderBy('order').toArray(), []) || [];
    const locations = useLiveQuery(() => db.locations.orderBy('order').toArray(), []) || [];
    const metricMasters = useLiveQuery(() => db.metricMasters.orderBy('order').toArray(), []) || [];
    const metricHistories = useLiveQuery(() => db.metricHistories.orderBy('lastUsedAt').reverse().toArray(), []) || [];

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

    // RecentDetailTasks (LRU 200)
    const addRecentDetailTask = async (name: string, workTypeId: string) => {
        const existing = await db.recentDetailTasks
            .where({ name, workTypeId })
            .first();

        const now = Date.now();
        if (existing) {
            await db.recentDetailTasks.update(existing.id, { lastUsedAt: now });
            return existing.id;
        } else {
            const id = uuidv4();
            await db.recentDetailTasks.add({
                id,
                name,
                workTypeId,
                lastUsedAt: now
            });

            // Prune if > 30
            const count = await db.recentDetailTasks.count();
            if (count > 30) {
                const oldest = await db.recentDetailTasks
                    .orderBy('lastUsedAt')
                    .limit(count - 30)
                    .toArray();
                await db.recentDetailTasks.bulkDelete(oldest.map(o => o.id));
            }
            return id;
        }
    };

    // Partners
    const addPartner = async (partner: Omit<Partner, 'id'>) => {
        const id = uuidv4();
        await db.partners.add({ ...partner, id });
        return id;
    };
    const updatePartner = async (id: string, u: Partial<Partner>) => db.partners.update(id, u);
    const deletePartner = async (id: string) => { await db.partners.delete(id); };

    // Locations
    const addLocation = async (location: Omit<Location, 'id'>) => {
        const id = uuidv4();
        await db.locations.add({ ...location, id });
        return id;
    };
    const updateLocation = async (id: string, u: Partial<Location>) => db.locations.update(id, u);
    const deleteLocation = async (id: string) => { await db.locations.delete(id); };

    // MetricMasters
    const addMetricMaster = async (m: Omit<MetricMaster, 'id'>) => {
        const id = uuidv4();
        await db.metricMasters.add({ ...m, id });
        return id;
    };
    const updateMetricMaster = async (id: string, u: Partial<MetricMaster>) => db.metricMasters.update(id, u);
    const deleteMetricMaster = async (id: string) => { await db.metricMasters.delete(id); };

    // MetricHistories (LRU 50)
    const addMetricHistory = async (name: string, unit: string) => {
        const existing = await db.metricHistories
            .where({ name, unit })
            .first();

        const now = Date.now();
        if (existing) {
            await db.metricHistories.update(existing.id, { lastUsedAt: now });
            return existing.id;
        } else {
            const id = uuidv4();
            await db.metricHistories.add({
                id,
                name,
                unit,
                lastUsedAt: now
            });

            const count = await db.metricHistories.count();
            if (count > 50) {
                const oldest = await db.metricHistories
                    .orderBy('lastUsedAt')
                    .limit(count - 50)
                    .toArray();
                await db.metricHistories.bulkDelete(oldest.map(o => o.id));
            }
            return id;
        }
    };

    return (
        <MasterContext.Provider value={{
            departments,
            workTypes,
            detailTasks,
            recentDetailTasks,
            partners,
            addDepartment, updateDepartment, deleteDepartment,
            addWorkType, updateWorkType, deleteWorkType,
            addDetailTask, updateDetailTask, deleteDetailTask,
            addRecentDetailTask,
            addPartner, updatePartner, deletePartner,
            locations, addLocation, updateLocation, deleteLocation,
            metricMasters, addMetricMaster, updateMetricMaster, deleteMetricMaster,
            metricHistories, addMetricHistory
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
