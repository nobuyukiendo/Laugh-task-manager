import { TrackerItem, TrackerLog } from './types';

const ITEMS_KEY = 'bike_tracker_items';
const LOGS_KEY = 'bike_tracker_logs';

export class Storage {
    static getItems(): TrackerItem[] {
        const data = localStorage.getItem(ITEMS_KEY);
        return data ? JSON.parse(data) : [];
    }

    static saveItems(items: TrackerItem[]) {
        localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
    }

    static getLogs(): TrackerLog[] {
        const data = localStorage.getItem(LOGS_KEY);
        return data ? JSON.parse(data) : [];
    }

    static saveLogs(logs: TrackerLog[]) {
        localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    }

    static addItem(item: TrackerItem) {
        const items = this.getItems();
        items.push(item);
        this.saveItems(items);
    }

    static updateItem(updatedItem: TrackerItem) {
        const items = this.getItems().map(item =>
            item.id === updatedItem.id ? updatedItem : item
        );
        this.saveItems(items);
    }

    static deleteItem(id: string) {
        const items = this.getItems().filter(item => item.id !== id);
        this.saveItems(items);
    }

    static addLog(log: TrackerLog) {
        const logs = this.getLogs();
        logs.push(log);
        this.saveLogs(logs);
    }

    static updateLog(updatedLog: TrackerLog) {
        const logs = this.getLogs().map(log =>
            log.id === updatedLog.id ? updatedLog : log
        );
        this.saveLogs(logs);
    }
}
