"use client";

import { useEffect, useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
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

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

function getDaysInMonth(monthIndex: number, year: number = 2024) {
    return new Date(year, monthIndex + 1, 0).getDate();
}

export default function BirthdaysPage() {
    const initData = useInitData();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState("");
    // We store day and month separately
    const [day, setDay] = useState<number>(1);
    const [month, setMonth] = useState<number>(0); // 0-11

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
                const next = new Date(currentYear, m, day);
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
        if (!name) return;
        setLoading(true);

        // Construct a "fake" year date like 2000-MM-DD
        const year = 2000;
        // Ensure explicit MM and DD formatting
        const mm = String(month + 1).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        const dateStr = `${year}-${mm}-${dd}`;

        try {
            if (editingId) {
                await apiFetch(`/api/birthdays/${editingId}`, initData, {
                    method: "PUT",
                    body: { name, date: dateStr }
                });
            } else {
                await apiFetch("/api/birthdays", initData, {
                    body: { name, date: dateStr }
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
                method: "DELETE"
            });
            mutate(["/api/birthdays", initData]);
        } catch (err) {
            console.error(err);
            alert("Error deleting");
        }
    };

    const startEdit = (b: Birthday) => {
        setName(b.name);
        const d = new Date(b.date);
        setMonth(d.getMonth());
        setDay(d.getDate());
        setEditingId(b.id);
        setIsAdding(true);
    };

    const resetForm = () => {
        setName("");
        setMonth(new Date().getMonth());
        setDay(new Date().getDate());
        setEditingId(null);
        setIsAdding(false);
    };

    if (!initData) return <div className="flex bg-background h-screen items-center justify-center p-4 text-muted-foreground">Loading Telegram Data...</div>;

    const daysOptions = Array.from({ length: getDaysInMonth(month) }, (_, i) => i + 1);

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
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-sm font-medium mb-1 block">Month</label>
                                    <select
                                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        value={month}
                                        onChange={(e) => {
                                            setDay(1);
                                            setMonth(Number(e.target.value));
                                        }}
                                    >
                                        {MONTHS.map((mName, i) => (
                                            <option key={mName} value={i}>{mName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-24">
                                    <label className="text-sm font-medium mb-1 block">Day</label>
                                    <select
                                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        value={day}
                                        onChange={(e) => setDay(Number(e.target.value))}
                                    >
                                        {daysOptions.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end pt-2">
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
                        const dateStr = bDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
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
