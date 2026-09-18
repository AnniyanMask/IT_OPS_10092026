import React, { useMemo, useState } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, PieChart, Pie, Cell, AreaChart, Area, ComposedChart
} from 'recharts';
import { ChangeRequest, UserProfile, PriorityLevel } from '../types';
import { 
  TrendingUp, Clock, ShieldAlert, CheckCircle2, 
  Filter, Calendar, Building, Users, Info,
  ArrowUpRight, ArrowDownRight, Layers, Download
} from 'lucide-react';
import { format, subDays, isWithinInterval, startOfDay, endOfDay, parseISO, eachDayOfInterval } from 'date-fns';

interface AnalyticalDashboardProps {
  changeRequests: ChangeRequest[];
  users?: UserProfile[];
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#ec4899'];
const PRIORITY_COLORS: Record<string, string> = {
  'Critical': '#ef4444',
  'High': '#f97316',
  'Medium': '#eab308',
  'Low': '#10b981'
};

export const AnalyticalManagementDashboard: React.FC<AnalyticalDashboardProps> = ({ 
  changeRequests, 
  users = [] 
}) => {
  const [dateRange, setDateRange] = useState<number>(30); // Last 30 days default
  const [selectedDept, setSelectedDept] = useState<string>('ALL');

  // Filter Data
  const filteredData = useMemo(() => {
    const startDate = startOfDay(subDays(new Date(), dateRange));
    const endDate = endOfDay(new Date());

    return changeRequests.filter(cr => {
      const crDate = parseISO(cr.createdAt);
      const inDateRange = isWithinInterval(crDate, { start: startDate, end: endDate });
      const inDept = selectedDept === 'ALL' || cr.departmentName === selectedDept;
      return inDateRange && inDept;
    });
  }, [changeRequests, dateRange, selectedDept]);

  // Unique Departments for filter
  const departments = useMemo(() => {
    const depts = new Set<string>();
    changeRequests.forEach(cr => {
      if (cr.departmentName) depts.add(cr.departmentName);
    });
    return Array.from(depts).sort();
  }, [changeRequests]);

  // 1. KPI Calculations
  const metrics = useMemo(() => {
    const total = filteredData.length;
    if (total === 0) return { slaCompliance: 0, avgResolution: 0, bypassRate: 0, criticalCount: 0 };

    const resolved = filteredData.filter(cr => cr.status === 'Closed (Completed)');
    
    // SLA Compliance (Simplified: within SLA Target Hours if provided, else 7 days)
    const compliant = resolved.filter(cr => {
      if (!cr.actualCompletionDate || !cr.createdAt) return false;
      const start = parseISO(cr.createdAt).getTime();
      const end = parseISO(cr.actualCompletionDate).getTime();
      const hours = (end - start) / (1000 * 3600);
      const target = cr.slaTargetHours || 168; // 7 days default
      return hours <= target;
    }).length;

    // Avg Resolution Time
    const totalResTime = resolved.reduce((acc, cr) => {
      if (!cr.actualCompletionDate || !cr.createdAt) return acc;
      const start = parseISO(cr.createdAt).getTime();
      const end = parseISO(cr.actualCompletionDate).getTime();
      return acc + (end - start);
    }, 0);

    const avgResTimeDays = resolved.length > 0 
      ? (totalResTime / resolved.length) / (1000 * 3600 * 24) 
      : 0;

    const critical = filteredData.filter(cr => cr.priority === 'Critical').length;
    const bypassed = filteredData.filter(cr => cr.hodApprovalSkipped).length;

    return {
      slaCompliance: resolved.length > 0 ? (compliant / resolved.length) * 100 : 100,
      avgResolution: avgResTimeDays,
      bypassRate: (bypassed / total) * 100,
      criticalCount: critical
    };
  }, [filteredData]);

  // 2. Volume Trend Data (Last X days)
  const trendData = useMemo(() => {
    const startDate = startOfDay(subDays(new Date(), dateRange));
    const endDate = endOfDay(new Date());
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const formattedDate = format(day, 'MMM dd');
      
      const created = filteredData.filter(cr => 
        format(parseISO(cr.createdAt), 'yyyy-MM-dd') === dateStr
      ).length;
      
      const resolved = filteredData.filter(cr => 
        cr.actualCompletionDate && format(parseISO(cr.actualCompletionDate), 'yyyy-MM-dd') === dateStr
      ).length;

      return {
        name: formattedDate,
        created,
        resolved
      };
    });
  }, [filteredData, dateRange]);

  // 3. Department Demand
  const deptData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(cr => {
      const dept = cr.departmentName || 'Unknown';
      counts[dept] = (counts[dept] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10
  }, [filteredData]);

  // 4. IT Staff Throughput
  const staffData = useMemo(() => {
    const itStaff = users.filter(u => u.departmentName === 'IT' || u.role === 'Software Developer' || u.role === 'IT Admin');
    
    return itStaff.map(staff => {
      const completed = filteredData.filter(cr => 
        cr.assignedDeveloperName === staff.fullName && cr.status === 'Closed (Completed)'
      ).length;
      
      const inProgress = filteredData.filter(cr => 
        cr.assignedDeveloperName === staff.fullName && (cr.status === 'In Progress' || cr.status === 'Pending IT Verification')
      ).length;

      return {
        name: staff.fullName.split(' ')[0], // First name for chart
        completed,
        inProgress,
        total: completed + inProgress
      };
    }).filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredData, users]);

  // 5. Category Distribution
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(cr => {
      const cat = cr.categoryName || cr.requestType || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Global Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Analytical Management Insights
          </h2>
          <p className="text-sm text-slate-500">Live operational data and performance trends</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-xl shadow-md text-xs font-bold transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export PDF Report</span>
          </button>

          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(Number(e.target.value))}
              className="text-xs font-semibold text-slate-700 bg-transparent border-none focus:ring-0 cursor-pointer"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
              <option value={365}>Last 1 Year</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <Building className="w-4 h-4 text-slate-400" />
            <select 
              value={selectedDept} 
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-transparent border-none focus:ring-0 cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. KPI Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">SLA Compliance</span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-extrabold text-slate-900">{metrics.slaCompliance.toFixed(1)}%</h3>
            <span className="text-xs font-medium text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3 h-3" />
              Target 95%
            </span>
          </div>
          <div className="mt-4 w-full bg-slate-100 rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full transition-all duration-1000 ${metrics.slaCompliance >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
              style={{ width: `${metrics.slaCompliance}%` }} 
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Avg Resolution Time</span>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-extrabold text-slate-900">{metrics.avgResolution.toFixed(1)} Days</h3>
            <span className="text-xs font-medium text-slate-500">Across {filteredData.length} cases</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Time from submission to completion</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">HOD Bypass Rate</span>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-extrabold text-slate-900">{metrics.bypassRate.toFixed(1)}%</h3>
            <span className="text-xs font-medium text-amber-600">Emergency Route</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Critical cases skipping HOD approval</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Critical Volume</span>
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-extrabold text-slate-900">{metrics.criticalCount}</h3>
            <span className="text-xs font-medium text-slate-500">Active High Risk</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Requiring immediate IT attention</p>
        </div>
      </div>

      {/* 3. Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Line Chart: Volume Trend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800">Operational Velocity (Created vs Resolved)</h4>
            <div className="flex items-center gap-3 text-[10px] font-bold">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> INFLOW</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> OUTFLOW</div>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="created" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCreated)" />
                <Area type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorResolved)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart: IT Staff Throughput */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800">Team Throughput (Active vs Completed)</h4>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={staffData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <YAxis dataKey="name" type="category" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#475569', fontWeight: 'bold'}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                <Bar dataKey="completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={20} name="Completed Cases" />
                <Bar dataKey="inProgress" stackId="a" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} name="Active / In Progress" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart: Departmental Heatmap */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800">Departmental Service Demand</h4>
            <Building className="w-4 h-4 text-slate-400" />
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} tick={{fill: '#475569'}} angle={-15} textAnchor="end" height={60} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Category Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800">Request Category Breakdown</h4>
            <Info className="w-4 h-4 text-slate-400" />
          </div>
          <div className="h-[280px] w-full flex items-center">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-2 max-h-[240px] overflow-y-auto pr-2">
              {categoryData.slice(0, 6).map((cat, i) => (
                <div key={cat.name} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-slate-600 font-medium truncate max-w-[100px]">{cat.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">{((cat.value / filteredData.length) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
