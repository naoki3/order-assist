import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">

      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-700 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">OA</span>
            </div>
            <span className="font-bold text-slate-800">Order Assist</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
              ログイン
            </Link>
            <Link href="/signup" className="text-sm bg-green-700 text-white px-4 py-1.5 rounded-lg hover:bg-green-800 transition-colors font-medium">
              無料で始める
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center" style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #ffffff 60%)' }}>
        <div className="max-w-3xl mx-auto">
          <span className="inline-block text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full mb-6 tracking-wide uppercase">
            在庫・発注管理ツール
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-6">
            発注の勘を、<br className="sm:hidden" />
            <span className="text-green-700">データ</span>に変える。
          </h1>
          <p className="text-lg text-slate-500 mb-10 leading-relaxed max-w-xl mx-auto">
            過去7日間の売上を自動分析し、今日発注すべき数量を提案。在庫切れ・過剰在庫を防ぎ、発注業務をシンプルにします。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup" className="px-8 py-3.5 bg-green-700 text-white font-bold rounded-xl hover:bg-green-800 transition-colors shadow-sm text-base">
              無料で始める
            </Link>
            <Link href="/login" className="px-8 py-3.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors text-base">
              ログイン
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-slate-100 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-6 text-center">
          {[
            { value: '7日分', label: '売上データを自動分析' },
            { value: '3秒', label: '発注内容を確認・確定' },
            { value: '0円', label: '初期費用・月額費用' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl sm:text-3xl font-extrabold text-green-700">{s.value}</p>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">すべての発注業務を、一画面で</h2>
          <p className="text-slate-500 text-center mb-14 text-sm">複雑な設定不要。登録してすぐ使えます。</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: '📊',
                title: '自動発注提案',
                desc: '過去7日の販売実績から平均需要を計算。リードタイムと安全在庫を考慮した発注数を自動算出します。',
              },
              {
                icon: '⚠️',
                title: '在庫切れ・過剰アラート',
                desc: '在庫切れリスクのある商品を赤、過剰在庫を黄色でハイライト。一目で優先順位が把握できます。',
              },
              {
                icon: '📦',
                title: '入荷管理',
                desc: '発注した商品の入荷予定を管理。入荷確認ボタンで在庫を自動更新します。',
              },
              {
                icon: '📈',
                title: 'ダッシュボード',
                desc: '売上トレンドと在庫状況をグラフで可視化。店舗の状態をひと目で把握できます。',
              },
              {
                icon: '📋',
                title: '発注履歴',
                desc: '過去の発注をすべて記録。いつ・何を・何個発注したか、いつでも確認できます。',
              },
              {
                icon: '📥',
                title: 'CSVインポート',
                desc: '既存の売上データをCSVで一括取り込み。面倒な手入力なしにスムーズに移行できます。',
              },
            ].map((f) => (
              <div key={f.title} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">使い方はシンプル3ステップ</h2>
          <p className="text-slate-500 text-center mb-14 text-sm">難しい操作は一切ありません。</p>
          <div className="space-y-6">
            {[
              { step: '01', title: '商品を登録する', desc: 'リードタイムと安全在庫日数を設定するだけ。商品ページから30秒で登録できます。' },
              { step: '02', title: '売上を記録する', desc: '日々の販売数を入力、またはCSVで一括インポート。データが溜まるほど精度が上がります。' },
              { step: '03', title: '今日の発注を確認する', desc: 'トップ画面に自動計算された発注提案が表示されます。数量を調整して「発注」を押すだけ。' },
            ].map((s, i) => (
              <div key={s.step} className="flex gap-5 items-start bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <div className="shrink-0 w-10 h-10 rounded-full bg-green-700 text-white font-bold text-sm flex items-center justify-center">
                  {s.step}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 mb-1">{s.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center" style={{ background: 'linear-gradient(135deg, #14532d 0%, #166534 100%)' }}>
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">今日から発注業務を変えよう</h2>
          <p className="text-green-200 mb-8 text-sm leading-relaxed">
            無料でアカウントを作成して、すぐに使い始めることができます。
          </p>
          <Link href="/signup" className="inline-block px-10 py-4 bg-white text-green-800 font-bold rounded-xl hover:bg-green-50 transition-colors shadow-lg text-base">
            無料で始める →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-100 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 bg-green-700 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">OA</span>
          </div>
          <span className="font-semibold text-slate-700 text-sm">Order Assist</span>
        </div>
        <p className="text-xs text-slate-400">在庫・発注管理をシンプルに</p>
      </footer>

    </div>
  );
}
