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

// All FieldTable row strings use double quotes so apostrophes inside them never break parsing.
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
        Retirement Optimizer shows you, year by year, whether your money will last. You tell it
        about your life — your age, what you earn, what you spend, what you have saved — and it
        runs the numbers forward to your Plan-To Age. The goal is not a perfect forecast; it is
        a clear picture of where you stand and what levers matter most.
      </P>
      <P>
        A good retirement plan does not need exact numbers. Being within 10–15% of reality is
        plenty accurate for a 30-year forecast. Focus on getting the big things right: Social
        Security, major expenses, and your account balances.
      </P>

      <H3>How the app is laid out</H3>
      <P>
        The dark bar at the top is your main navigation. On the left, the <strong>Inputs</strong> tab
        takes you to the single scrollable form where you enter your information. After you build
        your plan, four results tabs appear to the right of a divider: <strong>Dashboard</strong>,{' '}
        <strong>Projections</strong>, <strong>Taxes &amp; Roth Conversions</strong>, and{' '}
        <strong>Monte Carlo</strong>. You can switch between all of them freely at any time.
      </P>
      <P>
        On the right side of that same bar are utility controls:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Today&apos;s $ / Nominal $</strong> — switches how every chart and balance is displayed. <em>Today&apos;s $</em> adjusts for inflation so you can compare future numbers to what money is worth right now. <em>Nominal $</em> shows the raw future amounts as they would appear on an account statement. You can toggle this at any time.</li>
        <li><strong>Reset</strong> — clears all your inputs and starts fresh. You will be asked to confirm before anything is erased.</li>
        <li><strong>Import</strong> — loads a plan you previously exported as a JSON file.</li>
        <li><strong>Export</strong> — saves your current plan as a JSON file you can back up, share, or reload later.</li>
        <li><strong>?</strong> — opens this guide.</li>
      </ul>

      <H3>Recommended order to fill things in</H3>
      <ol style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: 0 }}>
        <li><strong>Personal Details</strong> — your name, age, when you plan to retire, state of residence</li>
        <li><strong>Income &amp; Expenses</strong> — every source of income and every spending category</li>
        <li><strong>Portfolio</strong> — your current account balances, growth assumptions, and savings contributions</li>
        <li><strong>Goals</strong> — pick what you want the optimizer to solve for, then click <strong>Build Plan &rarr;</strong></li>
        <li><strong>Results</strong> — explore Dashboard, Projections, Tax Planning, and Monte Carlo</li>
      </ol>

      {/* ── Section 1: Personal Details ──────────────────────── */}
      <H2 id="s1">Personal Details</H2>
      <P>
        The first section of the Inputs page. These fields define the timeline for everything
        else — when you start withdrawing, when income sources kick in, and how long the plan runs.
      </P>

      <H3>Your profile</H3>
      <FieldTable rows={[
        ["Name", "A label used in charts and tables. Has no effect on any calculation.", '"Alex"'],
        ["Date of Birth", "Used to calculate your current age and all future milestone ages.", "1970-04-15"],
        ["Retirement Age", "The age you plan to stop working. Contributions stop here; withdrawals begin.", "62"],
        ["Plan-To Age", "How long you want your money to last. Pick an age you are comfortable planning through — 90 to 95 is a common conservative choice.", "92"],
        ["Passing Age", "Only relevant if you add a spouse or partner. Controls when survivor Social Security benefits transition.", "85"],
      ]} />
      <Tip>
        Click <strong>+ Add Spouse / Partner</strong> in the Personal Details header to include a
        second person. Each person can have a different retirement age — helpful if one of you plans
        to keep working for a few extra years.
      </Tip>

      <H3>State of Residence</H3>
      <P>
        Select the state where you will live in retirement. The app automatically applies that
        state&apos;s income tax rules to your withdrawals each year. If you are planning to move
        to a state with no income tax (like Florida or Texas), select that state now — it can
        meaningfully change the long-term picture.
      </P>

      <H3>ACA Healthcare (pre-Medicare years)</H3>
      <P>
        If you retire before age 65, you will need to buy health insurance on your own until
        Medicare kicks in. Turn on <strong>Model pre-Medicare costs</strong> to include this in
        your plan. The app will estimate your premium after any subsidies you qualify for, based
        on your projected income each year.
      </P>
      <FieldTable rows={[
        ["Annual Premium", "The full benchmark premium (called SLCSP) for your area, before any subsidies. Find this at healthcare.gov by entering your zip code and household size.", "$18,000/yr"],
        ["Household Size", "Number of people on your ACA plan. Larger households qualify for bigger subsidies.", "2"],
        ["No subsidy (COBRA)", "Check this if your income will be too high for subsidies, or if you will use COBRA. The full premium is counted as an expense.", "—"],
      ]} />

      {/* ── Section 2: Income & Expenses ─────────────────────── */}
      <H2 id="s2">Income &amp; Expenses</H2>
      <P>
        The second section of the Inputs page. Enter every source of money coming in (income)
        and every category of spending going out (expenses). All amounts are entered in{' '}
        <em>today&apos;s dollars</em> — the engine inflates them forward automatically using your
        inflation assumption.
      </P>

      <H3>Income Streams</H3>
      <P>
        Add one row per income source. Click <strong>+ Add Income</strong> to create a new row.
        Common types and how to enter them:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Social Security</strong> — enter your estimated annual benefit at the age you plan to claim it. Set growth to 0%; the model applies cost-of-living adjustments internally.</li>
        <li><strong>Pension</strong> — enter the annual payout. Set growth to 0% if it has no COLA, or to your pension&apos;s actual annual increase rate.</li>
        <li><strong>Part-time work</strong> — set the Start Age to your retirement age and a Stop Age for when you expect to fully stop working.</li>
        <li><strong>Rental income</strong> — enter annual net rent after expenses. Set growth to match your expected rent increases.</li>
        <li><strong>Annuity</strong> — enter the annual payout with its guaranteed growth rate.</li>
      </ul>
      <Tip>
        Not sure what your Social Security benefit will be? Visit ssa.gov and use the "my Social
        Security" portal — it shows your projected benefit at age 62, 67, and 70 based on your
        actual earnings history.
      </Tip>

      <H3>Expenses</H3>
      <P>
        Add one row per spending category. Click <strong>+ Add Expense</strong> to create a new
        row. Broad categories work well — the goal is coverage, not accounting precision. Common
        categories: housing, food, transportation, healthcare, travel, and entertainment.
      </P>
      <P>
        Each expense can have a start age, a stop age, and its own inflation rate. If you leave
        inflation blank, the plan&apos;s global rate is used. This lets you model things like a
        mortgage that ends at age 72, or travel spending that tapers off in your late 70s.
      </P>
      <P>
        <strong>Example:</strong> Create an "Active Travel" row from age 62 to 75 at $15,000/yr.
        Then add a second row "Occasional Travel" from 75 onward at $5,000/yr. The plan
        automatically steps down the expense at the right age.
      </P>
      <Tip>
        Many financial planners describe a spending "smile" in retirement: higher early on (travel,
        hobbies), a plateau through the middle years, and a late-life uptick for healthcare. You
        can model this by using multiple rows with different amounts and age ranges.
      </Tip>

      {/* ── Section 3: Portfolio ─────────────────────────────── */}
      <H2 id="s3">Portfolio</H2>
      <P>
        The third section of the Inputs page. Enter your account balances, how fast you expect
        them to grow, and how much you are still adding each year before you retire.
      </P>

      <H3>Expected Returns</H3>
      <P>
        These three numbers drive every dollar of growth in the projection. They apply to your
        entire planning horizon, so even small differences compound significantly over 30 years.
      </P>
      <FieldTable rows={[
        ["Taxable Return", "Annual growth rate for your brokerage (non-retirement) accounts.", "6.5%"],
        ["Pre-tax Return", "Growth rate for Traditional 401(k) and IRA accounts.", "6.5%"],
        ["Roth Return", "Growth rate for Roth IRA and Roth 401(k) accounts.", "6.5%"],
      ]} />

      <H3>Expected Inflation</H3>
      <FieldTable rows={[
        ["Annual Rate", "How fast prices rise each year. The long-run US average is around 3%.", "3.0%"],
      ]} />
      <Tip>
        A balanced portfolio of stocks and bonds has historically returned 6–7% before inflation.
        If you are conservative, use 5–6%. Do not enter inflation-adjusted returns here — the app
        handles the inflation math separately using the Inflation rate you enter.
      </Tip>

      <H3>Current Account Balances</H3>
      <P>
        Enter your total balance in each of three account types. If you have a spouse, each
        person gets their own set of balances.
      </P>
      <FieldTable rows={[
        ["Taxable", "Brokerage or investment accounts outside a retirement wrapper. Growth is taxed at long-term capital gains rates, which are lower than ordinary income rates.", "$200,000"],
        ["Pre-tax (Traditional)", "Traditional 401(k), 403(b), or IRA. You got a tax deduction when you contributed; every dollar you withdraw counts as ordinary income and is taxed at that point.", "$800,000"],
        ["Roth", "Roth IRA or Roth 401(k). Funded with after-tax dollars. Qualified withdrawals in retirement are completely tax-free.", "$150,000"],
      ]} />
      <P>
        Why the split matters: the app decides each year which account to draw from in order to
        minimize your lifetime taxes. The more money you have spread across all three types, the
        more flexibility the optimizer has to keep you in lower tax brackets.
      </P>
      <Tip>
        Add up all accounts of the same type across all institutions and enter the combined total.
        If you have a 401(k) at your current employer and a rollover IRA from a previous job, add
        them together and enter that sum under Pre-tax.
      </Tip>

      <H3>Annual Contributions (before retirement)</H3>
      <FieldTable rows={[
        ["Annual contribution", "How much you save in total across all accounts each year until retirement.", "$25,000"],
        ["Contribution growth", "How fast your savings rate increases each year — for example, if you expect raises.", "2%"],
        ["Contribution mix", "What fraction goes into each bucket type. The three percentages must add up to 100%. This should match your actual payroll elections.", "0% Taxable / 80% Pre-tax / 20% Roth"],
      ]} />

      {/* ── Section 4: Goals & Build Plan ───────────────────── */}
      <H2 id="s4">Goals &amp; Build Plan</H2>
      <P>
        The fourth section of the Inputs page. Pick what you want the optimizer to solve for —
        then click <strong>Build Plan &rarr;</strong>. The optimizer runs for a few seconds, finds
        the best withdrawal and Roth conversion schedule for your goal, and takes you to the
        Dashboard.
      </P>

      <H3>What would you like to optimize for?</H3>
      <FieldTable rows={[
        ["Max End Balance", "Finds the plan that leaves the largest portfolio at your Plan-To Age. Good if your priority is leaving a legacy, or if you want the maximum safety cushion.", "—"],
        ["Max Sustainable Spending", "Finds the highest annual spending level your plan can support without running dry. Good for understanding your upper spending limit.", "—"],
        ["Earliest Retirement Age", "Solves for the soonest you could retire while keeping the plan fully funded. Good for FIRE planning or exploring what is possible if you save more.", "—"],
      ]} />
      <P>
        Once you have built a plan, you can switch goals and click <strong>Re-optimize</strong>
        on the Dashboard at any time — you do not need to come back to this page.
      </P>
      <Tip>
        Start with <strong>Max End Balance</strong> to get a baseline, then switch to <strong>Max
        Sustainable Spending</strong> to see what your plan can actually support. The difference
        between the two often surprises people.
      </Tip>

      {/* ── Section 5: Dashboard ─────────────────────────────── */}
      <H2 id="s5">Reading the Dashboard</H2>
      <P>
        The Dashboard is your main results view. It shows the headline numbers for your plan,
        tools to adjust strategy, and four charts to visualize how your money flows over time.
      </P>

      <H3>Plan Summary banner</H3>
      <P>
        The dark banner at the top shows eight key numbers at a glance. Green values mean the
        plan is on track; yellow flags something worth addressing.
      </P>
      <FieldTable rows={[
        ["End Balance", "What your portfolio is worth at your Plan-To Age. Green means it is positive and the plan is fully funded; yellow means it ran out before that age.", "$820K"],
        ["Years Funded", "Out of your total planned retirement years, how many are fully covered. 30/30 means fully funded; 25/30 means the plan runs short 5 years before the end.", "28/30"],
        ["Initial WR", "Your first-year withdrawal divided by your portfolio at retirement. The widely-cited guideline is 4% or below. Above 5% is a flag worth examining.", "3.8%"],
        ["Lifetime SS", "The total Social Security income you will receive over your entire retirement.", "$640K"],
        ["All-in Tax", "Every dollar of federal tax, state tax, and Medicare surcharges (IRMAA) you will pay over the plan. This is your true lifetime tax burden.", "$310K"],
        ["Lifetime IRMAA", "Total Medicare premium surcharges triggered by income above certain thresholds. Roth conversions can reduce this significantly.", "$24K"],
        ["Lifetime RMDs", "Total Required Minimum Distributions — forced withdrawals from pre-tax accounts starting at age 73. Doing Roth conversions before then reduces this number.", "$190K"],
        ["Roth Converted", "The total amount voluntarily moved from pre-tax accounts to Roth over the plan lifetime.", "$280K"],
      ]} />
      <P>
        Below the numbers, a small link reads <strong>explain optimization rationale &rarr;</strong>{' '}
        (visible after the plan is built). Click it to see a plain-language summary of why the
        optimizer chose the withdrawal and conversion strategy it did.
      </P>

      <H3>Roth Conversion Benefit strip</H3>
      <P>
        Just below the Plan Summary banner, a strip shows what your active Roth conversion
        strategy is doing compared to doing no conversions at all. It shows the impact in four
        areas: <strong>End balance</strong>, <strong>Lifetime tax</strong>,{' '}
        <strong>Lifetime RMDs</strong>, and <strong>Roth legacy</strong>. Green numbers mean the
        conversion is helping; red means it is costing you on that dimension.
      </P>
      <P>
        If no conversions are active, the strip prompts you to try Bracket Fill — click{' '}
        <strong>&#9881; Roth Conversion Mode</strong> in the strategy panel below to configure it.
      </P>

      <H3>Adjust Withdrawal Strategies panel</H3>
      <P>
        This panel has two rows of controls that update the projection instantly without
        re-running the full optimizer.
      </P>
      <P>
        <strong>Row 1 — Optimize For:</strong> Three goal chips (Max End Balance, Max Spending,
        Earliest Retire) let you switch what you are optimizing for. Select one, then click{' '}
        <strong>Re-optimize</strong> to run the optimizer for that goal. A checkmark shows the
        goal the plan was last built for.
      </P>
      <P>
        <strong>Row 2 — Withdrawal:</strong> Five preset chips plus a Custom option control which
        accounts you draw from in retirement. Click any chip to switch immediately.
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Taxable First</strong> — spend from your brokerage accounts first, letting your tax-advantaged accounts keep compounding untouched.</li>
        <li><strong>Roth First</strong> — spend Roth money first, which shrinks future Required Minimum Distributions from your pre-tax accounts.</li>
        <li><strong>Traditional First</strong> — spend pre-tax accounts first, also reducing RMDs but increasing your taxable income now.</li>
        <li><strong>Proportional</strong> — draw from all three account types in proportion to their balances each year. Simple, but rarely the most tax-efficient.</li>
        <li><strong>Bracket Fill</strong> — withdraws from each bucket each year to keep your taxable income just below a chosen tax bracket ceiling. Usually the most tax-efficient approach over the long run.</li>
        <li><strong>Custom</strong> — opens an editor where you can define your own withdrawal blend by age window. For example: Taxable First from 62 to 70, then Bracket Fill from 70 onward. Click the Custom chip to open the editor.</li>
      </ul>
      <P>
        At the end of Row 2, the <strong>&#9881; Roth Conversion Mode</strong> button opens a
        sheet to configure whether and how the plan converts pre-tax money to Roth each year.
      </P>
      <FieldTable rows={[
        ["No Conversions", "Leave pre-tax money where it is. RMDs starting at age 73 may push you into higher brackets in later years.", "—"],
        ["Fixed Amount", "Convert a set dollar amount each year within an age window you define. Good if you have a specific amount in mind.", "$30,000/yr, ages 60–70"],
        ["Bracket Fill", "Convert enough each year to fill up to a chosen tax bracket ceiling. The optimizer finds the ceiling that helps most.", "Top of 22% bracket"],
        ["Manual Schedule", "Enter a custom conversion amount for each specific age. Maximum control for those with a detailed plan.", "$50k at 62, $40k at 63"],
      ]} />

      <H3>What-If Bar</H3>
      <P>
        Below the strategy panel, the What-If Bar has sliders that let you explore scenarios
        without changing your saved plan. Your actual inputs are untouched — the bar is a live
        overlay that the Plan Summary banner reflects in real time.
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Retire age slider(s)</strong> — shift your (or your spouse&apos;s) retirement age earlier or later.</li>
        <li><strong>Return rate</strong> — test how the plan holds up if portfolio growth is lower than expected.</li>
        <li><strong>Inflation</strong> — see what happens if prices rise faster than your base assumption.</li>
        <li><strong>Spending</strong> — scale all your expenses up or down by a percentage to find your spending floor or ceiling.</li>
      </ul>
      <P>
        When the bar is active, a warning color and "Active" label remind you that what you see
        is the overlay, not your saved plan. Click <strong>Reset</strong> in the What-If Bar to
        clear the overrides and return to your actual saved numbers.
      </P>
      <P>
        Click <strong>Save as scenario</strong> to pin the current what-if as a named comparison
        row in the Pinned Comparisons panel below the charts. You can save multiple scenarios
        and compare them side by side.
      </P>
      <Tip>
        Try "What if I retire 2 years later?" and "What if returns drop to 4%?" on the same plan.
        The Plan Summary banner updates instantly, making it easy to see which lever has the
        biggest impact.
      </Tip>

      <H3>Dashboard charts</H3>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.9, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Portfolio Trajectory</strong> — a stacked area showing your Taxable, Pre-tax, and Roth balances growing and shrinking over time. Vertical dashed lines mark your retirement date, Social Security start, and RMD start at age 73.</li>
        <li><strong>Bucket Composition (%)</strong> — shows how the mix of your three account types shifts over time as a percentage of your total portfolio. Watch the Roth band grow if conversions are working.</li>
        <li><strong>Income Sources Over Time</strong> — a stacked area showing where your spending money comes from each year: portfolio withdrawals, RMDs, Social Security, and other income streams.</li>
        <li><strong>Cash Flow at Age [X]</strong> — a Sankey flow diagram showing where money comes from and where it goes in a single year. Drag the age slider in the panel header to see any year in your plan.</li>
      </ul>

      <H3>Pinned Comparisons panel</H3>
      <P>
        At the bottom of the Dashboard, the Pinned Comparisons panel shows any scenarios you
        have saved from the What-If Bar side by side with your base plan. Key metrics — years
        funded, end balance, lifetime tax, and withdrawal rate — are shown for each.
      </P>
      <P>
        Click <strong>+ Add From Template</strong> to quickly add pre-built what-ifs such as
        "Retire 3 Years Earlier," "Retire 3 Years Later," "Lower Returns (4%)," or "Higher
        Inflation (4%)." These are a fast way to stress-test your plan without manually adjusting
        sliders.
      </P>

      {/* ── Section 6: Projections ───────────────────────────── */}
      <H2 id="s6">Projections Page</H2>
      <P>
        The Projections page is your complete year-by-year view of the plan. Every row is one
        calendar year; columns show income, withdrawals, taxes, and portfolio balances. The
        What-If Bar appears here too — use it to stress-test without touching your saved inputs.
      </P>

      <H3>Annual Cash Flows chart</H3>
      <P>
        Income bars rise above the center line. Spending and tax bars hang below it. In years
        where your income stack is taller than your spending and tax stack, you have a surplus
        and your portfolio is growing. When spending exceeds income, you are drawing down savings
        — this is completely normal once you have retired.
      </P>
      <P>
        The navy line on the right axis tracks your total portfolio value over time. If it trends
        toward zero before your Plan-To Age, the plan is underfunded and needs adjustments.
      </P>

      <H3>Column visibility and CSV export</H3>
      <P>
        The table shows a curated set of columns by default. The toolbar above the table tells
        you how many columns are visible and how many are available — click to toggle additional
        columns like RMDs, IRMAA, ACA premiums, and more.
      </P>
      <P>
        Click <strong>Download CSV</strong> to export the full projection to a spreadsheet. The
        export always includes every column, regardless of which are currently visible. The file
        name reflects whether you are in Today&apos;s $ or Nominal $ mode.
      </P>

      <H3>Key columns to watch</H3>
      <FieldTable rows={[
        ["Net Spending", "What you actually get to spend after taxes. Compare this to your lifestyle cost to sense-check whether the plan is realistic.", "$85,000"],
        ["End Total Balance", "Your combined portfolio value at the end of each year. Watch for it approaching zero prematurely.", "$950,000"],
        ["Roth Conversions", "Amount voluntarily moved from pre-tax to Roth this year. Head to Tax Planning to see whether the conversions are saving money overall.", "$40,000"],
        ["Effective Rate", "Federal tax as a percentage of income. A slowly rising rate is healthy. A sudden spike — usually in your mid-70s — signals RMDs forcing income into a higher bracket.", "14%"],
      ]} />

      {/* ── Section 7: Tax Planning ──────────────────────────── */}
      <H2 id="s7">Tax Planning Page</H2>
      <P>
        Taxes are one of the largest costs in retirement — and one of the very few you can
        actively control. This page shows your tax picture in detail and helps you evaluate
        whether your Roth conversion strategy is paying off.
      </P>
      <P>
        Three tabs at the top right switch the view: <strong>Federal</strong>,{' '}
        <strong>State</strong>, and <strong>IRMAA</strong>.
      </P>

      <H3>Federal tab — your projected tax trajectory</H3>
      <P>
        Bars show tax dollars paid each year. The line shows your effective rate (tax as a
        percentage of income). A slowly rising effective rate is healthy — it means income is
        growing while you stay in a manageable bracket. A sudden spike in your mid-70s usually
        means Required Minimum Distributions are pushing income into a higher bracket — a signal
        that Roth conversions before age 73 could help.
      </P>

      <H3>State tab</H3>
      <P>
        Shows your projected state income tax year by year. Different states have very different
        rules for retirement income — some fully exempt Social Security and pension income; others
        tax everything. If your state tab shows significant taxes, it may be worth modeling a
        move to a lower-tax state using the State of Residence field on the Inputs page.
      </P>

      <H3>IRMAA tab — Medicare premium surcharges</H3>
      <P>
        If your income (specifically your MAGI — Modified Adjusted Gross Income) exceeds certain
        thresholds, Medicare charges extra for Part B and Part D coverage. These surcharges can
        add hundreds to thousands of dollars per person per year. The IRMAA chart plots your
        projected income against the tier thresholds with dashed lines so you can see when and
        by how much you cross them.
      </P>
      <P>
        One important detail: the surcharge in a given year is based on your income from{' '}
        <em>two years earlier</em>. So income at age 71 determines your Medicare costs at age 73.
        The optimizer accounts for this when sizing Roth conversions in Bracket Fill mode.
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Tier 1</strong> (2025): income above $212,000 for married filing jointly adds roughly $594/year per person to Part B alone.</li>
        <li><strong>Tier 2–4</strong>: progressively higher surcharges. The top tier adds over $5,000/year per person.</li>
      </ul>
      <Tip>
        If a Roth conversion would push your income just over an IRMAA tier, the two-year-later
        surcharge may wipe out the tax savings. The Bracket Fill conversion mode takes the IRMAA
        thresholds into account automatically when it sizes conversions.
      </Tip>

      <H3>Roth Conversion comparison charts</H3>
      <P>
        Below the Federal tab view, two charts show whether your current conversion strategy is
        actually worth it:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Cumulative Tax — With vs. Without Conversions:</strong> Two running totals of lifetime federal tax paid. If the "With Conversions" line ends lower, you paid less tax overall despite paying some of it earlier. That is the goal of converting.</li>
        <li><strong>Portfolio Balance — With vs. Without Conversions:</strong> Two lines showing ending portfolio value over time. If "With Conversions" is higher at your Plan-To Age, the upfront tax paid resulted in greater after-tax wealth because of Roth&apos;s tax-free compounding.</li>
      </ul>

      {/* ── Section 8: Monte Carlo ───────────────────────────── */}
      <H2 id="s8">Monte Carlo Simulation</H2>
      <P>
        The Projections page answers "what happens if my return assumption is exactly right?"
        Monte Carlo asks a harder question: <em>how often does my plan survive across hundreds
        of different market histories?</em> Some of those histories include crashes at exactly
        the wrong moment. Some are boom periods. The simulation tests your plan against all of them.
      </P>
      <P>
        The engine runs 500 or more simulated futures by stitching together sequences of real
        historical market returns going back to 1928. Every simulation plays out your full spending
        plan and checks whether the portfolio makes it to your Plan-To Age.
      </P>

      <H3>Two ways to run the simulation</H3>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.9, paddingLeft: 20, margin: '0 0 12px' }}>
        <li>
          <strong>Run Simulation</strong> — runs Monte Carlo against your current saved plan
          using the settings in the Simulation Inputs panel. Takes 1–2 seconds. Run this first
          to understand your baseline success rate, and again any time you change the simulation
          settings.
        </li>
        <li>
          <strong>Optimize for Robustness</strong> — a deeper pass that tests your withdrawal
          strategy across 15 different historical return sequences, then picks the strategy that
          holds up best across all of them before running the full simulation. Takes 60–90
          seconds. Use this when you like your plan overall but want to squeeze out extra
          resilience against bad-luck sequences early in retirement.
        </li>
      </ul>
      <Tip>
        Run the standard simulation first to establish your baseline. Use Optimize for Robustness
        only once you have a plan you broadly feel good about — it is a fine-tuning step, not a
        fix for a plan that is fundamentally underfunded.
      </Tip>

      <H3>Robustness optimization — preview and apply</H3>
      <P>
        When Optimize for Robustness finishes, the result appears in <em>preview mode</em> — it
        does not automatically change your saved plan. A gold badge lets you know, and the fan
        chart updates to reflect the optimized strategy. You then have two choices:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.9, paddingLeft: 20, margin: '0 0 12px' }}>
        <li>
          <strong>Apply to Plan</strong> — permanently saves the new strategy to your plan. All
          other pages (Dashboard, Projections, Tax Planning) update to reflect it, exactly as if
          you had configured that strategy manually on the Dashboard.
        </li>
        <li>
          <strong>Discard</strong> — throws away the robustness result and reverts the chart to
          your original saved plan. Nothing in your plan is changed.
        </li>
      </ul>
      <P>
        The robustness optimizer typically produces a strategy that scores slightly lower on the
        deterministic Projections page (average-case scenario) but meaningfully higher on Monte
        Carlo success rate — because it optimizes for the worst historical sequences, not just
        the average one. For most people, that trade-off is worth taking.
      </P>

      <H3>Simulation settings</H3>
      <FieldTable rows={[
        ["Equity Allocation %", "The stock/bond split applied inside each simulated year. Match this to your actual portfolio allocation. More stocks means more upside potential and more risk in bad years.", "60%"],
        ["Number of Trials", "How many simulated futures to run. 500 is fast and accurate enough for planning decisions. 1,000–2,000 gives smoother percentile bands at the cost of a longer wait.", "500"],
      ]} />

      <H3>How to read the success rate</H3>
      <FieldTable rows={[
        ["95%+", "Very strong. Your plan survives almost every realistic market history. You have a meaningful safety margin.", ""],
        ["90–95%", "Healthy. Only the worst handful of historical sequences cause problems. This is a common planning target.", ""],
        ["75–90%", "Worth watching. A meaningful number of scenarios end in shortfall. Consider retiring slightly later or trimming spending.", ""],
        ["50–75%", "Under pressure. More than a quarter of simulations run out of money. The plan needs meaningful changes.", ""],
        ["Below 50%", "At risk. More than half of simulated futures deplete the portfolio. Major structural changes required.", ""],
      ]} />

      <H3>Fan Chart — reading the bands</H3>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Middle band (p25–p75)</strong> — the middle half of all outcomes. Half of all simulations land somewhere in this range.</li>
        <li><strong>Outer bands (p10–p25 and p75–p90)</strong> — more extreme outcomes in both directions.</li>
        <li><strong>Solid navy line</strong> — the median outcome. Half of simulations end above this, half below.</li>
        <li><strong>Red ribbon at the bottom</strong> — the fraction of simulations that have already run out of money by each age. If the ribbon appears before age 80, the plan is fragile to early-retirement bad luck — the most damaging kind.</li>
      </ul>

      <H3>Key metrics</H3>
      <FieldTable rows={[
        ["Median Final Portfolio", "The middle-of-the-road outcome. Half of simulations ended better than this number, half worse.", "$620K"],
        ["10th Percentile", "A bad-luck scenario — only 10% of simulations ended worse than this. If this is still positive, the plan has real resilience even in difficult markets.", "$85K"],
        ["90th Percentile", "A good-luck scenario — only 10% of simulations ended better.", "$1.8M"],
      ]} />

      <H3>Historical Stress Scenarios</H3>
      <P>
        The table below the fan chart lists named historical crises — the 1929 crash, 1970s
        stagflation, the dot-com bust, the 2008 financial crisis, and others — applied directly
        to your plan&apos;s timeline starting at your retirement date. Click any row to overlay
        that scenario&apos;s portfolio path on the fan chart as a dashed line.
      </P>
      <P>
        If your plan survives the Great Depression or 1970s stagflation, it is genuinely
        resilient. A plan that only fails in the most extreme historical scenarios is well-designed;
        one that fails in moderate scenarios needs structural changes.
      </P>

      <H3>What to do if your success rate is below 90%</H3>
      <P>
        Head to the Dashboard and use the What-If Bar to find your highest-leverage options.
        In rough order of impact:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 24px' }}>
        <li><strong>Retiring 2–3 years later</strong> typically has the largest single impact — more contributions, fewer withdrawal years, and a higher Social Security benefit all compound together.</li>
        <li><strong>Reducing spending by 10%</strong> often moves the needle more than changing your asset allocation or return assumptions.</li>
        <li><strong>Testing lower return assumptions</strong> shows how sensitive your plan is to market outcomes. If a 1% drop in returns causes the plan to fail, build in more buffer before you retire.</li>
        <li><strong>Roth conversions</strong> will not dramatically shift your success probability (they move tax timing, not total assets), but they can improve outcomes in the 10th-percentile bad-luck scenarios by reducing tax drag when markets are already down.</li>
        <li><strong>Optimize for Robustness</strong> — if you are at 85–92% and want to push higher without changing your retirement date or spending, this often finds a withdrawal sequencing that gains a few more percentage points of resilience.</li>
      </ul>
    </div>
  );
}
