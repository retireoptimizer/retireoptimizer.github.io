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
  { id: 's9', label: 'Historical Sequences' },
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

      {/* Legal disclaimer */}
      <div style={{
        background: 'rgba(13,27,46,0.04)',
        border: '1px solid var(--border-light)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 11,
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        marginBottom: 28,
      }}>
        <strong>Not financial advice.</strong>{' '}
        Retirement Optimizer is an educational planning tool for illustrative and informational purposes only.
        It does not constitute professional financial, tax, investment, or legal advice.
        Results are projections based on the assumptions you enter and are not guarantees of future performance.
        Consult a qualified financial advisor before making retirement planning decisions.
      </div>

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

      <H3>State Taxable %</H3>
      <P>
        Each income stream has a <strong>State taxable %</strong> column (default 100%). It
        controls what fraction of that stream counts toward your state income tax base. Use it
        when your state exempts certain income types or only taxes a portion of them — for
        example, a state that does not tax military pensions, or one that exempts annuity income.
      </P>
      <FieldTable rows={[
        ["100%", "The full taxable amount of the stream is subject to state tax. Default for most income.", "Wages, rental income"],
        ["0%", "The stream is completely excluded from state tax — as if it does not exist for state purposes.", "SS in a state that fully exempts SS income"],
        ["50%", "Only half the stream counts toward state tax. Useful for states that partially exempt certain income.", "Military pension with 50% state exemption"],
      ]} />

      <H3>How it interacts with the State of Residence dropdown</H3>
      <P>
        The behavior of this field depends entirely on which state you have selected:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li>
          <strong>Named states (IL, CA, NY, etc.)</strong> — these have built-in exemption rules
          that the engine applies automatically. Illinois, for example, fully exempts all pension
          and annuity distributions regardless of the State taxable % you enter. For these states,
          the field has no effect on pension or annuity streams — the built-in profile takes
          precedence. It does still apply to "Other" income types (wages, rental) in all named
          states.
        </li>
        <li>
          <strong>No state tax (TX, FL, WA, etc.)</strong> — the effective rate is 0%, so the
          field has no effect regardless of what you enter.
        </li>
        <li>
          <strong>Custom (flat rate)</strong> — the field is fully active. The flat rate is applied
          to the portion of each stream you designate as state-taxable. This is the primary use
          case for the field, since a custom flat rate has no built-in knowledge of what your
          state exempts.
        </li>
      </ul>
      <Tip>
        <strong>Modeling a flat dollar exemption</strong> — some states exempt a fixed dollar
        amount rather than a percentage (e.g., "first $20,000 of pension income is exempt").
        The app does not have a dedicated dollar-exemption field, but you can achieve the same
        result by splitting the stream into two rows: one row for the exempt portion at 0% State
        taxable, and one for the remainder at 100%. For example, a $60,000 pension with a $20,000
        state exemption becomes a $20,000 row at 0% + a $40,000 row at 100%. Both rows should
        have the same growth rate, start age, and stop age.
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

      <H3>One-Time Lump Sum Events</H3>
      <P>
        Use this section to model a single cash injection into your portfolio at a specific age —
        for example, an inheritance, a business sale, a large bonus, or any other one-time windfall.
        Click <strong>+ Add One-Time Event</strong> in the Income &amp; Expenses section to create
        a row.
      </P>
      <FieldTable rows={[
        ["Description", "A label shown in tables. Has no effect on calculations.", '"Inheritance"'],
        ["Whose", 'For couples, which person&apos;s age the event is anchored to. "Household" uses Person A&apos;s age.', "Household"],
        ["Account", "Where the money lands — Taxable (brokerage), Pre-tax (Traditional), or Roth. Each type is treated differently.", "Taxable"],
        ["At Age", "The age at which the injection occurs. Based on Person A's age.", "65"],
        ["Amount", "The one-time amount in today's dollars.", "$200,000"],
      ]} />

      <H3>How the three account types are handled</H3>
      <P>
        The account you choose determines both the tax treatment and the downstream impact on your
        plan:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li>
          <strong>Taxable</strong> — deposited into your brokerage account at full cost basis (the
          full amount is treated as basis, so no embedded capital gain). The injection is counted as
          ordinary income in the year it arrives and is taxed accordingly. Use this for inheritances
          deposited to a brokerage, business-sale proceeds, or large bonuses.
        </li>
        <li>
          <strong>Pre-tax (Traditional)</strong> — added directly to your Traditional IRA or 401(k)
          balance. No tax is due at the time of injection, but every dollar will eventually be taxed
          as ordinary income when withdrawn — including as Required Minimum Distributions. Use this
          for spousal IRA rollovers or deferred-compensation payouts directed to a pre-tax account.
        </li>
        <li>
          <strong>Roth</strong> — added directly to your Roth balance. No tax at injection and no
          tax on future qualified withdrawals. Use this for a Roth IRA inherited from a spouse or an
          after-tax rollover into Roth.
        </li>
      </ul>
      <Tip>
        A <strong>taxable lump sum</strong> creates a spike in ordinary income in that year and can
        push you into a higher bracket. The optimizer accounts for this — it typically reduces Roth
        conversion amounts in the injection year to avoid bracket stacking. A{' '}
        <strong>pre-tax lump sum</strong> increases your traditional balance, which means larger RMDs
        starting at age 73; the optimizer may shift the conversion window to absorb some of that
        balance before 73 kicks in.
      </Tip>
      <Tip>
        Lump sum events change the optimal withdrawal and conversion strategy, so re-run the
        optimizer after adding or modifying any event. If you change a lump sum amount or account
        type and navigate away from Inputs, the nav bar will gate the output tabs and require you
        to re-optimize before viewing results.
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
        then click <strong>Build Plan &rarr;</strong>. The optimizer runs for a few seconds and
        produces a custom per-age withdrawal blend policy — for example, 60% taxable / 30%
        pre-tax / 10% Roth from age 62–70, then a different mix from 70 onward — along with a
        Roth conversion schedule. It then takes you to the Dashboard.
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

      <H3>Roth Conversion Benefit</H3>
      <P>
        Inside the Plan Summary banner, below the headline numbers, a separator row shows what
        your active Roth conversion strategy is doing compared to doing no conversions at all.
        Four delta values appear: <strong>End balance</strong>, <strong>Lifetime tax</strong>,{' '}
        <strong>Lifetime RMDs</strong>, and <strong>Roth legacy</strong>. Green numbers mean the
        conversion is helping on that dimension; red means it is costing you. Values near zero
        are shown in grey — the effect is negligible.
      </P>
      <P>
        If no conversions are active, the row prompts you to try Bracket-Fill. Configure
        conversions in the Strategy panel below using the <strong>Roth conversions</strong> pill row.
      </P>

      <H3>Strategy panel</H3>
      <P>
        Below the Plan Summary banner, the Strategy panel is the main control surface for how
        your money is managed in retirement. It has two modes, selected by vertical tabs on the
        left side of the panel.
      </P>
      <P>
        <strong>⚡ Optimize for me</strong> — the optimizer builds a custom per-age-window
        withdrawal blend and sizes Roth conversions for you. Two pill rows appear:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Goal</strong> — pick what to optimize for: Max End Balance, Max Spending, or Earliest Retire. A ✓ marks the goal the plan was last built for. Selecting a different goal highlights it but does not run the optimizer yet.</li>
        <li><strong>Roth conversions</strong> — five pills let you constrain how the optimizer handles conversions: <em>Optimizer decides</em> (the optimizer searches for the best amount), <em>None</em>, <em>Bracket-Fill</em>, <em>Fixed Amount</em>, or <em>Manual</em>. Picking any conversion pill turns it amber — a "pending" state. The charts do not change yet.</li>
      </ul>
      <P>
        The <strong>↗ Re-optimize</strong> button in the top-right of the panel applies your
        selections. When a pending conversion pill is waiting, the button shows a dot and reads
        "Re-optimize · Apply" — a reminder that the charts still reflect the previous run.
        Click it to run the optimizer with your new goal and conversion choice; the charts update
        only after it completes. A small hint "Takes effect when you re-optimize" appears below
        the conversion pills while a selection is pending.
      </P>
      <P>
        The <strong>📊 Conversions vs RMDs</strong> link opens a chart showing voluntary Roth
        conversions (above zero) versus forced RMDs (below zero) by age — useful for seeing when
        and by how much conversions move the needle.
      </P>
      <Tip>
        In <em>Optimize for me</em> mode, selecting a conversion pill does not immediately change
        the charts — that is intentional. The optimizer needs to run with the new constraint
        before the result is meaningful. Click Re-optimize to commit.
      </Tip>

      <P>
        <strong>✎ Set it myself</strong> — you pick the withdrawal strategy and conversion mode
        directly. Changes apply instantly without re-optimizing. Two pill rows appear:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Withdrawal order</strong> — five presets plus a Custom blend option control which accounts you draw from each year:
          <ul style={{ marginTop: 4, lineHeight: 1.9 }}>
            <li><strong>Taxable First</strong> — spend from your brokerage accounts first, letting tax-advantaged accounts compound untouched.</li>
            <li><strong>Roth First</strong> — spend Roth money first, shrinking future Required Minimum Distributions.</li>
            <li><strong>Traditional First</strong> — spend pre-tax accounts first, also reducing RMDs but increasing current taxable income.</li>
            <li><strong>Proportional</strong> — draw from all three account types in proportion to their balances. Simple but rarely the most tax-efficient.</li>
            <li><strong>Bracket-Fill</strong> — a dropdown that lets you pick a bracket ceiling. The engine pulls from traditional (pre-tax) accounts up to that ceiling each year, then covers remaining spending from Roth or taxable. Usually the most tax-efficient withdrawal approach over the long run.</li>
            <li><strong>✎ Custom blend</strong> — opens an editor to define your own per-age-window blend. When the optimizer builds your plan, this is automatically active and reflects the optimizer's output.</li>
          </ul>
        </li>
        <li><strong>Roth conversions · instant</strong> — four pills (None, Bracket-Fill, Fixed Amount, Manual) switch the active conversion mode immediately. Bracket-Fill and Fixed Amount show an "Edit details →" link to configure the window and amount; Manual opens a per-year schedule editor.</li>
      </ul>
      <Tip>
        <strong>Switching to any named preset replaces the optimizer&apos;s custom policy.</strong>{' '}
        The moment you click Taxable First, Proportional, Bracket-Fill, or any other named preset
        in the Set it myself tab, the optimizer output is erased. You will need to re-optimize to
        get it back. If you want to explore a preset without losing the optimized plan, note your
        key Dashboard numbers first.
      </Tip>

      <H3>How withdrawal ordering and conversion mode interact</H3>
      <P>
        These are two completely independent controls. Changing the conversion mode never affects
        withdrawal ordering, and changing the withdrawal preset never affects conversion settings.
        You can freely mix any combination — for example, the optimizer&apos;s custom withdrawal
        blend with Bracket-Fill conversions, or Proportional withdrawals with a Manual schedule.
      </P>
      <P>
        Within conversion mode, switching pills only changes which mode is active. Settings for
        every other mode — amounts, age windows, ceilings, manual schedule entries — are preserved
        but dormant. If you configure a Manual Schedule, switch to Bracket-Fill to compare, then
        switch back, your entries are still there.
      </P>

      <FieldTable rows={[
        ["None", "Leave pre-tax money where it is. RMDs starting at age 73 may push you into higher brackets in later years.", "—"],
        ["Fixed Amount", "Convert a set dollar amount each year within an age window you define.", "$30,000/yr, ages 60–70"],
        ["Bracket-Fill", "Convert enough each year to fill the chosen bracket. Ceiling is automatically capped at or below the withdrawal Bracket-Fill ceiling.", "Top of 12% bracket"],
        ["Manual", "Enter a custom conversion amount for each specific age. Maximum control.", "$50k at 62, $40k at 63"],
      ]} />

      <H3>How the two Bracket Fill controls interact</H3>
      <P>
        There are two independent Bracket Fill controls — one for <em>withdrawals</em> and one
        for <em>Roth conversions</em> — and they share the same bracket space each year.
        The engine always runs them in this order:
      </P>
      <ol style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Roth conversion runs first.</strong> The conversion fills ordinary income from its current level up to the conversion ceiling.</li>
        <li><strong>Withdrawal bracket fill runs second.</strong> It sees the conversion already sitting in income and fills any remaining room up to the withdrawal ceiling.</li>
      </ol>
      <P>
        This means the two ceilings act as a two-stage bracket strategy:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Conversion ceiling = Withdrawal ceiling</strong> — the conversion consumes all available bracket room; withdrawal bracket fill adds nothing extra from traditional. Use this when you want all pre-tax draws to be voluntary conversions (maximum Roth build-up).</li>
        <li><strong>Conversion ceiling &lt; Withdrawal ceiling</strong> — the conversion fills the lower band; the withdrawal bracket fill pulls more traditional to fill the rest. For example: conversions target the top of 12% ($100,800 MFJ), withdrawals target the top of 22% ($211,400 MFJ) — conversions cover the 10–12% band, withdrawals cover the 12–22% band for cash flow needs. This is the most common effective setup.</li>
      </ul>
      <Tip>
        Setting the conversion ceiling higher than the withdrawal ceiling is not allowed — the
        UI prevents it. If you lower the withdrawal ceiling, the conversion ceiling is
        automatically clamped down to match.
      </Tip>

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
        <li><strong>Tier 1</strong> (2026): income above $212,000 for married filing jointly adds roughly $594/year per person to Part B alone.</li>
        <li><strong>Tier 2–4</strong>: progressively higher surcharges. The top tier adds over $5,000/year per person.</li>
      </ul>
      <Tip>
        If a Roth conversion would push your income just over an IRMAA tier, the two-year-later
        surcharge may wipe out the tax savings. IRMAA is measured against your gross income (MAGI)
        before the standard deduction, while the Bracket Fill ceiling is set in taxable-income
        terms (after the standard deduction) — so the ceiling alone does not guarantee you stay
        below an IRMAA tier. After building your plan, check the IRMAA tab to confirm your
        projected income stays below the dashed tier lines. Also note that Bracket Fill ceilings
        automatically step down from MFJ to Single values in the year your filing status changes —
        so survivor years are sized correctly without manual adjustment.
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

      <H3>How it works — historical block bootstrap</H3>
      <P>
        The engine draws from real S&amp;P 500, Treasury, and CPI data going back to 1928. Each
        simulated future is built by randomly picking 3-year chunks of actual history and stitching
        them end-to-end until the sequence covers your full retirement. Using 3-year blocks — rather
        than single years — preserves short-run volatility clustering: crashes tend to bleed into
        the following year, and rallies often run for a few years. With 500 trials you get a
        realistic spread of outcomes from unlucky to fortunate.
      </P>
      <P>
        <strong>What this method cannot reproduce:</strong> multi-decade secular trends. The
        1966–1982 stagflation era lasted 16 consecutive years of near-zero real returns. Chopping
        it into 3-year blocks and mixing them with random other periods dilutes that sustained
        damage. As a result, bootstrap success rates tend to be somewhat optimistic for plans
        with long retirements — typically 20–30 years or more.
      </P>

      <H3>Running the simulation</H3>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.9, paddingLeft: 20, margin: '0 0 12px' }}>
        <li>
          <strong>▶ Run Simulation</strong> — runs Monte Carlo against your current saved plan.
          Takes 1–2 seconds. Run this first to get a baseline, and again any time you change
          simulation settings.
        </li>
        <li>
          <strong>Optimize for Robustness</strong> — tests your withdrawal strategy across 15
          different historical return sequences, picks the strategy that holds up best across all
          of them, then runs the full simulation. Takes 60–90 seconds. Use this when you want to
          squeeze out extra resilience — it is a fine-tuning step, not a fix for a plan that is
          fundamentally underfunded.
        </li>
      </ul>
      <Tip>
        Run the standard simulation first to establish your baseline. Use Optimize for Robustness
        only once you have a plan you broadly feel good about.
      </Tip>

      <H3>Robustness optimization — preview and apply</H3>
      <P>
        When Optimize for Robustness finishes, the result appears in <em>preview mode</em> — it
        does not automatically change your saved plan. A gold badge lets you know, and the fan
        chart updates to reflect the optimized strategy. You then have two choices:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.9, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Apply to Plan</strong> — permanently saves the new strategy. All other pages update to reflect it.</li>
        <li><strong>Discard</strong> — throws away the result and reverts to your original saved plan.</li>
      </ul>
      <P>
        The robustness optimizer typically scores slightly lower on the deterministic Projections
        page but meaningfully higher on Monte Carlo success rate — because it optimizes for bad
        sequences, not the average case. For most people, that trade-off is worth taking.
      </P>

      <H3>Simulation settings</H3>
      <FieldTable rows={[
        ["Equity Allocation %", "The stock/bond split applied inside each simulated year. Match this to your actual portfolio allocation. More stocks means more upside and more risk in bad years.", "60%"],
        ["Number of Trials", "How many simulated futures to run. 500 is fast and accurate enough for planning decisions. 1,000–2,000 gives smoother bands at the cost of a longer wait.", "500"],
      ]} />

      <H3>How to read the success rate</H3>
      <FieldTable rows={[
        ["95%+", "Very strong. Your plan survives almost every realistic market history. You have a meaningful safety margin.", ""],
        ["90–95%", "Healthy. Only the worst handful of historical sequences cause problems. A common planning target.", ""],
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

      <H3>Worst-case historical cohort cards</H3>
      <P>
        Below the fan chart, four named historical crises (1929 crash, 1966 stagflation, 1973 oil
        shock, 2000 dot-com + 2008 double-crash) are run as continuous historical sequences applied
        to your retirement start date. Click a card to overlay that trajectory on the fan chart as
        a dashed line. If your plan survives 1929 and 1966, it has genuine resilience.
      </P>

      <H3>Key metrics</H3>
      <FieldTable rows={[
        ["Median Final Portfolio", "The middle-of-the-road outcome. Half of simulations ended better than this number, half worse.", "$620K"],
        ["10th Percentile", "A bad-luck scenario. Only 10% of simulations ended worse. If still positive, the plan has real resilience in difficult markets.", "$85K"],
        ["90th Percentile", "A good-luck scenario. Only 10% of simulations ended better.", "$1.8M"],
      ]} />

      <H3>What to do if your success rate is below 90%</H3>
      <P>
        Head to the Dashboard and use the What-If Bar to find your highest-leverage options.
        In rough order of impact:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 24px' }}>
        <li><strong>Retiring 2–3 years later</strong> typically has the largest single impact — more contributions, fewer withdrawal years, and a higher Social Security benefit all compound together.</li>
        <li><strong>Reducing spending by 10%</strong> often moves the needle more than changing asset allocation or return assumptions.</li>
        <li><strong>Testing lower return assumptions</strong> shows how sensitive the plan is to market outcomes. If a 1% drop causes failure, build in more buffer before you retire.</li>
        <li><strong>Roth conversions</strong> will not dramatically shift success probability (they move tax timing, not total assets), but they can improve the 10th-percentile outcome by reducing tax drag when markets are already down.</li>
        <li><strong>Optimize for Robustness</strong> — if you are at 85–92% and want to push higher without changing your retirement date or spending, this often finds a withdrawal sequencing that gains a few more percentage points.</li>
      </ul>

      {/* ── Section 9: Historical Sequences ─────────────────── */}
      <H2 id="s9">Historical Sequence Analysis</H2>
      <P>
        This is a fundamentally different type of simulation from the bootstrap above, and the
        two answer different questions. Understanding both helps you know how confident to be in
        your plan.
      </P>

      <H3>How it works — rolling cohorts</H3>
      <P>
        The engine takes every calendar year from 1928 to 2023 and asks: "What would have happened
        to someone who retired in that year and followed this exact plan?" For a retiree starting
        in 1966, it applies the actual 1966 return, then the actual 1967 return, then 1968, and so
        on — in strict historical order, with no randomization whatsoever.
      </P>
      <P>
        This is the same method used by tools like cFIREsim. Each start year is called a{' '}
        <em>retirement cohort</em>. The <strong>historical success rate</strong> is simply the
        share of cohorts whose portfolio lasted to your Plan-To Age.
      </P>
      <P>
        A cohort is marked as <strong>full coverage</strong> only when the historical record is
        long enough to cover your entire retirement window without running out of data. A retiree
        who started in 2010 with a 40-year plan would reach 2050 — well beyond 2023 — so that
        cohort has partial coverage and is excluded from the success rate calculation.
      </P>

      <H3>Why it is more conservative than bootstrap for long retirements</H3>
      <P>
        The 1966–1982 stagflation era ran 16 consecutive years of near-zero or negative real
        returns. In the bootstrap, that era gets chopped into 3-year blocks and mixed with random
        other periods — any one simulation might get two of those stagflation blocks and then jump
        to the 1990s boom. In the historical sequence, the 1966 cohort gets all 16 years of
        stagflation intact. That sustained damage is much harder for a plan to absorb.
      </P>
      <P>
        If the bootstrap says 95% and the historical sequences say 80%, the gap is telling you
        something important: your plan&apos;s weakness is long secular bear markets, not short
        crashes. That is a different risk than what the bootstrap measures and may require a
        different response (lower withdrawal rate, more conservative asset allocation, flexible
        spending rules).
      </P>

      <H3>How to read the survival timeline</H3>
      <P>
        The colored bar shows one block per retirement start year from 1928 to 2023. Green means
        that cohort&apos;s portfolio survived to your Plan-To Age. Red means it ran out of money.
        Gray blocks have partial historical coverage and are not included in the success rate.
        Hover over any block to see the exact year and result.
      </P>
      <P>
        Clusters of red blocks reveal the dangerous eras: typically 1929–1932 (Great Depression),
        1965–1973 (stagflation onset), and sometimes 1999–2001 (dot-com bust). If red blocks
        appear outside those clusters, examine your plan — moderate eras should not be causing
        failure.
      </P>

      <H3>How to read the trajectory chart</H3>
      <P>
        The gold fan shows the range of portfolio outcomes across full-coverage cohorts — same
        structure as the bootstrap fan chart. The thin red lines running through the fan are the
        individual trajectories of cohorts that eventually ran out of money. You can see both
        when depletion started and how steeply the portfolio fell.
      </P>
      <P>
        The median line reflects the cohort at the 50th percentile — half of full-coverage
        cohorts ended with more, half with less.
      </P>

      <H3>Using bootstrap and historical sequences together</H3>
      <P>
        The two tools are complementary, not redundant. A useful planning posture:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 12px' }}>
        <li>Use the <strong>bootstrap success rate</strong> as your primary probability estimate — it has 500 trials and gives a statistically stable read on your risk profile.</li>
        <li>Use the <strong>historical success rate</strong> as a stress-test floor — if the plan fails more than a handful of historical cohorts, it has a structural vulnerability to the kind of sustained bad decade that the bootstrap understates.</li>
        <li>If bootstrap and historical rates are close (within 5–8%), the plan is robust to both short volatility and long secular trends. If the gap is large, the plan relies on the future not producing a decade as bad as 1966–1982 or 1929–1933.</li>
      </ul>
      <Tip>
        A plan that passes both tests — bootstrap 90%+ and historical 85%+ — is genuinely well
        constructed. A plan that passes bootstrap but fails many historical cohorts is telling you
        it would have struggled in the real world&apos;s worst decades, regardless of what a
        probabilistic model says.
      </Tip>

      <H3>Worst cohort end balance</H3>
      <P>
        This metric cards shows the real-dollar end balance of the single worst-performing
        full-coverage cohort. It is not the cohort that ran out earliest — it is the one that
        ended with the smallest (possibly negative) balance at your Plan-To Age. This is your
        absolute downside under actual historical conditions.
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 24px' }}>
        <li>If this number is positive, even the worst historical market environment left something in the portfolio.</li>
        <li>If it is deeply negative, the worst cohort ran out significantly before your Plan-To Age — examine which year it was and what made it particularly damaging.</li>
      </ul>
    </div>
  );
}
