import { useEffect } from 'react';

interface Toast {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
    icon: string;
}

interface Props {
    toasts: Toast[];
    onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: Props) {
    return (
        <div className="toast-container" aria-live="polite">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
    useEffect(() => {
        const timer = setTimeout(() => onRemove(toast.id), 4000);
        return () => clearTimeout(timer);
    }, [toast.id, onRemove]);

    return (
        <div className={`toast toast-${toast.type}`} role="alert">
            <span aria-hidden="true">{toast.icon}</span>
            <span>{toast.message}</span>
        </div>
    );
}

export type { Toast };
