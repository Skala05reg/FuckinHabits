"use client";

import { useEffect, useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Edit2, Loader2, Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, Birthday } from "@/lib/api-client";

// Mock or simplified types for window.Telegram
declare global {
    interface Window {
        Telegram?: {
            WebApp: {
                initData: string;
                BackButton: {
                    show: () => void;
                    onClick: (cb: () => void) => void;
                    hide: () => void;
                    offClick: (cb: () => void) => void;
                };
            };
        };
    }
}

function useInitData() {
    const [initData, setInitData] = useState("");
    useEffect(() => {
        if (typeof window !== "undefined" && window.Telegram?.WebApp) {
            setInitData(window.Telegram.WebApp.initData);

            if (window.Telegram.WebApp.BackButton) {
                window.Telegram.WebApp.BackButton.show();
                window.Telegram.WebApp.BackButton.onClick(() => {
                    window.history.back();
                });
            }
            return () => {
                if (window.Telegram?.WebApp?.BackButton) {
                    window.Telegram.WebApp.BackButton.hide();
                    window.Telegram.WebApp.BackButton.offClick(() => { });
                }
            }
        }
    }, []);
    return initData;
}

export default function BirthdaysPage() {
    const initData = useInitData();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState("");
    const [date, setDate] = useState("");
    const [loading, setLoading] = useState(false);

    const { data, isLoading } = useSWR<{ birthdays: Birthday[] }>(
        initData ? ["/api/birthdays", initData] : null,
        ([url, token]) => apiFetch<{ birthdays: Birthday[] }>(url as string, token as string)
    );

    const birthdays = data?.birthdays || [];

    // Sort by upcoming
    const sortedBirthdays = useMemo(() => {
        if (!birthdays.length) return [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentYear = today.getFullYear();

        return [...birthdays].sort((a, b) => {
            const getNextDate = (dStr: string) => {
                const d = new Date(dStr);
                const m = d.getMonth();
                const day = d.getDate();
                let next = new Date(currentYear, m, day);
                if (next < today) {
                    next.setFullYear(currentYear + 1);
                }
                return next.getTime();
            };
            return getNextDate(a.date) - getNextDate(b.date);
        });
    }, [birthdays]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !date) return;
        setLoading(true);

        try {
            if (editingId) {
                await apiFetch(`/api/birthdays/${editingId}`, initData, {
                    method: "PUT" as any,
                    body: { name, date }
                });
            } else {
                await apiFetch("/api/birthdays", initData, {
                    body: { name, date }
                });
            }
            mutate(["/api/birthdays", initData]);
            resetForm();
        } catch (err) {
            console.error(err);
            alert("Error saving birthday");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        // eslint-disable-next-line no-restricted-globals
        if (!confirm("Are you sure?")) return;
        try {
            await apiFetch(`/api/birthdays/${id}`, initData, {
                method: "DELETE" as any
            });
            mutate(["/api/birthdays", initData]);
        } catch (err) {
            console.error(err);
            alert("Error deleting");
        }
    };

    const startEdit = (b: Birthday) => {
        setName(b.name);
        setDate(b.date);
        setEditingId(b.id);
        setIsAdding(true);
    };

    const resetForm = () => {
        setName("");
        setDate("");
        setEditingId(null);
        setIsAdding(false);
    };

    if (!initData) return <div className="flex bg-background h-screen items-center justify-center p-4 text-muted-foreground">Loading Telegram Data...</div>;

    return (
        <div className="min-h-dvh bg-background p-4 pb-20">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">🎂 Birthdays</h1>
                <Button className="h-10 w-10 p-0" variant="secondary" onClick={() => setIsAdding(!isAdding)}>
                    {isAdding ? <ArrowLeft size={20} /> : <Plus size={20} />}
                </Button>
            </div>

            {isAdding && (
                <Card className="mb-6 animate-in slide-in-from-top-4 fade-in">
                    <CardContent className="pt-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Name</label>
                                <Input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="John Doe"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Date</label>
                                <Input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>
                                <Button type="submit" disabled={loading}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : sortedBirthdays.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">No birthdays added yet.</div>
            ) : (
                <div className="space-y-3">
                    {sortedBirthdays.map((b) => {
                        const bDate = new Date(b.date);
                        const dateStr = bDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
                        return (
                            <Card key={b.id}>
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex gap-3 items-center">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            <Calendar size={20} />
                                        </div>
                                        <div>
                                            <div className="font-semibold">{b.name}</div>
                                            <div className="text-sm text-muted-foreground">{dateStr}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button className="h-8 w-8 p-0" variant="ghost" onClick={() => startEdit(b)}>
                                            <Edit2 size={16} />
                                        </Button>
                                        <Button className="h-8 w-8 p-0 text-red-500 hover:text-red-500 hover:bg-red-100/10" variant="ghost" onClick={() => handleDelete(b.id)}>
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
