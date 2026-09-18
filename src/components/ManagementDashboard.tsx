import React, { useEffect, useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, Cell, ComposedChart, Line
} from 'recharts';
import { 
  TrendingUp, Clock, ShieldCheck, Users, 
  AlertTriangle, CheckCircle2, XCircle, RefreshCcw,
  BarChart3, FileSpreadsheet, History, UserCheck,
  Award, Briefcase, LayoutDashboard
} from 'lucide-react';
import { api } from '../services/api';
import { format } from 'date-fns';

interface ManagementStats {
  staffMatrix: any[];
  slaAudit: any[];
  delegationAudit: any[];
  kpis: { totalCr: number; activeCr: number; avgTurnaroundHours: number };
}

const PRIORITY_POINTS: Record<string, number> = {
  'Critical': 10,
  'High': 6,
  'Medium': 3,
  'Low': 3
};

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export const ManagementDashboard: React.FC = () => {
  const [stats, setStats] = useState<ManagementStats | null>(null);
  const [workloadDetail, setWorkloadDetail] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, workloadRes] = await Promise.all([
        api.getManagementStats(),
        api.getStaffWorkloadPoints()
      ]);
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (workloadRes.success && workloadRes.data) setWorkloadDetail(workloadRes.data);
    } catch (err) {
      console.error('Dashboard Load Error', err);
    } finally {
      setLoading(false);
    }
  };

  const workloadChartData = useMemo(() => {
    const data: Record<string, any> = {};
    workloadDetail.forEach(item => {
      if (!data[item.staffName]) {
        data[item.staffName] = { name: item.staffName, Critical: 0, High: 0, MediumLow: 0, totalPoints: 0 };
      }
      if (item.priority === 'Critical') data[item.staffName].Critical += Number(item.points);
      else if (item.priority === 'High') data[item.staffName].High += Number(item.points);
      else data[item.staffName].MediumLow += Number(item.points);
      
      data[item.staffName].totalPoints += Number(item.points);
    });
    return Object.values(data).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [workloadDetail]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-500 font-bold animate-pulse">Calculating Enterprise Performance Metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <LayoutDashboard className="w-7 h-7 text-indigo-600" />
            Management Command Center
          </h2>
          <p className="text-sm text-slate-500 font-medium italic">"Data-driven IT operational transparency & SLA governance"</p>
        </div>
        <button 
          onClick={fetchData}
          className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
          Refresh Live Data
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-16 h-16 text-blue-600" />
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Total Closed Requests</p>
          <h3 className="text-4xl font-black text-slate-900 leading-tight">{stats?.kpis.totalCr || 0}</h3>
          <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Historical Completion Volume
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Briefcase className="w-16 h-16 text-amber-600" />
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Live Active Load</p>
          <h3 className="text-4xl font-black text-slate-900 leading-tight">{stats?.kpis.activeCr || 0}</h3>
          <p className="text-[10px] text-amber-600 font-bold mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Currently In Progress
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Award className="w-16 h-16 text-emerald-600" />
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Avg. Cycle Time (Hrs)</p>
          <h3 className="text-4xl font-black text-slate-900 leading-tight">{stats?.kpis.avgTurnaroundHours || 0}</h3>
          <p className="text-[10px] text-slate-400 font-bold mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Performance Benchmark
          </p>
        </div>
      </div>

      {/* 1. IT Staff Performance Matrix */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-2xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">IT Staff Performance Matrix</h3>
              <p className="text-xs text-slate-500">Comparative efficiency & SLA compliance (Sorted A-Z)</p>
            </div>
          </div>
          <div className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-tighter">
            Power BI View
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                <th className="px-6 py-4 border-b border-slate-100">IT Staff Name</th>
                <th className="px-4 py-4 border-b border-slate-100 text-center">Total CRs</th>
                <th className="px-4 py-4 border-b border-slate-100 text-center">Completed</th>
                <th className="px-4 py-4 border-b border-slate-100 text-center text-rose-600">Rejected</th>
                <th className="px-4 py-4 border-b border-slate-100 text-center text-blue-600">In Progress</th>
                <th className="px-4 py-4 border-b border-slate-100 text-center text-amber-600">Returned</th>
                <th className="px-4 py-4 border-b border-slate-100 text-center font-black text-slate-900">Total Points</th>
                <th className="px-6 py-4 border-b border-slate-100 text-right">SLA Compliance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stats?.staffMatrix.map((staff, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                      {staff.staffName.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-bold text-slate-700">{staff.staffName}</span>
                  </td>
                  <td className="px-4 py-4 text-center text-sm font-medium text-slate-500">{staff.totalCases}</td>
                  <td className="px-4 py-4 text-center">
                    <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
                      {staff.completed}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center text-sm font-bold text-rose-500">{staff.rejected}</td>
                  <td className="px-4 py-4 text-center text-sm font-bold text-blue-500">{staff.inProgress}</td>
                  <td className="px-4 py-4 text-center text-sm font-bold text-amber-500">{staff.returned}</td>
                  <td className="px-4 py-4 text-center">
                    <div className="relative pt-1">
                      <span className="text-xs font-black text-slate-900">{staff.totalPoints}</span>
                      <div className="overflow-hidden h-1.5 mb-4 text-xs flex rounded bg-slate-100 mt-1">
                        <div style={{ width: `${Math.min((staff.totalPoints / 100) * 100, 100)}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500"></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className={`text-xs font-black ${Number(staff.slaCompliancePercent) >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {staff.slaCompliancePercent || 0}%
                      </span>
                      <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${Number(staff.slaCompliancePercent) >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                          style={{ width: `${staff.slaCompliancePercent || 0}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Staff Workload Points Report */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-700 rounded-2xl">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Workload Complexity Distribution</h3>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '20px' }} />
                <Bar dataKey="Critical" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} name="Critical (10pts)" barSize={40} />
                <Bar dataKey="High" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} name="High (6pts)" barSize={40} />
                <Bar dataKey="MediumLow" stackId="a" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Others (3pts)" barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[10px] text-slate-500 leading-relaxed uppercase tracking-widest font-bold text-center">
            Weighted by: Critical (10) | High (6) | Medium/Low (3)
          </div>
        </section>

        {/* SLA Turnaround Audit */}
        <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">SLA Turnaround Exception Log</h3>
            </div>
            <div className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[9px] font-black uppercase rounded border border-rose-100 animate-pulse">
              Breached Cases
            </div>
          </div>
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
            {stats?.slaAudit.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-12 h-12 text-emerald-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-bold">Excellent! No SLA breaches detected.</p>
              </div>
            ) : (
              stats?.slaAudit.map((audit) => (
                <div key={audit.id} className="p-4 rounded-2xl border border-slate-100 hover:border-rose-200 hover:bg-rose-50/30 transition-all group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded uppercase">{audit.id}</span>
                      <span className="text-[10px] font-bold text-slate-400 tracking-tight">{audit.staffName}</span>
                    </div>
                    <span className="text-[11px] font-black text-rose-600 flex items-center gap-1">
                      +{Math.max(0, audit.actualHours - audit.targetHours)}h Over Target
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 line-clamp-1 mb-2">{audit.title}</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">Requester: {audit.requesterName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-slate-500">Target: {audit.targetHours}h</span>
                      <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-1.5 rounded">Actual: {audit.actualHours}h</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* 3. Temporary Approver & Delegation Audit */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Delegation & Temporary Approver Audit</h3>
              <p className="text-xs text-slate-500">Audit trail for departmental HOD coverage & delegate actions</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                <th className="px-6 py-4 border-b border-slate-100">Original HOD</th>
                <th className="px-4 py-4 border-b border-slate-100">Delegate Approver</th>
                <th className="px-4 py-4 border-b border-slate-100 text-center">Coverage Window</th>
                <th className="px-4 py-4 border-b border-slate-100">Reason</th>
                <th className="px-4 py-4 border-b border-slate-100 text-center">Status</th>
                <th className="px-6 py-4 border-b border-slate-100 text-right">Actions Taken</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stats?.delegationAudit.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm italic">No delegation records found in current audit cycle.</td>
                </tr>
              ) : (
                stats?.delegationAudit.map((del, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-700">{del.hodName}</p>
                      <p className="text-[10px] text-slate-400 font-medium italic">Dept HOD</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Award className="w-3.5 h-3.5 text-indigo-500" />
                        <p className="text-sm font-bold text-slate-700">{del.delegateName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <p className="text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full inline-block">
                        {format(new Date(del.startDate), 'dd MMM')} - {format(new Date(del.endDate), 'dd MMM yyyy')}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-slate-500 font-medium">{del.reason}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        del.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                      }`}>
                        {del.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                        {del.actionsTaken} Approvals
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer Audit Stamp */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          <History className="w-3.5 h-3.5" />
          System Generated Audit Report • {new Date().toLocaleString()}
        </div>
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          Enterprise Governance v1.0.22
        </div>
      </div>
    </div>
  );
};
