import React, { useState } from 'react';
import { useTracker } from '../hooks/useTracker';
import { Play, Square, Trash2, Plus, Clock } from 'lucide-react';
import { clsx } from 'clsx';
// import { format } from 'date-fns';

interface TrackerViewProps {
    onNavigateToAnalytics: () => void;
}

export const TrackerView: React.FC<TrackerViewProps> = ({ onNavigateToAnalytics }) => {
    const { items, activeLog, elapsedTime, addItem, deleteItem, startTracking, stopTracking } = useTracker();
    const [newItemName, setNewItemName] = useState('');

    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemName.trim()) return;
        addItem(newItemName);
        setNewItemName('');
    };

    const formatDuration = (ms: number) => {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="container animate-fade-in">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="title mb-0">BIKE TRACKER</h1>
                    <p className="text-muted text-sm">Ride & Maintain</p>
                </div>
                <button
                    onClick={onNavigateToAnalytics}
                    className="btn btn-secondary text-sm"
                >
                    <Clock size={16} /> Analysis
                </button>
            </header>

            {/* Active Task Display */}
            {activeLog && (
                <div className="card mb-8 border border-[var(--accent-color)] shadow-[0_0_15px_rgba(0,229,255,0.1)]">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm text-[var(--accent-color)] font-bold uppercase tracking-wider mb-1">Current Activity</p>
                            <h2 className="text-2xl font-bold">
                                {items.find(i => i.id === activeLog.itemId)?.name || 'Unknown Task'}
                            </h2>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-mono font-bold mb-2">
                                {formatDuration(elapsedTime)}
                            </div>
                            <button
                                onClick={stopTracking}
                                className="btn btn-danger w-full flex items-center justify-center gap-2"
                            >
                                <Square size={18} fill="currentColor" /> Stop
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add New Item */}
            <form onSubmit={handleAddItem} className="mb-8 flex gap-2">
                <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="New Task Name (e.g., Oil Change)"
                    className="w-full bg-[var(--bg-secondary)] text-white p-3 rounded-[var(--radius-md)] border border-transparent focus:border-[var(--accent-color)] outline-none transition-colors"
                />
                <button
                    type="submit"
                    disabled={!newItemName.trim()}
                    className="btn btn-primary"
                >
                    <Plus size={20} />
                </button>
            </form>

            {/* Task List */}
            <div className="grid gap-4">
                {items.map(item => {
                    const isTrackingThis = activeLog?.itemId === item.id;
                    const isTrackingOther = !!activeLog && !isTrackingThis;

                    return (
                        <div key={item.id} className={clsx(
                            "card flex justify-between items-center transition-all",
                            isTrackingThis && "bg-[var(--bg-accent)]"
                        )}>
                            <div>
                                <h3 className="font-bold text-lg">{item.name}</h3>
                                <p className="text-muted text-sm font-mono mt-1">
                                    Total: {formatDuration(item.totalDuration)}
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                {!isTrackingThis ? (
                                    <button
                                        onClick={() => startTracking(item.id)}
                                        disabled={isTrackingOther}
                                        className={clsx(
                                            "btn btn-icon bg-[var(--bg-tertiary)] hover:bg-[var(--accent-color)] hover:text-black transition-colors",
                                            isTrackingOther && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        <Play size={20} fill="currentColor" className="ml-0.5" />
                                    </button>
                                ) : (
                                    <div className="text-[var(--accent-color)] animate-pulse">
                                        <Clock size={24} />
                                    </div>
                                )}

                                <button
                                    onClick={() => deleteItem(item.id)}
                                    disabled={isTrackingThis}
                                    className={clsx(
                                        "text-[var(--text-muted)] hover:text-[var(--danger-color)] p-2 transition-colors",
                                        isTrackingThis && "opacity-20 cursor-not-allowed"
                                    )}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {items.length === 0 && (
                    <div className="text-center py-12 text-muted">
                        <p>No tasks yet. Add one above to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
