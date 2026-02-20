import { useState, useEffect } from "react";
import { AlertCircle, ArrowUpRight } from "lucide-react";

const RevocationLogs = () => {
    // Mock Data for MVP
    const logs = [
        { id: 1, entity: "Fake Certificate #992", wallet: "0x88...123", reason: "Fraudulent Data", revoked_by: "Admin (0xf39...)", timestamp: "2024-05-20 14:30", tx_hash: "0xab...cd" },
        { id: 2, entity: "University of Nowhere", wallet: "0x77...456", reason: "Policy Violation", revoked_by: "Admin (0xf39...)", timestamp: "2024-05-18 09:15", tx_hash: "0xef...12" },
    ];

    return (
        <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">Revocation Registry</h1>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-red-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Entity Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Wallet / ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Reason</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Revoked By</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Timestamp</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Tx Hash</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{log.entity}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">{log.wallet}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 bg-red-50 px-2 rounded-full w-fit">
                                    {log.reason}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{log.revoked_by}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{log.timestamp}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:underline flex items-center">
                                    <span className="font-mono">{log.tx_hash}</span>
                                    <ArrowUpRight size={12} className="ml-1" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RevocationLogs;
