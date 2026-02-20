import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock } from "lucide-react";

const TransactionFeed = () => {
    // Mock Feed Data
    const [activities, setActivities] = useState([
        { id: 1, type: "CERT_ISSUED", entity: "IIT Bombay", time: "2 mins ago", hash: "0x3a...1f2b" },
        { id: 2, type: "UNIV_WHITELIST", entity: "NIT Trichy", time: "15 mins ago", hash: "0x8b...4c9d" },
        { id: 3, type: "CERT_REVOKED", entity: "Anna University", time: "1 hour ago", hash: "0x2c...5e1a" },
        { id: 4, type: "CERT_ISSUED", entity: "IIT Delhi", time: "2 hours ago", hash: "0x9d...3a4f" },
    ]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 h-full">
            <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800">Recent Blockchain Activity</h3>
            </div>
            <div className="p-6 space-y-6">
                {activities.map((act) => (
                    <div key={act.id} className="flex items-start space-x-4">
                        <div className={`mt-1 p-2 rounded-full ${act.type === 'CERT_ISSUED' ? 'bg-green-100 text-green-600' :
                                act.type === 'UNIV_WHITELIST' ? 'bg-blue-100 text-blue-600' :
                                    'bg-red-100 text-red-600'
                            }`}>
                            {act.type === 'CERT_ISSUED' && <CheckCircle size={16} />}
                            {act.type === 'UNIV_WHITELIST' && <CheckCircle size={16} />}
                            {act.type === 'CERT_REVOKED' && <XCircle size={16} />}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">
                                {act.type === 'CERT_ISSUED' ? 'Certificate Issued' :
                                    act.type === 'UNIV_WHITELIST' ? 'University Whitelisted' :
                                        'Certificate Revoked'}
                            </p>
                            <p className="text-xs text-slate-500">by <span className="font-semibold text-slate-700">{act.entity}</span></p>
                            <div className="flex items-center mt-1 text-xs text-slate-400">
                                <Clock size={12} className="mr-1" />
                                {act.time}
                                <span className="mx-2">•</span>
                                <span className="font-mono bg-slate-100 px-1 rounded">{act.hash}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TransactionFeed;
