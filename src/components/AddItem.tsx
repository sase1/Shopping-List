'use client';
import { useState } from 'react';

export default function AddItem({ onAdd }: { onAdd: (name: string) => void }) {
    const [value, setValue] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!value.trim()) return;
        onAdd(value.trim());
        setValue('');
    };

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Add an item"
                className="flex-1 border px-3 py-2 rounded"
            />
            <button className="bg-sky-600 text-white px-4 rounded">Add</button>
        </form>
    );
}
