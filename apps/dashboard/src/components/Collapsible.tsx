import { useState, ReactNode } from 'react';

interface Props {
    title: string;
    icon: string;
    children: ReactNode;
    defaultOpen?: boolean;
}

export default function Collapsible({ title, icon, children, defaultOpen = false }: Props) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="collapsible">
            <button
                className="collapsible-header"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                id={`collapsible-${title.replace(/\s+/g, '-').toLowerCase()}`}
            >
                <span className="collapsible-header-left">
                    <span aria-hidden="true">{icon}</span>
                    {title}
                </span>
                <span className={`collapsible-chevron ${isOpen ? 'open' : ''}`} aria-hidden="true">▼</span>
            </button>
            {isOpen && (
                <div className="collapsible-content">
                    {children}
                </div>
            )}
        </div>
    );
}
