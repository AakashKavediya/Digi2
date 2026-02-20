import { useState } from "react";
import { Circle, CircleDot } from "lucide-react";

const SystemAudit = () => {
    // Mock Audit Data
    const auditTrail = [
        { id: 1, action: "WHITELIST_ADD", details: "Admin added 'IIT Bombay' to whitelist", user: "Admin (0xf3...)", time: "Just now" },
        { id: 2, action: "CERT_ISSUE", details: "IIT Bombay issued Certificate #10024", user: "0x44...55", time: "2 hrs ago" },
        { id: 3, action: "LOGIN", details: "Admin logged into portal", user: "Admin (0xf3...)", time: "5 hrs ago" },
        { id: 4, action: "REVOKE", details: "Admin revoked access for 'Bad Uni'", user: "Admin (0xf3...)", time: "1 day ago" },
    ];

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">System Audit Trail</h1>

            <div className="flow-root bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <ul role="list" className="-mb-8">
                    {auditTrail.map((event, eventIdx) => (
                        <li key={event.id}>
                            <div className="relative pb-8">
                                {eventIdx !== auditTrail.length - 1 ? (
                                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                                ) : null}
                                <div className="relative flex space-x-3">
                                    <div>
                                        <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${event.action === 'REVOKE' ? 'bg-red-500' :
                                                event.action === 'WHITELIST_ADD' ? 'bg-blue-500' :
                                                    'bg-green-500'
                                            }`}>
                                            <CircleDot className="h-5 w-5 text-white" aria-hidden="true" />
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                        <div>
                                            <p className="text-sm text-slate-900 font-medium">
                                                {event.details}
                                            </p>
                                            <p className="text-xs text-slate-500">Initiated by <span className="font-mono">{event.user}</span></p>
                                        </div>
                                        <div className="text-right text-sm whitespace-nowrap text-slate-500">
                                            <time>{event.time}</time>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default SystemAudit;
