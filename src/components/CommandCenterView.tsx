import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ChevronDown, 
  ArrowDown, 
  Play, 
  TrendingDown, 
  Info,
  ExternalLink,
  MoreVertical,
  Activity,
  UserCheck,
  Video
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip,
  BarChart,
  Bar
} from 'recharts';

// Mock views data points for the main chart matching the screenshot curve
const mainChartData = [
  { date: '2 Jun 2026', views: 650000, hasShort: true, hasVideo: true },
  { date: '4 Jun 2026', views: 800000, hasShort: false, hasVideo: false },
  { date: '6 Jun 2026', views: 500000, hasShort: false, hasVideo: false },
  { date: '8 Jun 2026', views: 400000, hasShort: false, hasVideo: false },
  { date: '10 Jun 2026', views: 350000, hasShort: false, hasVideo: false },
  { date: '12 Jun 2026', views: 300000, hasShort: false, hasVideo: false },
  { date: '14 Jun 2026', views: 280000, hasShort: false, hasVideo: false },
  { date: '16 Jun 2026', views: 310000, hasShort: true, hasVideo: true },
  { date: '18 Jun 2026', views: 360000, hasShort: false, hasVideo: false },
  { date: '20 Jun 2026', views: 550000, hasShort: true, hasVideo: false },
  { date: '22 Jun 2026', views: 420000, hasShort: false, hasVideo: false },
  { date: '24 Jun 2026', views: 330000, hasShort: false, hasVideo: false },
  { date: '26 Jun 2026', views: 320000, hasShort: false, hasVideo: false },
  { date: '28 Jun 2026', views: 380000, hasShort: false, hasVideo: false },
  { date: '29 Jun 2026', views: 420000, hasShort: false, hasVideo: false },
];

// Mock data for the 48h Realtime bar chart
const realtime48hData = Array.from({ length: 48 }, (_, i) => ({
  hour: i,
  views: Math.floor(Math.random() * 15000) + 5000
}));

// Custom Dot to render Shorts/Video icons on the X Axis
const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (!payload.hasShort && !payload.hasVideo) return null;

  return (
    <g transform={`translate(${cx - 10}, ${cy + 10})`}>
      {payload.hasShort && (
        <circle cx="10" cy="10" r="8" fill="#ff0000" />
      )}
      {payload.hasShort && (
        <path d="M8 7l5 3-5 3V7z" fill="#ffffff" transform="translate(-1, -1) scale(0.8)" />
      )}
    </g>
  );
};

export default function CommandCenterView() {
  const [activeSubTab, setActiveSubTab] = useState<'Overview' | 'Content' | 'Audience' | 'Revenue' | 'Trends'>('Overview');
  const [selectedMetric, setSelectedMetric] = useState<'views' | 'watchtime' | 'subs' | 'revenue'>('views');

  return (
    <div className="text-[#f1f1f1] font-sans">
      
      {/* Top Header Bar */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Channel analytics</h1>
        <button className="px-4 py-1.5 bg-[#272727] hover:bg-[#3f3f3f] text-sm font-semibold rounded-full transition duration-200">
          Advanced mode
        </button>
      </div>

      {/* Navigation Subtabs & Date Picker */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#272727] mb-6 pb-0.5 gap-4">
        <div className="flex gap-6 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          {(['Overview', 'Content', 'Audience', 'Revenue', 'Trends'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`text-sm font-semibold tracking-wide pb-3 relative transition-colors ${
                activeSubTab === tab ? 'text-white' : 'text-[#aaaaaa] hover:text-white'
              }`}
            >
              {tab}
              {activeSubTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white rounded-t" />
              )}
            </button>
          ))}
        </div>

        {/* Date Selector dropdown */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-[#aaaaaa] bg-[#1f1f1f] border border-[#272727] px-3.5 py-1.8 rounded cursor-pointer hover:bg-[#272727] transition select-none">
          <div className="text-right">
            <span className="block text-[10px] text-[#aaaaaa]">2 – 29 Jun 2026</span>
            <span className="block font-bold text-white uppercase text-[9px] mt-0.5">Last 28 days</span>
          </div>
          <ChevronDown className="h-4 w-4 text-[#aaaaaa]" />
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 xl:grid-cols-10 gap-6">
        
        {/* Left Column (Main analytics timeline, chart, and alert box) */}
        <div className="xl:col-span-7 space-y-6">
          
          {/* Main Chart Box */}
          <div className="bg-[#161616] border border-[#272727] rounded-xl p-5 shadow-lg">
            
            {/* Header message */}
            <div className="mb-6">
              <h2 className="text-xl font-medium text-white tracking-tight">
                Your channel got <span className="font-bold">9,354,379</span> views in the last 28 days
              </h2>
              <p className="text-xs text-[#aaaaaa] mt-1.5">
                Your channel usually gets 12,850,000–30,950,000 views in 28 days
              </p>
            </div>

            {/* Metrics cards bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-[#272727] rounded-xl overflow-hidden bg-[#0f0f0f] mb-6">
              
              {/* Views Card */}
              <button 
                onClick={() => setSelectedMetric('views')}
                className={`p-4 text-left border-r border-[#272727] flex flex-col justify-between transition-colors ${selectedMetric === 'views' ? 'bg-[#161616]' : 'hover:bg-[#161616]/40'}`}
              >
                <div className="flex items-center gap-1 text-[11px] text-[#aaaaaa] font-medium tracking-wide">
                  <span>Views</span>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl font-bold tracking-tight text-white flex items-center gap-1.5 leading-none">
                    9.4m
                    <div className="h-5 w-5 rounded-full bg-[#272727] flex items-center justify-center">
                      <ArrowDown className="h-3 w-3 text-[#aaaaaa]" />
                    </div>
                  </span>
                  <span className="text-[10px] text-[#aaaaaa] block mt-1.5 font-mono">3.5m less than usual</span>
                </div>
              </button>

              {/* Watch Time Card */}
              <button 
                onClick={() => setSelectedMetric('watchtime')}
                className={`p-4 text-left border-r border-[#272727] flex flex-col justify-between transition-colors ${selectedMetric === 'watchtime' ? 'bg-[#161616]' : 'hover:bg-[#161616]/40'}`}
              >
                <div className="flex items-center gap-1 text-[11px] text-[#aaaaaa] font-medium tracking-wide">
                  <span>Watch time (hours)</span>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl font-bold tracking-tight text-white flex items-center gap-1.5 leading-none">
                    118.1k
                    <div className="h-5 w-5 rounded-full bg-[#272727] flex items-center justify-center">
                      <ArrowDown className="h-3 w-3 text-[#aaaaaa]" />
                    </div>
                  </span>
                  <span className="text-[10px] text-[#aaaaaa] block mt-1.5 font-mono">72.9k less than usual</span>
                </div>
              </button>

              {/* Subscribers Card */}
              <button 
                onClick={() => setSelectedMetric('subs')}
                className={`p-4 text-left border-r border-[#272727] flex flex-col justify-between transition-colors ${selectedMetric === 'subs' ? 'bg-[#161616]' : 'hover:bg-[#161616]/40'}`}
              >
                <div className="flex items-center gap-1 text-[11px] text-[#aaaaaa] font-medium tracking-wide">
                  <span>Subscribers</span>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl font-bold tracking-tight text-white flex items-center gap-1.5 leading-none">
                    +7.3k
                    <div className="h-5 w-5 rounded-full bg-[#272727] flex items-center justify-center">
                      <ArrowDown className="h-3 w-3 text-[#aaaaaa]" />
                    </div>
                  </span>
                  <span className="text-[10px] text-[#aaaaaa] block mt-1.5 font-mono">8.7k less than usual</span>
                </div>
              </button>

              {/* Revenue Card */}
              <button 
                onClick={() => setSelectedMetric('revenue')}
                className={`p-4 text-left flex flex-col justify-between transition-colors ${selectedMetric === 'revenue' ? 'bg-[#161616]' : 'hover:bg-[#161616]/40'}`}
              >
                <div className="flex items-center gap-1 text-[11px] text-[#aaaaaa] font-medium tracking-wide">
                  <span>Estimated revenue</span>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl font-bold tracking-tight text-white flex items-center gap-1.5 leading-none">
                    ₹13,832.47
                    <div className="h-5 w-5 rounded-full bg-[#272727] flex items-center justify-center">
                      <ArrowDown className="h-3 w-3 text-[#aaaaaa]" />
                    </div>
                  </span>
                  <span className="text-[10px] text-[#aaaaaa] block mt-1.5 font-mono">₹9,767.53 less than usual</span>
                </div>
              </button>

            </div>

            {/* Line Chart */}
            <div className="h-72 w-full relative mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mainChartData} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="viewsGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00bcd4" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#00bcd4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    stroke="#3e3e3e" 
                    fontSize={10} 
                    tickLine={false} 
                    dy={10}
                    tickFormatter={(tick) => {
                      if (tick.includes('2 Jun') || tick.includes('7 Jun') || tick.includes('11 Jun') || tick.includes('16 Jun') || tick.includes('20 Jun') || tick.includes('25 Jun') || tick.includes('29 Jun')) {
                        return tick;
                      }
                      return '';
                    }}
                  />
                  <YAxis 
                    stroke="#3e3e3e" 
                    fontSize={10} 
                    axisLine={false} 
                    tickLine={false} 
                    orientation="right"
                    tickFormatter={(val) => {
                      if (val === 0) return '0';
                      if (val === 300000) return '300.0k';
                      if (val === 600000) return '600.0k';
                      if (val === 900000) return '900.0k';
                      return '';
                    }}
                    domain={[0, 950000]}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f1f1f', border: '1px solid #282828', borderRadius: '4px' }}
                    labelStyle={{ fontSize: 10, color: '#aaaaaa' }}
                    itemStyle={{ fontSize: 11, color: '#ffffff' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="views" 
                    stroke="#00bcd4" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#viewsGlow)"
                    dot={<CustomDot />}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* See More link */}
            <div className="pt-2">
              <button className="px-5 py-2 bg-[#282828] hover:bg-[#3e3e3e] text-xs font-semibold rounded-full tracking-wide transition">
                See more
              </button>
            </div>

          </div>

          {/* Lower Alert Box: Why are views lower than usual */}
          <div className="bg-[#161616] border border-[#272727] rounded-xl p-5 flex flex-col gap-4 shadow-lg">
            
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white tracking-tight">Why are views lower than usual?</h3>
              <p className="text-xs text-[#aaaaaa] leading-relaxed">
                7 videos were published instead of the usual 11–15, which led to fewer views
              </p>
            </div>

            {/* Custom slider target comparison bar */}
            <div className="w-full max-w-xl py-4 relative">
              
              {/* Outer track bar */}
              <div className="w-full bg-[#272727] h-2 rounded-full relative">
                
                {/* Target Range fill (11 to 15 matching screenshot green section) */}
                <div className="absolute left-[73%] right-[10%] bg-emerald-500 h-2 rounded-full" />

                {/* Lower pointer marker */}
                <div className="absolute left-[46.6%] -top-12 flex flex-col items-center">
                  <div className="bg-[#272727] text-white px-2.5 py-1.5 rounded-lg border border-[#3e3e3e] text-[10px] font-semibold text-center shadow-md">
                    <span className="block font-bold">7 videos published</span>
                    <span className="block text-[8px] text-[#aaaaaa] mt-0.5">Lower than usual</span>
                  </div>
                  <div className="w-2.5 h-2.5 bg-[#272727] border-r border-b border-[#3e3e3e] rotate-45 -mt-1.5 mb-1.5" />
                  <div className="h-4.5 w-4.5 rounded-full bg-neutral-900 border border-[#3e3e3e] flex items-center justify-center shadow">
                    <ArrowDown className="h-2.5 w-2.5 text-[#aaaaaa]" />
                  </div>
                </div>

                {/* Target Range Text badges */}
                <div className="absolute left-[73%] -bottom-5 text-[9px] font-semibold text-[#aaaaaa]">11</div>
                <div className="absolute right-[10%] -bottom-5 text-[9px] font-semibold text-[#aaaaaa]">15</div>

              </div>
              
            </div>

          </div>

        </div>

        {/* Right Column (Realtime updating sidebar feed) */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* Realtime Stats Box */}
          <div className="bg-[#161616] border border-[#272727] rounded-xl p-5 shadow-lg flex flex-col gap-4">
            
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white tracking-tight">Realtime</h3>
              <div className="flex items-center gap-1.5 text-[10px] text-[#aaaaaa]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span>Updating live</span>
              </div>
            </div>

            {/* Subscribers Count */}
            <div>
              <span className="text-3xl font-bold tracking-tight text-white font-sans">927,803</span>
              <span className="block text-[10px] text-[#aaaaaa] mt-0.5">Subscribers</span>
            </div>

            {/* Live Count Button */}
            <div>
              <button className="px-4 py-1.5 bg-[#282828] hover:bg-[#3e3e3e] text-xs font-semibold rounded-full tracking-wide transition">
                See live count
              </button>
            </div>

            <div className="h-px w-full bg-[#272727] my-1" />

            {/* Views 48h count */}
            <div>
              <span className="text-xl font-bold text-white font-sans">688,302</span>
              <span className="block text-[10px] text-[#aaaaaa] mt-0.5">Views • Last 48 hours</span>
            </div>

            {/* 48h mini Bar Chart */}
            <div className="h-12 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={realtime48hData} barCategoryGap={1}>
                  <Bar dataKey="views" fill="#3ea6ff" radius={[1, 1, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-between items-center text-[9px] text-[#aaaaaa] font-mono leading-none -mt-2.5">
              <span>48h ago</span>
              <span>Now</span>
            </div>

            <div className="h-px w-full bg-[#272727] my-1" />

            {/* Top Content List */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-white">Top content</span>
                <span className="text-[10px] text-[#aaaaaa] font-semibold font-mono">Views</span>
              </div>

              {/* Item 1 */}
              <div className="flex items-center gap-3 justify-between py-1 group/item cursor-pointer">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Mock thumbnail */}
                  <div className="w-8 h-8 rounded bg-[#272727] flex items-center justify-center shrink-0 text-red-500 font-bold border border-[#3e3e3e]">
                    <Video className="h-4 w-4 text-[#aaaaaa]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-white truncate leading-snug group-hover/item:text-blue-400 transition-colors">
                      "Project Muscle" - A New System explainer
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold font-mono text-white shrink-0">287,505</span>
              </div>

              {/* Item 2 */}
              <div className="flex items-center gap-3 justify-between py-1 group/item cursor-pointer">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Mock thumbnail */}
                  <div className="w-8 h-8 rounded bg-[#272727] flex items-center justify-center shrink-0 text-red-500 font-bold border border-[#3e3e3e]">
                    <Video className="h-4 w-4 text-[#aaaaaa]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-white truncate leading-snug group-hover/item:text-blue-400 transition-colors">
                      Efficient way to use databases under high load
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold font-mono text-white shrink-0">115,369</span>
              </div>

              {/* Item 3 */}
              <div className="flex items-center gap-3 justify-between py-1 group/item cursor-pointer">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Mock thumbnail */}
                  <div className="w-8 h-8 rounded bg-[#272727] flex items-center justify-center shrink-0 text-red-500 font-bold border border-[#3e3e3e]">
                    <Video className="h-4 w-4 text-[#aaaaaa]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-white truncate leading-snug group-hover/item:text-blue-400 transition-colors">
                      Why MRI sounds like techno music (decode)
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold font-mono text-white shrink-0">72,775</span>
              </div>

            </div>

            {/* See More Link */}
            <div className="pt-1">
              <button className="w-full text-center py-2 bg-[#282828] hover:bg-[#3e3e3e] text-xs font-semibold rounded-full tracking-wide transition text-white">
                See more
              </button>
            </div>

          </div>

          {/* Latest Content Card Box */}
          <div className="bg-[#161616] border border-[#272727] rounded-xl p-5 shadow-lg flex flex-col gap-4">
            
            <h3 className="text-sm font-bold text-white tracking-tight">Latest content</h3>
            
            {/* Visual Thumbnail Frame */}
            <div className="w-full aspect-video rounded-lg bg-neutral-900 border border-[#272727] relative overflow-hidden flex items-center justify-center group/card cursor-pointer">
              {/* Creator Photo mockup overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
              
              {/* Text overlay */}
              <div className="absolute bottom-3 left-3 right-3 z-20 space-y-1">
                <span className="px-2 py-0.5 bg-red-600 text-white rounded text-[8px] font-bold uppercase tracking-wider">Shorts</span>
                <h4 className="text-xs font-bold text-white leading-snug drop-shadow">
                  Data centers in space?
                </h4>
              </div>

              {/* Central Play/Indicator */}
              <div className="h-10 w-10 rounded-full bg-black/40 border border-white/20 flex items-center justify-center group-hover/card:scale-110 transition duration-300">
                <Play className="h-4 w-4 text-white fill-current" />
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
