import React from 'react';
import clsx from 'clsx';

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
}
export const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', className, ...props }) => {
    const base = "inline-flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg active:scale-95",
        secondary: "bg-button-bg hover:opacity-80 text-button-text active:scale-95",
        danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-lg active:scale-95",
        ghost: "bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
    };
    const sizes = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base"
    };

    return (
        <button
            className={clsx(base, variants[variant], sizes[size], className)}
            data-theme-role={variant === 'primary' ? 'primary' : variant === 'secondary' ? 'buttonBg' : undefined}
            {...props}
        />
    );
};

// --- Input ---
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
    <input
        className={clsx(
            "w-full bg-input-bg border border-border rounded-lg px-4 py-2 text-input-text placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors",
            className
        )}
        data-theme-role="inputBg"
        {...props}
    />
);

// --- Select ---
export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, ...props }) => (
    <select
        className={clsx(
            "w-full bg-input-bg border border-border rounded-lg px-4 py-2 text-input-text focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors appearance-none scrollbar-thin",
            className
        )}
        data-theme-role="inputBg"
        {...props}
    />
);

// --- Card ---
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <div
        className={clsx(
            "bg-surface backdrop-blur-sm border border-border rounded-xl p-6 shadow-xl",
            className
        )}
        data-theme-role="surface"
        {...props}
    />
);

// --- Label ---
export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ className, ...props }) => (
    <label
        className={clsx("block text-xs font-bold text-sub-text mb-1.5", className)}
        data-theme-role="subText"
        {...props}
    />
);
