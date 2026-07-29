import { useEffect, useRef } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

const SECTIONS = [
  { id: 's0', label: 'Getting Started' },
  { id: 's1', label: 'Personal Details' },
  { id: 's2', label: 'Income & Expenses' },
  { id: 's3', label: 'Portfolio' },
  { id: 's4', label: 'Goals & Build Plan' },
  { id: 's5', label: 'Dashboard' },
  { id: 's6', label: 'Projections' },
  { id: 's7', label: 'Tax Planning' },
  { id: 's8', label: 'Monte Carlo' },
];

export default function HowToGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const isMobile = useIsMobile();
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const scrollTo = (id: string) => {
    const el = bodyRef.current?.querySelector(`#${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How to use Retirement Optimizer"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(13,27,46,0.45)',
        zIndex: isMobile ? 160 : 100,
        display: 'flex',
        justifyContent: isMobile ? undefined : 'flex-end',
        alignItems: isMobile ? 'flex-end' : undefined,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? '100%' : 'min(780px, 100%)',
          height: isMobile ? '92vh' : '100%',
          borderRadius: isMobile ? '20px 20px 0 0' : undefined,
          background: 'var(--bg-surface, #fff)',
          boxShadow: isMobile ? '0 -8px 24px rgba(13,27,46,0.25)' : '-8px 0 24px rgba(13,27,46,0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {isMobile && (
          <div style={{ width: 40, height: 4, background: 'rgba(13,27,46,0.15)', borderRadius: 2, margin: '12px auto 0', flexShrink: 0 }} />
        )}

        {/* Header */}
        <div style={{
          padding: '14px 20px 12px',
          borderBottom: '1px solid var(--border-light)',
          background: 'rgba(250,247,242,0.6)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>Reference</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Playfair Display', serif" }}>
                How to Use Retirement Optimizer
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                border: '1px solid var(--border-light)', background: 'transparent',
                borderRadius: 8, padding: '6px 12px', fontSize: 13,
                cursor: 'pointer', color: 'var(--text-secondary)',
              }}
            >Close</button>
          </div>
          {/* Section nav chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                style={{
                  background: 'var(--bg-muted, #f5f4f2)', border: '1px solid var(--border-light)',
                  borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', color: 'var(--text-secondary)', whiteSpace: 'nowrap',
                }}
              >{s.label}</button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', paddingBottom: isMobile ? 'calc(24px + env(safe-area-inset-bottom))' : 24 }}>
          <GuideContent />
        </div>
      </div>
    </div>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} style={{
      fontSize: 17, fontWeight: 700, color: 'var(--text-primary)',
      fontFamily: "'Playfair Display', serif",
      borderBottom: '2px solid var(--gold, #c9a84c)', paddingBottom: 6,
      marginTop: 40, marginBottom: 12,
    }}>{children}</h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 18, marginBottom: 6 }}>
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 10px' }}>{children}</p>;
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)',
      borderRadius: 8, padding: '10px 14px', margin: '12px 0',
      fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
    }}>
      <strong style={{ color: 'var(--gold, #c9a84c)' }}>Tip: </strong>{children}
    </div>
  );
}

function FieldTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
      <thead>
        <tr style={{ background: 'var(--bg-muted, #f5f4f2)' }}>
          {['Field', 'What it means', 'Example'].map((h) => (
            <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([field, meaning, example], i) => (
          <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
            <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{field}</td>
            <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{meaning}</td>
            <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>{example}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GuideContent() {
  return (
    <div>

      {/* ── Section 0: Getting Started ───────────────────────── */}
      <H2 id="s0">Getting Started</H2>
      <P>
        Retirement Optimizer models your retirement year-by-year. Enter your personal details, sources of income,
        expected expenses, and portfolio balances — then click <strong>Build Plan</strong>. The
        engine runs an optimizer and projects how your money grows and shrinks over decades,
        showing you whether it lasts.
      </P>
      <P>
        There is no "correct" answer: the plan is as good as the numbers you put in. Aim for
        reasonable estimates, not perfection. Being within 10–15% of reality is plenty accurate
        for a 30-year forecast.
      </P>
      <H3>How the app is organized</H3>
      <P>
        The nav bar below the header has two tabs: <strong>Inputs</strong> and <strong>Results</strong>.
        The Inputs page is a single scrollable form with four sections stacked top to bottom. After
        you fill them in and click <strong>Build Plan →</strong>, the app optimizes your plan
        and takes you to the Dashboard. Results has four sub-pages: Dashboard, Projections,
        Taxes &amp; Roth Conversions, and Monte Carlo.
      </P>
      <P>
        On the right side of that same nav bar is a <strong>Today's $ / Nominal $</strong> toggle.
        <em>Today's $</em> (the default) shows every chart and balance in inflation-adjusted
        purchasing power — useful for comparing future balances to your current cost of living.
        <em>Nominal $</em> shows the raw inflated numbers as they will actually appear on account
        statements. Switch between them at any time; it affects all Results charts instantly.
      </P>
      <H3>Recommended fill order</H3>
      <ol style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: 0 }}>
        <li><strong>Personal Details</strong> — names, ages, state of residence, ACA settings</li>
        <li><strong>Income &amp; Expenses</strong> — every income source and spending category</li>
        <li><strong>Portfolio</strong> — current balances, growth rates, and annual contributions</li>
        <li><strong>Goals</strong> — pick what the optimizer should solve for, then click Build Plan</li>
        <li><strong>Results</strong> — review Dashboard, Projections, Tax Planning, and Monte Carlo</li>
      </ol>

      {/* ── Section 1: Personal Details ──────────────────────── */}
      <H2 id="s1">Personal Details</H2>
      <P>
        The first section on the Inputs page. These fields set the time horizon for every
        calculation in the app.
      </P>

      <H3>People</H3>
      <FieldTable rows={[
        ['Name', 'A label used in charts and tables. Has no effect on calculations.', '"Alex"'],
        ['Date of Birth', 'Used to compute your current age and all future milestone ages.', '1970-04-15'],
        ['Retirement Age', 'The age you plan to stop working. Contributions end here; withdrawals begin.', '62'],
        ['Plan-To Age', 'The end of the projection. Pick an age you want money to last until. 90–95 is conservative.', '92'],
        ['Passing Age', 'Only used if you have a spouse. Determines when survivor Social Security transitions.', '85'],
      ]} />
      <Tip>
        Add a spouse or partner by clicking "+ Add Spouse / Partner." Each person can have
        different retirement ages — useful if one of you plans to work longer.
      </Tip>

      <H3>State of Residence</H3>
      <P>
        Select your state from the dropdown. Retirement Optimizer automatically applies that state's income
        tax rules to all retirement withdrawals. If you plan to move to a no-income-tax state
        in retirement, pick that state instead.
      </P>

      <H3>ACA Healthcare</H3>
      <P>
        If you will retire before age 65 (when Medicare begins), you will likely buy health
        insurance through the ACA marketplace. Enable the "Model pre-Medicare costs" toggle
        to include this cost — and any subsidies you qualify for.
      </P>
      <FieldTable rows={[
        ['Annual Premium', 'The full benchmark (SLCSP) premium for your region, before subsidies. Look this up on healthcare.gov.', '$18,000/yr'],
        ['Household Size', 'Number of people on your ACA plan. Larger households qualify for higher subsidies.', '2'],
        ['No subsidy (COBRA)', 'Check this if your income is too high for subsidies, or you are using COBRA. The full premium is modeled.', '—'],
      ]} />

      {/* ── Section 2: Income & Expenses ─────────────────────── */}
      <H2 id="s2">Income &amp; Expenses</H2>
      <P>
        The second section on the Inputs page. Enter every recurring source of money (income)
        and every category of spending (expenses). All amounts are in <em>today's dollars</em> —
        the engine inflates them automatically. (Use the <strong>Today's $ / Nominal $</strong> toggle
        in the nav bar to switch how Results charts display those inflated values.)
      </P>

      <H3>Income Streams</H3>
      <P>
        Add one row per income source. Common types:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Social Security</strong> — enter your estimated benefit at your claiming age. Growth % = 0 (the model applies CPI adjustments internally).</li>
        <li><strong>Pension</strong> — enter the annual payout. Set growth to 0 if no COLA, or your pension's actual COLA rate.</li>
        <li><strong>Part-time work / wages</strong> — start at retirement age if you plan to work part-time; set Stop Age when you expect to fully stop.</li>
        <li><strong>Rental income</strong> — annual net rent; set growth to your expected rent inflation.</li>
        <li><strong>Annuity</strong> — annual annuity payment with its guaranteed growth rate.</li>
      </ul>
      <Tip>
        Not sure of your Social Security amount? Visit ssa.gov and use the "my Social Security"
        estimator. It shows projected benefits at age 62, 67, and 70.
      </Tip>

      <H3>Expenses</H3>
      <P>
        Add one row per spending category. Use broad buckets — precision matters less than coverage.
        Common categories: housing, food, transportation, healthcare, travel, entertainment.
        Each expense inflates at the rate you specify (leave blank to use the plan's global inflation rate).
      </P>
      <P>
        <strong>Example:</strong> "Travel" from age 62 to 75, $15,000/yr, 3% inflation.
        After age 75, drop a new "Travel" row at $5,000/yr to reflect reduced activity.
      </P>
      <Tip>
        Many financial planners use a "smile" spending pattern: higher spending in early retirement
        (travel, activities), a plateau in the middle years, and a modest uptick late in life for
        healthcare. You can model this by setting different amounts across age windows.
      </Tip>

      {/* ── Section 3: Portfolio ─────────────────────────────── */}
      <H2 id="s3">Portfolio</H2>
      <P>
        The third section on the Inputs page. Enter your current balances, expected growth rates,
        and ongoing contributions. This section has three parts.
      </P>

      <H3>Expected Growth Rates</H3>
      <P>
        These four rates drive every dollar of growth in the projection. Reasonable defaults
        for a balanced portfolio are 6–7% for accounts and 3% for inflation.
      </P>
      <FieldTable rows={[
        ['Taxable', 'Annual growth rate for your brokerage (non-retirement) accounts.', '6.5%'],
        ['Pre-tax', 'Growth rate for Traditional 401(k) and IRA accounts.', '6.5%'],
        ['Roth', 'Growth rate for Roth IRA and Roth 401(k) accounts.', '6.5%'],
        ['Inflation', 'How fast prices rise each year. The 50-year US average is ~3%.', '3.0%'],
      ]} />

      <H3>Current Balances</H3>
      <P>
        Enter the current balance in each of the three account buckets the engine tracks. If you
        have a spouse, each person has their own set of buckets.
      </P>
      <FieldTable rows={[
        ['Taxable', 'Brokerage / investment accounts not in a retirement wrapper. Gains are taxed at favorable long-term capital gains rates.', '$200,000'],
        ['Pre-tax', 'Traditional 401(k), 403(b), or Traditional IRA. Contributions were tax-deductible; every withdrawal counts as ordinary income.', '$800,000'],
        ['Roth', 'Roth IRA or Roth 401(k). Funded with after-tax dollars; qualified withdrawals are completely tax-free.', '$150,000'],
      ]} />
      <P>
        Why the split matters: the engine chooses which bucket to draw from each year to minimize
        your lifetime tax bill. The more balanced your three buckets are, the more tax-planning
        flexibility you have.
      </P>
      <Tip>
        Include all accounts across all institutions in each bucket. If you have multiple 401(k)s
        and IRAs, add them together and enter the total.
      </Tip>

      <H3>Contributions (pre-retirement)</H3>
      <FieldTable rows={[
        ['Annual contribution', 'How much you save per year across all accounts until retirement.', '$25,000'],
        ['Contribution growth', 'How fast your annual saving amount grows each year (e.g., salary increases).', '2%'],
        ['Contribution mix', 'What fraction goes into each bucket. Must add to 100%. Matches your actual payroll elections.', '0% Taxable / 80% Pre-tax / 20% Roth'],
      ]} />

      {/* ── Section 4: Goals & Build Plan ───────────────────── */}
      <H2 id="s4">Goals &amp; Build Plan</H2>
      <P>
        The fourth section on the Inputs page. Pick what you want the optimizer to solve for,
        then click <strong>Build Plan →</strong>. The optimizer runs for a few seconds, finds
        the best withdrawal and Roth conversion schedule for your goal, and takes you to the
        Dashboard.
      </P>

      <H3>What outcome do you want to optimize for?</H3>
      <FieldTable rows={[
        ['Max End Balance', 'Finds the plan that leaves the largest portfolio at your Plan-To Age. Good for legacy or maximum safety margin.', '—'],
        ['Max Sustainable Spending', 'Finds the highest annual spending your plan can sustain without depleting. Good for understanding your upper bound.', '—'],
        ['Earliest Retirement Age', 'Solves for the soonest you can retire while the plan remains fully funded. Good for FIRE planning.', '—'],
      ]} />
      <Tip>
        You can re-run the optimizer at any time from the Dashboard by changing the goal and
        clicking Re-optimize.
      </Tip>

      <H3>After you build the plan</H3>
      <P>
        The Dashboard lets you fine-tune two additional choices without re-running from scratch:
      </P>
      <P>
        <strong>Withdrawal Strategy</strong> — which account to draw from first in retirement.
        Choose a preset chip:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Taxable First</strong> — spend brokerage accounts first, letting tax-advantaged accounts keep compounding.</li>
        <li><strong>Roth First</strong> — spend Roth first, reducing future Required Minimum Distributions (RMDs).</li>
        <li><strong>Traditional First</strong> — spend pre-tax first, also reducing RMDs but increasing current ordinary income and taxes.</li>
        <li><strong>Proportional</strong> — draw from all three buckets in proportion to their balances each year.</li>
        <li><strong>Bracket Fill</strong> — withdraws from each bucket to keep your taxable income just below a chosen bracket ceiling. Usually the most tax-efficient approach long-term.</li>
      </ul>
      <P>
        <strong>Roth Conversion Mode (⚙ Customize button)</strong> — optionally converts money
        from your pre-tax 401(k)/IRA to Roth each year before retirement ends. You pay the tax
        now at known rates to avoid higher taxes forced by Required Minimum Distributions later.
      </P>
      <FieldTable rows={[
        ['No Conversions', 'Leave pre-tax money where it is. RMDs starting at age 73 may push you into higher brackets.', '—'],
        ['Fixed Amount', 'Convert a fixed dollar amount each year within an age window you define.', '$30,000/yr, ages 60–70'],
        ['Bracket Fill', 'Convert enough each year to fill up to a chosen tax bracket ceiling.', 'Top of 22% bracket'],
        ['Manual Schedule', 'Enter a custom conversion amount for each specific age.', '$50k at 62, $40k at 63…'],
      ]} />
      <P>
        See the Tax Planning page to verify whether conversions are saving money lifetime. The
        "Cumulative Tax" chart shows the lifetime tax delta.
      </P>

      {/* ── Section 5: Dashboard ─────────────────────────────── */}
      <H2 id="s5">Reading the Dashboard</H2>
      <P>
        After clicking Build Plan, the Dashboard is your first results view. It has four parts:
        a Plan Summary banner, a Roth Conversion Benefit strip, a Strategy section, and charts.
      </P>

      <H3>Plan Summary banner</H3>
      <P>
        A dark banner at the top of the Dashboard shows eight headline numbers for your plan.
        The most important ones:
      </P>
      <FieldTable rows={[
        ['End Balance', 'Portfolio balance at your Plan-To Age. Green = fully funded. Yellow = runs out before that age.', '$820K'],
        ['Years Funded', 'How many of your planned retirement years the portfolio covers, out of the total. E.g. 30/30 is fully funded.', '28/30'],
        ['Initial WR', 'Year-1 withdrawal ÷ portfolio at retirement. The widely-cited safe rate is ~4%. Above 5% is a flag.', '3.8%'],
        ['Lifetime SS', 'Total Social Security income you will receive over the plan.', '$640K'],
        ['All-in Tax', 'Total of federal + state + Medicare (IRMAA) taxes paid over the plan. This is your lifetime tax burden.', '$310K'],
        ['Lifetime IRMAA', 'Total Medicare premium surcharges from income above the threshold. Roth conversions can reduce this.', '$24K'],
        ['Lifetime RMDs', 'Total Required Minimum Distributions — forced pre-tax withdrawals starting at age 73. Roth conversions before then reduce this number.', '$190K'],
        ['Roth Converted', 'Total amount voluntarily moved from pre-tax to Roth over the plan.', '$280K'],
      ]} />

      <H3>Roth Conversion Benefit strip</H3>
      <P>
        Below the banner, a green strip shows how much the active Roth conversion strategy
        improves four outcomes compared to doing no conversions at all: end balance, lifetime
        tax, lifetime RMDs, and Roth legacy. If no conversions are active, the strip prompts
        you to try Bracket Fill.
      </P>

      <H3>Withdrawal Strategy &amp; What-If Bar</H3>
      <P>
        Below the conversion strip, the Strategy chooser lets you switch withdrawal ordering
        presets and open the Roth Conversion Mode sheet — both update the projection immediately
        without re-running the full optimizer. The <strong>What-If Bar</strong> below it has
        sliders that temporarily override retirement age, portfolio return, inflation, and
        spending — useful for stress-testing without changing your saved plan.
      </P>
      <Tip>
        Use the What-If Bar to test "what if I retire 2 years later?" or "what if returns drop
        to 4%?" The Plan Summary banner updates immediately. Click "Save as scenario" to pin
        a comparison row below the sliders.
      </Tip>

      <H3>Dashboard charts</H3>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.9, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Portfolio Trajectory</strong> — stacked area showing Taxable, Pre-tax, and Roth balances over time. Vertical dashed lines mark Retirement, Social Security start, and RMD start.</li>
        <li><strong>Bucket Composition (%)</strong> — 100%-stacked view of how the mix of accounts shifts over time. Watch the Roth band grow if conversions are working.</li>
        <li><strong>Income Sources Over Time</strong> — stacked area showing where spending money comes from each year: withdrawals, RMDs, Social Security, and other income.</li>
      </ul>

      {/* ── Section 6: Projections ───────────────────────────── */}
      <H2 id="s6">Projections Page</H2>
      <P>
        The Projections page is your full year-by-year spreadsheet. Every row is one calendar year;
        columns cover income, withdrawals, taxes, and portfolio balances. The What-If Bar appears
        here too — use it to stress-test the projection without touching your saved inputs.
      </P>

      <H3>Annual Cash Flows chart</H3>
      <P>
        Income bars rise above the zero line. Spending and tax bars hang below it. When the
        income stack is taller than the spending+tax stack, you have a surplus that year (savings
        growing). When it is shorter, you are drawing down savings — this is normal and expected
        in retirement.
      </P>
      <P>
        The navy line on the right axis tracks total portfolio value over time. If it trends to
        zero before your Plan-To Age, the plan is underfunded.
      </P>

      <H3>Year-by-Year table — columns to watch</H3>
      <FieldTable rows={[
        ['Net Spending', 'What you actually get to spend after taxes. This is the "real" number to compare against your lifestyle cost.', '$85,000'],
        ['End Total Balance', 'Running portfolio total at year end. Does it hit zero prematurely? Does it grow unrealistically?', '$950,000'],
        ['Roth Conversions', 'Amount voluntarily moved from pre-tax to Roth this year. The Tax Planning page shows whether this is worth it.', '$40,000'],
        ['Effective Rate', 'Federal tax as a % of income. Watch for spikes — they usually signal RMD-forced income in mid-70s.', '14%'],
      ]} />
      <Tip>
        Click "Download CSV" to export all data to Excel. This is useful for sharing with a
        financial advisor or doing your own what-if analysis in a spreadsheet.
      </Tip>

      {/* ── Section 7: Tax Planning ──────────────────────────── */}
      <H2 id="s7">Tax Planning Page</H2>
      <P>
        Taxes are one of the largest expenses in retirement — and one of the few you can actively
        influence. This page shows how much you pay, where surcharges kick in, and whether your
        Roth conversion strategy is paying off.
      </P>

      <H3>Federal &amp; State tabs</H3>
      <P>
        Bars show tax dollars paid each year. The line shows effective rate (tax as a % of income).
        A slowly rising effective rate is healthy — it means income is growing but you are staying
        in a reasonable bracket. A sudden spike usually means RMDs forced income into a higher
        bracket in your mid-70s.
      </P>

      <H3>IRMAA tab — Medicare surcharges</H3>
      <P>
        Medicare Part B and Part D premiums jump significantly if your income (MAGI) crosses
        certain thresholds. Crucially, the surcharge applies <em>two years later</em> based on
        your income <em>today</em>. The chart plots your projected MAGI with dashed lines at
        each tier ceiling.
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Tier 1</strong> (2025): $212,000 for married filing jointly — crossing this adds ~$594/yr to Part B premiums per person.</li>
        <li><strong>Tier 2–4</strong>: Progressively higher premiums. Tier 4 adds over $5,000/yr per person.</li>
      </ul>
      <Tip>
        If Roth conversions would push your MAGI above a tier threshold, the surcharge two years
        later may outweigh the tax savings of the conversion. The optimizer accounts for this
        automatically in "Bracket Fill" conversion mode.
      </Tip>

      <H3>Roth Conversion Impact charts</H3>
      <P>
        Two comparison charts at the bottom of the page are the clearest way to evaluate whether
        converting is worth it:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Cumulative Tax</strong>: Two running totals of lifetime federal tax paid — "With Conversions" vs "No Conversions." If the "With Conversions" line is lower at the right edge, converting saved you money overall (you paid less tax despite paying earlier).</li>
        <li><strong>Portfolio Balance</strong>: Two lines showing ending portfolio value over time. If "With Conversions" is higher, the tax paid up front resulted in greater after-tax wealth because of Roth's tax-free compounding.</li>
      </ul>

      {/* ── Section 8: Monte Carlo ───────────────────────────── */}
      <H2 id="s8">Monte Carlo Simulation</H2>
      <P>
        The Projections page answers "what happens under my assumed 7% return?" Monte Carlo
        asks a harder question: <em>how often does my plan succeed across hundreds of realistic
        market histories?</em>
      </P>
      <P>
        The engine runs 500+ simulated futures by stitching together random sequences of real
        historical market returns (1928 to present). Some sequences include crashes; some are
        boom periods. Every simulation plays out your full spending plan and checks whether the
        portfolio survives.
      </P>

      <H3>Two ways to run the simulation</H3>
      <P>
        There are two buttons in the top-right of the page:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.9, paddingLeft: 20, margin: '0 0 12px' }}>
        <li>
          <strong>▶ Run Simulation</strong> — runs Monte Carlo against your current saved plan
          using the settings in the Simulation Inputs panel (return model, equity allocation,
          number of trials). Takes 1–2 seconds. Use this first to get a baseline success rate,
          and again any time you change simulation settings.
        </li>
        <li>
          <strong>Optimize for Robustness</strong> — runs a deeper optimizer pass that re-tests
          your withdrawal strategy across 15 different historical return sequences, then re-runs
          the simulation with the best strategy it found. Takes 60–90 seconds. Use this when
          your baseline success rate is acceptable but you want to squeeze out extra resilience
          against bad-luck market sequences — especially sequence-of-returns risk in early retirement.
        </li>
      </ul>
      <Tip>
        Run the standard simulation first to understand your baseline. Only use Optimize for
        Robustness once you have a plan you broadly like — it is a fine-tuning step, not a
        substitute for fixing a structurally underfunded plan.
      </Tip>

      <H3>Robustness optimization — preview and apply</H3>
      <P>
        When Optimize for Robustness finishes, the result is shown in <em>preview mode</em> —
        it does not automatically change your saved plan. You will see a gold badge ("Robustness
        strategy found — preview only") and the fan chart updates to reflect the optimized strategy.
        You have two choices:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.9, paddingLeft: 20, margin: '0 0 12px' }}>
        <li>
          <strong>Apply to Plan</strong> — permanently saves the new withdrawal and conversion
          strategy to your plan. All other pages (Dashboard, Projections, Tax Planning) will
          update to reflect it. This is the same as if you had configured that strategy manually
          on the Dashboard and re-optimized.
        </li>
        <li>
          <strong>Discard</strong> — throws away the robustness strategy and reverts the chart
          to your original saved plan. Your saved plan is unchanged.
        </li>
      </ul>
      <P>
        The robustness optimizer typically finds a strategy that scores slightly lower on the
        deterministic projection (Projections page) but meaningfully higher on Monte Carlo
        success rate — because it is optimizing for the worst historical sequences, not the
        average one. That trade-off is usually worth it.
      </P>

      <H3>Simulation settings</H3>
      <FieldTable rows={[
        ['Return Model', 'Historical bootstrap stitches together real multi-year market blocks (1928–present), preserving mean-reversion and sequence risk. Parametric normal samples independently from a bell curve — tends to be more pessimistic and misses clustering of bad years.', 'Historical (recommended)'],
        ['Equity Allocation %', 'The stock/bond split used inside each simulated year. Should match your actual portfolio allocation. Higher equity = more upside variance and more sequence-of-returns risk.', '60%'],
        ['Number of Trials', 'How many simulated futures to run. 500 is fast and accurate enough for planning; 1,000–2,000 gives smoother percentile bands at the cost of longer run time.', '500'],
      ]} />

      <H3>Probability of Success — what it means</H3>
      <FieldTable rows={[
        ['95%+', 'Robust. The plan survives almost every historical market scenario. Strong safety margin.', ''],
        ['90–95%', 'Healthy. A small number of worst-case sequences cause depletion. This is a common target.', ''],
        ['75–90%', 'Watch. Meaningful number of scenarios fail. Consider reducing spending or retiring slightly later.', ''],
        ['50–75%', 'Strained. Significant depletion risk. Plan needs material changes.', ''],
        ['Below 50%', 'At Risk. More than half of simulated futures run out of money. Major changes required.', ''],
      ]} />

      <H3>Fan Chart</H3>
      <P>
        The shaded bands show the spread of portfolio outcomes across all simulations:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Middle band (p25–p75)</strong>: The "middle half" of outcomes — 50% of simulations land in this range.</li>
        <li><strong>Outer bands (p10–p25 and p75–p90)</strong>: More extreme outcomes, good and bad.</li>
        <li><strong>Solid navy line</strong>: The median — the midpoint outcome. Half of simulations end above this, half below.</li>
        <li><strong>Red ribbon at the bottom</strong>: Shows what fraction of simulations have already run out of money by each age. If this ribbon appears before age 80, the plan is fragile to early-retirement bad luck.</li>
      </ul>

      <H3>Key metrics to read</H3>
      <FieldTable rows={[
        ['Median Final Portfolio', 'The middle-of-the-road outcome. Half of simulations end better than this number.', '$620K'],
        ['10th Percentile', 'A "bad luck" scenario — only 10% of simulations ended worse. If this is still positive, the plan has real resilience.', '$85K'],
        ['90th Percentile', 'A "good luck" scenario — only 10% of simulations ended better.', '$1.8M'],
      ]} />

      <H3>Historical Stress Scenarios</H3>
      <P>
        The table lists named historical crises (1929 crash, 1970s stagflation, dot-com bust,
        2008 financial crisis, etc.) applied directly to your plan's timeline. Click any row to
        overlay that scenario's portfolio trajectory on the fan chart as a dashed line. Click
        "Details" to see the year-by-year returns and your balance during that period.
      </P>
      <P>
        If your plan survives the Great Depression or 1970s stagflation, it has exceptional
        resilience. A plan that fails only in the most extreme historical scenarios is well
        designed; one that fails in moderate scenarios needs structural changes.
      </P>

      <H3>What to do with the results</H3>
      <P>
        If your probability of success is below 90%, go to the Dashboard or Projections page
        and use the What-If Bar sliders to identify the highest-leverage levers. Generally:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 24px' }}>
        <li><strong>Retiring 2–3 years later</strong> typically has the largest single impact — more contributions, fewer withdrawal years, higher Social Security.</li>
        <li><strong>Reducing spending by 10%</strong> often moves the needle more than changing asset allocation.</li>
        <li><strong>Adjusting return assumptions</strong> shows how sensitive the plan is to market uncertainty. If a 1% drop in returns causes failure, the plan is fragile; build in more buffer.</li>
        <li><strong>Roth conversions</strong> don't dramatically change success probability (they shift tax timing, not total assets), but they can improve the 10th percentile outcome by reducing tax drag in bad markets.</li>
        <li><strong>Try Optimize for Robustness</strong> — if you are at 85–92% and want to push higher without changing your fundamental retirement date or spending, this often finds a withdrawal sequencing that squeezes out a few more percentage points of success rate.</li>
      </ul>
    </div>
  );
}
