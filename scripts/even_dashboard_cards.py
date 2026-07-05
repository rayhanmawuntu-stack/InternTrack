from pathlib import Path

path = Path('src/app/App.tsx')
text = path.read_text(encoding='utf-8')

if 'it-dashboard-panel h-full min-h-[440px]' in text:
    print('Dashboard card alignment is already applied.')
    raise SystemExit(0)

replacements = [
    (
        '          <div className="it-dashboard-lower grid grid-cols-1 md:grid-cols-2 gap-4">',
        '          <div className="it-dashboard-lower grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">',
        'dashboard lower grid alignment',
    ),
    (
        '''            {/* Activity */}\n            <GlassCard noPad>''',
        '''            {/* Activity */}\n            <GlassCard noPad className="it-dashboard-panel h-full min-h-[440px]">''',
        'activity panel sizing',
    ),
    (
        '''              <div className="overflow-y-auto flex-1 min-h-0 px-5 py-3 space-y-0.5" style={{ maxHeight:"min(240px, 35dvh)" }}>\n                {activities.length === 0\n                  ? <EmptyState icon={<ClipboardList size={20} className="text-pink-200" />} text="No activity logged yet." sub="Start by logging what you're working on." />''',
        '''              <div className="overflow-y-auto flex-1 min-h-0 px-5 py-3 space-y-0.5" style={{ minHeight:202 }}>\n                {activities.length === 0\n                  ? <div className="h-full flex items-center justify-center">\n                      <EmptyState icon={<ClipboardList size={20} className="text-pink-200" />} text="No activity logged yet." sub="Start by logging what you're working on." />\n                    </div>''',
        'activity content sizing',
    ),
    (
        '''              <div className="px-5 pb-5 pt-3 shrink-0">\n                <GradientButton onClick={() => setShowActForm(v => !v)} disabled={false} dimmed={false} dimStyle={{}}>\n                  <Plus size={14} /> Log New Activity\n                </GradientButton>\n              </div>''',
        '''              <div className="px-5 pb-5 pt-2 shrink-0" style={{ borderTop:"1px solid rgba(255,255,255,0.25)" }}>\n                <p className="text-[11px] mb-3" style={{ color:"rgba(61,10,32,0.4)" }}>\n                  {activities.length} {activities.length === 1 ? "activity" : "activities"} logged today\n                </p>\n                <GradientButton onClick={() => setShowActForm(v => !v)} disabled={false} dimmed={false} dimStyle={{}}>\n                  <Plus size={14} /> Log New Activity\n                </GradientButton>\n              </div>''',
        'activity footer alignment',
    ),
    (
        '''            {/* Notes */}\n            <GlassCard noPad>''',
        '''            {/* Notes */}\n            <GlassCard noPad className="it-dashboard-panel h-full min-h-[440px]">''',
        'notes panel sizing',
    ),
    (
        'function GlassCard({ children, noPad = false }: { children: React.ReactNode; noPad?: boolean }) {\n  return (\n    <div className={`rounded-2xl ${noPad ? "" : "p-5"} flex flex-col`}',
        'function GlassCard({ children, noPad = false, className = "" }: { children: React.ReactNode; noPad?: boolean; className?: string }) {\n  return (\n    <div className={`rounded-2xl ${noPad ? "" : "p-5"} flex flex-col ${className}`}',
        'GlassCard className support',
    ),
]

for old, new, label in replacements:
    if old not in text:
        raise RuntimeError(f'Could not find expected source for {label}.')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Aligned activity and notes cards with matching content and footer spacing.')
