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
        zIndex: isMobile ? 160 : 200,
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

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(13,100,200,0.06)', border: '1px solid rgba(13,100,200,0.2)',
      borderRadius: 8, padding: '10px 14px', margin: '12px 0',
      fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
    }}>
      <strong style={{ color: 'var(--text-primary)' }}>How this tool is designed: </strong>{children}
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

export { SECTIONS };
export function GuideContent() {
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
        about your life: your age, what you earn, what you spend, what you have saved. It
        runs the numbers forward to your Plan Through Age. The goal is not a perfect forecast; it is
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
        <li><strong>Today&apos;s $ / Nominal $</strong>: switches how every chart and balance is displayed. <em>Today&apos;s $</em> adjusts for inflation so you can compare future numbers to what money is worth right now. <em>Nominal $</em> shows the raw future amounts as they would appear on an account statement. The toggle also affects dollar inputs in the Custom Blend editor and Manual Conversion Schedule. When set to Nominal $, you enter future nominal amounts directly and the engine converts them to real dollars for storage. You can toggle this at any time.</li>
        <li><strong>Reset</strong>: clears all your inputs and starts fresh. You will be asked to confirm before anything is erased.</li>
        <li><strong>Import</strong>: loads a plan you previously exported as a JSON file.</li>
        <li><strong>Export</strong>: saves your current plan as a JSON file you can back up, share, or reload later.</li>
        <li><strong>?</strong>: opens this guide.</li>
      </ul>

      <H3>Recommended order to fill things in</H3>
      <ol style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: 0 }}>
        <li><strong>Personal Details</strong>: your name, age, when you plan to retire, state of residence</li>
        <li><strong>Income &amp; Expenses</strong>: every source of income and every spending category</li>
        <li><strong>Portfolio</strong>: your current account balances, growth assumptions, and savings contributions</li>
        <li><strong>Goals</strong>: pick what you want the optimizer to solve for, then click <strong>Build Plan &rarr;</strong></li>
        <li><strong>Results</strong>: explore Dashboard, Projections, Tax Planning, and Monte Carlo</li>
      </ol>

      {/* ── Section 1: Personal Details ──────────────────────── */}
      <H2 id="s1">Personal Details</H2>
      <P>
        The first section of the Inputs page. These fields define the timeline for everything
        else: when you start withdrawing, when income sources kick in, and how long the plan runs.
      </P>

      <H3>Your profile</H3>
      <FieldTable rows={[
        ["Name", "A label used in charts and tables. Has no effect on any calculation.", '"Alex"'],
        ["Date of Birth", "Used to calculate your age in each projection year. Only the birth year matters. The simulation uses calendar year minus birth year for all age-gated rules (RMDs, Medicare, Social Security). The birth month and day have no effect on any calculation.", "1970-04-15"],
        ["Retirement Age", "The age you plan to stop working. Contributions stop here; withdrawals begin.", "62"],
        ["Plan Through Age", "When this person is modeled to pass away and when the plan ends for them. SS stops, RMDs stop, and their accounts roll to the survivor. For a couple, the plan runs until the later of the two Plan Through Ages. Pick 90–95 as a conservative floor.", "92"],
      ]} />
      <Tip>
        Click <strong>+ Add Spouse / Partner</strong> in the Personal Details header to include a
        second person. Each person can have a different retirement age, which is helpful if one of you plans
        to keep working for a few extra years.
      </Tip>

      <H3>How Ages Work</H3>
      <P>
        The simulation works in whole calendar years. Your age in any given year is simply{' '}
        <code>calendar year − birth year</code>. The exact birthday within the year is ignored.
        This matches how the IRS and Social Security Administration define age-based thresholds:
        RMDs start the year you turn 73, Medicare eligibility begins the year you turn 65, and
        Social Security benefits are computed from the year you claim. None of these rules depend
        on your birth month.
      </P>
      <P>
        <strong>Example:</strong> born May 3, 1974. In the 2026 projection row you are age 52
        (2026 − 1974), even though you were technically 51 until May 3. In 2027 you are age 53.
      </P>
      <P>
        <strong>Plan Through Age</strong> does double duty: it is both the person&apos;s modeled mortality
        age <em>and</em> the last year the simulation runs for them. There is no separate &ldquo;Plan-To&rdquo; horizon. The plan ends when the last-living person reaches their Plan Through Age.
      </P>
      <P>
        For a couple, the household horizon is <code>max(Person A Plan Through Age, Person B Plan Through Age converted to A&apos;s frame)</code>.
        The simulation runs until that later date, modeling the survivor&apos;s finances after the first person passes.
      </P>
      <P>
        Income and expense streams support four <strong>Until</strong> modes (set in the stream row):
      </P>
      <FieldTable rows={[
        ["At age", "Stream runs through a specific age (in the owner's own age frame). Most common. Use for SS starting at 70, a pension that stops at 80, etc.", "At age 90"],
        ["End of life", "Stream runs through the owner's Plan Through Age. Ideal for income that lasts exactly as long as the person does (pension, annuity with life option).", "Life"],
        ["Last survivor", "Stream runs to the later of both persons' Plan Through Ages. Use for joint annuities or household expenses that continue until the last survivor.", "Survivor"],
        ["For N years", "Period-certain: stream runs for exactly N years from its start age, regardless of who is alive. Useful for a bridge or COLA-deferred window.", "20 yrs"],
      ]} />
      <P>
        The <strong>Survivor %</strong> column sets what fraction of the stream continues after the owner&apos;s death.
        Set it to 0% for income that stops completely (e.g., an individual life annuity), 50% for a joint-and-50% annuity,
        or 100% for expenses that continue at full cost for the surviving spouse. SS streams always set survivor % to 0%
        because the survivor SS benefit is modeled separately via the Social Security survivor rule.
      </P>

      <H3>State of Residence</H3>
      <P>
        Select the state where you will live in retirement. The app automatically applies that
        state&apos;s income tax rules to your withdrawals each year. If you are planning to move
        to a state with no income tax (like Florida or Texas), select that state now. It can
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
        ["ACA Start Age", "The age at which each person enters the marketplace. Default is your retirement age. Set this later if the gap years are covered by COBRA or a spouse's employer plan.", "63"],
        ["No subsidy (COBRA)", "Check this if your income will be too high for subsidies, or if you will use COBRA. The full premium is counted as an expense.", ""],
      ]} />

      {/* ── Section 2: Income & Expenses ─────────────────────── */}
      <H2 id="s2">Income &amp; Expenses</H2>
      <Note>
        This tool models your <strong>retirement finances only</strong>: not your situation today.
        Every income and expense stream you enter should represent amounts that apply{' '}
        <em>after you retire</em>. Do <strong>not</strong> enter your current salary, current
        mortgage, or today&apos;s living expenses here. Instead, enter what each item will look
        like once you stop working: your pension payout, Social Security benefit, post-retirement
        healthcare costs, and the spending categories that will continue into retirement. Start
        ages must be at or after your retirement age. The engine begins the projection on your
        retirement date. Anything before that is outside the scope of this tool.
      </Note>
      <P>
        The second section of the Inputs page. Enter every source of money coming in (income)
        and every category of spending going out (expenses). All amounts are entered in{' '}
        <em>today&apos;s dollars</em>. The engine inflates them forward automatically using your
        inflation assumption.
      </P>

      <H3>Income Streams</H3>
      <P>
        Add one row per income source. Click <strong>+ Add Income</strong> to create a new row.
        Common types and how to enter them:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Social Security</strong>: enter your estimated annual benefit at the age you plan to claim it. Leave growth as <em>Tracks CPI</em>; the model applies cost-of-living adjustments using your plan-wide inflation assumption.</li>
        <li><strong>Pension</strong>: enter the annual payout. Use <em>Fixed Rate 0%</em> if it has no cost-of-living adjustment, or a fixed rate matching your pension&apos;s guaranteed annual increase (e.g., 2%).</li>
        <li><strong>Part-time work</strong>: set the Start Age to your retirement age and a Stop Age for when you expect to fully stop working. Use <em>Tracks CPI</em> for modest wage growth, or <em>Fixed Rate</em> for a known salary.</li>
        <li><strong>Rental income</strong>: enter annual net rent after expenses. Use <em>CPI ± Adjust</em> if rents in your market consistently run above or below general inflation.</li>
        <li><strong>Annuity</strong>: enter the annual payout. Use <em>Fixed Rate</em> with the contractual cost-of-living adjustment (often 0% or 1–2%).</li>
      </ul>
      <Tip>
        Not sure what your Social Security benefit will be? Visit ssa.gov and use the "my Social
        Security" portal. It shows your projected benefit at age 62, 67, and 70 based on your
        actual earnings history.
      </Tip>

      <H3>Growth rate</H3>
      <P>
        Each income stream has a <strong>Growth %</strong> column that controls how the annual
        amount increases over time. Three modes are available. Select the one that best matches
        the source:
      </P>
      <FieldTable rows={[
        ["Tracks CPI", "The amount goes up by the same percentage as your inflation setting each year. Choose this when the income is fully indexed to inflation, and the display stays clean with no extra fields.", "Most wage-replacement income"],
        ["CPI ± Adjust", "Grows at CPI plus or minus an offset you set in 0.1% increments. Use this when the stream tracks inflation but with a known premium or discount.", "Healthcare at CPI+2.5%, conservative SS at CPI−0.5%"],
        ["Fixed Rate", "Grows at a fixed percentage you enter, regardless of what inflation does. The effective purchasing power changes over time if inflation differs from your assumption.", "Pension with a guaranteed 2% annual increase, annuity at 0%"],
      ]} />
      <Tip>
        <strong>CPI ± vs. Fixed:</strong> the difference matters when you later change your
        inflation assumption. A stream set to <em>CPI ± 0%</em> automatically adjusts its
        effective growth rate to match the new assumption; a stream set to <em>Fixed 3%</em> stays
        at 3% regardless. Use CPI ± when you want the stream to stay in sync with inflation;
        use Fixed when the rate is contractually set and independent of CPI.
      </Tip>

      <H3>Income stream types</H3>
      <P>
        The <strong>Type</strong> dropdown controls how the engine routes each stream through the tax
        model. Choose the type that matches the legal character of the income, not just whether it
        feels "taxable."
      </P>
      <FieldTable rows={[
        ["Pension / Annuity", "Fully taxable federally; state treatment varies (IL exempts pensions and annuities; CA/NY do not). Use the taxable portion field for the return-of-basis exclusion ratio on a non-qualified annuity.", "Employer pension, immediate annuity, non-qualified annuity"],
        ["Other", "Fully taxable at both federal and state level. Taxable portion follows the taxable portion field (default 100%).", "Rental income, part-time work, deferred comp (enter at taxable portion: 100%)"],
        ["Tax-Exempt Income", "Federally tax-exempt but included in Social Security provisional income, ACA MAGI, and IRMAA MAGI. State taxable % controls whether the interest is taxable to your resident state (100% for out-of-state bonds, 0% for in-state). Use this only for bonds whose principal is not included in your Taxable balance. For munis held in your brokerage, use Tax-Exempt Yield in Portfolio instead.", "Bond ladder held outside your brokerage portfolio"],
        ["VA / Disability", "Fully exempt from federal and state tax. Invisible to every tax and surcharge calculation. State taxable % is locked to 0%.", "VA disability compensation, military disability"],
      ]} />
      <Tip>
        <strong>Deferred comp / non-qualified deferred compensation:</strong> enter as <em>Other</em> at <em>taxable portion: 100%</em>. These payouts are ordinary wages, fully counted in your adjusted gross income. If your installments qualify for the source-state exemption (10+ year substantially-equal schedule), set
        <em>State taxable %</em> to 0% to reflect that only your resident state may tax the
        payment. The engine does not compute self-employment tax on consulting income entered
        as Other.
      </Tip>
      <Tip>
        <strong>Portfolio yield vs. income stream:</strong> if your munis are held inside your brokerage account, use <em>Tax-Exempt Yield</em> in the Portfolio section, not a Tax-Exempt Income stream. The stream is only for bonds whose principal you haven't included in the Taxable balance. Using both double-counts the income.
      </Tip>

      <H3>State Taxable %</H3>
      <P>
        Each income stream has a <strong>State taxable %</strong> column (default 100%). It
        controls what fraction of that stream counts toward your state income tax base. Use it
        when your state exempts certain income types or only taxes a portion of them. For
        example, a state that does not tax military pensions, or one that exempts annuity income.
      </P>
      <FieldTable rows={[
        ["100%", "The full taxable amount of the stream is subject to state tax. Default for most income.", "Wages, rental income"],
        ["0%", "The stream is completely excluded from state tax, as if it does not exist for state purposes.", "SS in a state that fully exempts SS income"],
        ["50%", "Only half the stream counts toward state tax. Useful for states that partially exempt certain income.", "Military pension with 50% state exemption"],
      ]} />

      <H3>How it interacts with the State of Residence dropdown</H3>
      <P>
        The behavior of this field depends entirely on which state you have selected:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li>
          <strong>Named states (IL, CA, NY, etc.)</strong>: these have built-in exemption rules
          that the engine applies automatically. Illinois, for example, fully exempts all pension
          and annuity distributions regardless of the State taxable % you enter. For these states,
          the field has no effect on pension or annuity streams. The built-in profile takes
          precedence. It does still apply to "Other" income types (wages, rental) in all named
          states.
        </li>
        <li>
          <strong>No state tax (TX, FL, WA, etc.)</strong>: the effective rate is 0%, so the
          field has no effect regardless of what you enter.
        </li>
        <li>
          <strong>Custom (flat rate)</strong>: the field is fully active. The flat rate is applied
          to the portion of each stream you designate as state-taxable. This is the primary use
          case for the field, since a custom flat rate has no built-in knowledge of what your
          state exempts.
        </li>
      </ul>
      <Tip>
        <strong>Modeling a flat dollar exemption</strong>: some states exempt a fixed dollar
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
        row. Broad categories work well. The goal is coverage, not accounting precision. Common
        categories: housing, food, transportation, healthcare, travel, and entertainment.
      </P>
      <Tip>
        <strong>Do not include</strong> income taxes, IRMAA surcharges, or ACA premiums (when
        enabled) in your expense rows. The tool calculates and applies these automatically each
        year based on your projected income. Adding them manually will double-count them.
      </Tip>
      <P>
        Each expense has a start age, a stop age, and its own <strong>Infl %</strong> column,
        the same three-mode control as income growth. The default is <em>Tracks CPI</em>, which
        means the expense rises with your plan-wide inflation assumption each year. Override it
        per row when a specific category inflates differently:
      </P>
      <FieldTable rows={[
        ["Tracks CPI", "The expense grows at your plan's inflation assumption. Appropriate for most household spending.", "Food, utilities, entertainment"],
        ["CPI ± Adjust", "Grows at CPI plus an offset. Use when a category consistently outpaces general inflation.", "Healthcare at CPI+2.5%"],
        ["Fixed Rate", "Grows at a locked percentage independent of the inflation assumption.", "Mortgage at 0% (fixed payment), parking at 3%"],
      ]} />
      <P>
        This lets you model things like a mortgage that ends at age 72 with 0% inflation, or
        travel spending that tapers off in your late 70s, or healthcare that inflates faster than
        the rest of your budget.
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
        Use this section to model a single cash event at a specific age, such as an inheritance, a
        business sale, a large bonus, or an inherited retirement account. Click{' '}
        <strong>+ Add One-Time Event</strong> in the Income &amp; Expenses section to create a row.
      </P>
      <FieldTable rows={[
        ["Description", "A label shown in tables. Has no effect on calculations.", '"Inherited IRA"'],
        ["Whose", 'For couples, which person&apos;s age the event is anchored to. "Household" uses Person A&apos;s age.', "Household"],
        ["Account", "The account type determines tax treatment and depletion rules. Four options are available.", "Inherited Pre-Tax IRA"],
        ["At Age", "The age at which the account is received. Based on the selected person's age.", "65"],
        ["Amount", "The account balance at the time of inheritance, in today's dollars.", "$250,000"],
      ]} />

      <H3>How the four account types are handled</H3>
      <P>
        The account type you choose determines both the tax treatment and how the engine models
        required withdrawals:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li>
          <strong>Taxable (home sale, insurance, etc.)</strong>: deposited into your brokerage at
          full cost basis (no embedded capital gain). The engine includes the amount as ordinary
          income in the year it arrives. Use this for cash inheritances, business-sale proceeds, or
          large bonuses.
        </li>
        <li>
          <strong>Inherited Pre-Tax IRA</strong>: follows the 10-year distribution rule for a
          non-spouse beneficiary. The balance is added to your Traditional IRA at the age you enter.
          Each subsequent year the engine computes a floor distribution (remaining balance ÷ years
          left in the 10-year window) and forces enough out to meet it, counting those distributions
          as ordinary income. Strategy withdrawals from your traditional account proportionally
          reduce the required supplement, so if your withdrawal plan already draws heavily from
          pre-tax, the forced add-on shrinks accordingly. Any balance still in the account at the
          end of year 10 is fully distributed. Use this for a traditional IRA or 401(k) inherited
          from a non-spouse.
        </li>
        <li>
          <strong>Inherited Roth IRA</strong>: the same 10-year distribution rule applies, but
          distributions are tax-free. The balance is added to your Roth account and a proportional
          annual floor is forced out over the 10-year window. Those distributions generate no
          ordinary income and reduce your need for taxable or traditional withdrawals in those years.
          Use this for a Roth IRA inherited from a non-spouse.
        </li>
        <li>
          <strong>Inherited HSA</strong>: under IRS rules, a non-spouse HSA beneficiary must
          include the full fair-market value as ordinary income in the year the account is received.
          The engine deposits the full amount into your taxable brokerage (at cost basis) and counts
          the entire amount as ordinary income that year, as a one-time spike. No deferred depletion
          schedule applies. Use this for an HSA inherited from anyone other than a surviving spouse.
        </li>
      </ul>
      <Tip>
        <strong>Inherited Pre-Tax IRA example:</strong> You inherit $250,000 at age 65. In year 1,
        the floor is $250,000 ÷ 10 = $25,000. If your withdrawal strategy already pulls $15,000
        of traditional proportionally, the engine only forces an additional $10,000 supplement. By
        year 10 (age 74) any remaining balance is fully distributed. All distributions are ordinary
        income and appear in the "Inherited Income" column on the Projections page.
      </Tip>
      <Tip>
        Inherited account events change the optimal withdrawal and conversion strategy, so re-run
        the optimizer after adding or modifying any event. The nav bar will prompt you to
        re-optimize if you navigate away from Inputs after changing a lump sum event.
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
        ["Taxable Return", "Total annual growth rate for your brokerage (non-retirement) accounts, including price appreciation, dividends, and any muni interest. Enter the full total return here; the yield sub-fields below carve out slices of it.", "6.5%"],
        ["↳ Div / Interest Yield", "The portion of Taxable Return paid out annually as taxable dividends or interest. Taxed each year: qualified dividends at long-term capital gains rates, ordinary dividends and interest at your income rate. Reinvested into cost basis by default (see % Paid out in cash below). Leave at 0 to treat all growth as price appreciation.", "1.5%"],
        ["→ % Qualified", "What fraction of the Div Yield above is qualified dividends (taxed at 0/15/20% long-term capital gains rates). The remainder is ordinary income. Broad US equity ETFs are typically 80–100% qualified; bond funds and REITs are 0%.", "80%"],
        ["↳ Tax-Exempt Yield", "The portion of Taxable Return that comes from tax-exempt (muni) interest generated by bonds held inside your brokerage balance. Excluded from federal adjusted gross income and not counted as ordinary income or long-term capital gains, but it is counted toward Social Security provisional income, ACA MAGI, and IRMAA MAGI. Reinvested into cost basis by default (see % Paid out in cash below). Use this only for munis held inside the portfolio balance; use a Muni Bond income stream for bonds held outside.", "1.0%"],
        ["→ % State-taxable", "What fraction of the Tax-Exempt Yield above is taxable by your resident state. Set to 0% for in-state bonds (most states exempt their own obligations) and 100% for out-of-state bonds.", "100%"],
        ["→ % Paid out in cash", "What fraction of the total yield (Div + Tax-Exempt) is paid out as spendable cash rather than reinvested. 0% means full dividend reinvestment, where yield compounds and adds to cost basis each year. 100% means all dividends and muni coupons are swept to your checking account and spent before any shares are sold. Tax is identical either way, since the dividend is taxable whether or not you spend it. What changes: spending from yield means you sell fewer shares, realizing less capital gain. Unspent distributions are swept back to the brokerage at full basis.", "0%"],
        ["Pre-tax Return", "Growth rate for Traditional 401(k) and IRA accounts.", "6.5%"],
        ["Roth Return", "Growth rate for Roth IRA and Roth 401(k) accounts.", "6.5%"],
      ]} />

      <H3>Expected Inflation</H3>
      <FieldTable rows={[
        ["Annual Rate", "How fast prices rise each year. The long-run US average is around 3%.", "3.0%"],
      ]} />
      <Tip>
        <strong>How the yield fields relate to Taxable Return:</strong> think of the total return
        as three slices: <em>Div Yield + Tax-Exempt Yield + price appreciation</em>. The two yield
        fields name sub-components of the same total; the remainder is price gain, deferred until
        sale. Example: 6.5% total = 1.5% div + 1.0% muni + 4.0% price gain. The yield fields must
        sum to no more than Taxable Return. The UI prevents you from exceeding it.
      </Tip>
      <Tip>
        <strong>Muni bonds in portfolio vs. as a stream:</strong> use Tax-Exempt Yield for bonds
        whose principal is already included in your brokerage balance. Use a <em>Muni Bond</em>{' '}
        income stream (Income &amp; Expenses section) for a separate bond ladder whose principal is
        outside your tracked portfolio, such as a bond you plan to hold to maturity. Entering
        the same income in both places double-counts it; a warning appears in both sections if
        you do.
      </Tip>
      <Tip>
        <strong>Dividend reinvestment vs. spending dividends:</strong> the default (0% paid out) reinvests all yield,
        which is simplest and matches most accumulation-phase plans. In retirement, switching to 100%
        can lower your effective tax rate: you still owe tax on the dividend, but by spending it you
        avoid selling shares and realizing additional capital gains, which is especially valuable when your
        brokerage gain fraction is high. Setting 100% when spending is well below total income is
        harmless, since unspent distributions are swept back to the brokerage automatically.
      </Tip>

      <H3>End-Balance Tax Adjustment</H3>
      <P>
        These two rates apply <em>only</em> to the balance left over at your plan-through age. They represent the tax still owed on
        whatever you did not spend. They do not touch the year-by-year tax engine, which continues to compute
        real bracket-by-bracket federal and state tax on every year's income, conversions and withdrawals.
      </P>
      <FieldTable rows={[
        ["Pre-Tax Accounts", "Blended effective rate you assume will eventually be paid on the ending 401(k)/IRA balance at liquidation. This is an average across the whole balance, not a marginal bracket. A modest balance drawn slowly may be closer to 12–15%; a large one drawn fast or inherited under the 10-year rule may be 28–32%.", "22%"],
        ["Unrealized Gains", "Capital-gains rate on brokerage growth above cost basis. Your original contributions (cost basis) are already-taxed money and are never haircut. Roth balances are never taxed.", "15%"],
      ]} />
      <Tip>
        <strong>What these rates change:</strong> they drive the Tax-Adj Balance tile on the Dashboard <em>and</em> what the optimizer's Max End Balance goal maximizes. When both rates are 0%, the feature is fully off, and the optimizer reverts to maximizing the raw (gross) ending balance. Any non-zero value tells the optimizer to account for the embedded tax liability in your pre-tax accounts.
      </Tip>
      <Tip>
        <strong>Why a flat rate, not bracket math:</strong> a real drawdown spans multiple tax brackets over multiple years, so no single rate perfectly captures the true tax. Instead of false precision, the app uses one blended average rate that you control, the same approach used by Pralana Gold. Set it lower (12–15%) if your balance is modest or will be drawn slowly; set it higher (28–32%) if you have a large pre-tax balance or expect heirs to take required distributions under the 10-year rule.
      </Tip>

      <H3>Current Account Balances</H3>
      <P>
        Enter your total balance in each of three account types as of <strong>January 1 of the current year</strong>.
        If you have a spouse, each person gets their own set of balances.
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
        <strong>Use your January 1 statement balance, not today&apos;s balance.</strong> The projection engine starts
        each simulation on January 1 of the current year and applies a full year of returns from that point.
        Entering a mid-year balance causes the engine to double-count the growth already earned this year.
        Most brokerage and 401(k) platforms let you view your account history. Pull the balance as of January 1.
      </Tip>
      <Tip>
        Add up all accounts of the same type across all institutions and enter the combined total.
        If you have a 401(k) at your current employer and a rollover IRA from a previous job, add
        them together and enter that sum under Pre-tax.
      </Tip>

      <H3>Annual Contributions (before retirement)</H3>
      <FieldTable rows={[
        ["Annual contribution", "How much you save in total across all accounts each year until retirement.", "$25,000"],
        ["Contribution growth", "How fast your savings rate increases each year, for example if you expect raises.", "2%"],
        ["Contribution mix", "What fraction goes into each bucket type. The three percentages must add up to 100%. This should match your actual payroll elections.", "0% Taxable / 80% Pre-tax / 20% Roth"],
      ]} />

      {/* ── Section 4: Goals & Build Plan ───────────────────── */}
      <H2 id="s4">Goals &amp; Build Plan</H2>
      <P>
        The fourth section of the Inputs page. Pick what you want the optimizer to solve for,
        then click <strong>Build Plan &rarr;</strong>. The optimizer runs for a few seconds and
        produces a custom per-age withdrawal blend policy. For example, 60% taxable / 30%
        pre-tax / 10% Roth from age 62–70, then a different mix from 70 onward, along with a
        Roth conversion schedule. It then takes you to the Dashboard.
      </P>

      <H3>What would you like to optimize for?</H3>
      <FieldTable rows={[
        ["Max End Balance", "Finds the plan that leaves the largest portfolio at your Plan Through Age. Good if your priority is leaving a legacy, or if you want the maximum safety cushion.", ""],
        ["Max Sustainable Spending", "Finds the highest annual spending level your plan can support without running dry. Optionally set a legacy target (after tax) to constrain spending — the optimizer ensures the ending after-tax balance meets your floor. Good for understanding your upper spending limit and planning for heirs.", ""],
        ["Earliest Retirement Age", "Solves for the soonest you could retire while keeping the plan fully funded. Good for FIRE planning or exploring what is possible if you save more.", ""],
      ]} />
      <P>
        Once you have built a plan, you can switch goals and click <strong>Re-optimize</strong>
        on the Dashboard at any time. You do not need to come back to this page.
      </P>
      <Tip>
        Start with <strong>Max End Balance</strong> to get a baseline, then switch to <strong>Max
        Sustainable Spending</strong> to see what your plan can actually support. The difference
        between the two often surprises people.
      </Tip>
      <Tip>
        <strong>Why the optimizer may recommend more Roth conversions than you expect:</strong> Max End Balance maximizes the <em>tax-adjusted</em> ending balance, and a Roth dollar is worth more than a pre-tax dollar because the IRA still owes income tax. Paying conversion tax now looks expensive year-by-year but improves the score. Adjust the rates (or set both to 0% to optimize raw balances) in <em>End balance effective tax rates</em> at the bottom of the Optimization Goal panel.
      </Tip>

      {/* ── Section 5: Dashboard ─────────────────────────────── */}
      <H2 id="s5">Reading the Dashboard</H2>
      <P>
        The Dashboard is your main results view. It shows the headline numbers for your plan,
        tools to adjust strategy, and four charts to visualize how your money flows over time.
      </P>

      <H3>Plan Summary banner</H3>
      <P>
        The dark banner at the top shows key numbers at a glance. Green values mean the
        plan is on track; yellow flags something worth addressing. The status badge (e.g., "✓ Fully Funded · 30 yrs") summarizes plan longevity so the tile count can stay compact. When both tax-adjusted rates are set to 0%, the Tax-Adj Balance tile is hidden.
      </P>
      <FieldTable rows={[
        ["End Balance", "Raw portfolio value at your Plan Through Age, before any tax adjustment. Green means fully funded; yellow means it ran out before that age. Hover the tile for a tooltip clarifying it is pre-tax-adjustment.", "$820K"],
        ["Tax-Adj Balance", "Portfolio value after subtracting estimated tax on pre-tax accounts and unrealized gains. Roth is untouched. Click 'breakdown →' under the number to see the per-bucket arithmetic. Only shown when at least one rate is above 0%.", "$648K"],
        ["Annual Spending", "Your first full year of retirement spending in today's dollars (or nominal, matching the display mode toggle). A quick sanity check that the plan is funding the lifestyle you entered.", "$85K"],
        ["Initial WR", "Your first-year withdrawal divided by your portfolio at retirement. The widely-cited guideline is 4% or below. Above 5% is a flag worth examining.", "3.8%"],
        ["Lifetime SS", "The total Social Security income you will receive over your entire retirement.", "$640K"],
        ["All-in Tax", "Every dollar of federal tax, state tax, and Medicare surcharges (IRMAA) you will pay over the plan. This is your true lifetime tax burden.", "$310K"],
        ["Lifetime IRMAA", "Total Medicare premium surcharges triggered by income above certain thresholds. Roth conversions can reduce this significantly.", "$24K"],
        ["Lifetime RMDs", "Total Required Minimum Distributions, which are forced withdrawals from pre-tax accounts starting at age 73. Doing Roth conversions before then reduces this number.", "$190K"],
        ["Roth Converted", "The total amount voluntarily moved from pre-tax accounts to Roth over the plan lifetime.", "$280K"],
      ]} />

      <H3>Gross vs. tax-adjusted</H3>
      <P>
        The End Balance tile and the Tax-Adj Balance tile show two views of the same portfolio at the plan's end date.
      </P>
      <P>
        <strong>Why they differ:</strong> $1 sitting in a pre-tax 401(k) or IRA is not the same as $1 in Roth. The pre-tax dollar carries an embedded income-tax liability, because you have never paid tax on it, and every dollar you (or your heirs) withdraw will be taxed as ordinary income. The taxable brokerage falls in between: your original contributions (cost basis) are already-taxed money, but the growth above basis will owe capital-gains tax when you sell.
      </P>
      <P>
        The tax-adjusted figure accounts for all three of these differences in one number: Roth stays at face value, cost basis is returned tax-free, unrealized gains are haircut at the capital-gains rate, and the full pre-tax balance is haircut at the ordinary rate. The result is a more honest comparison across strategies. A plan with a $1M Roth is genuinely better than a plan with a $1M IRA, and the Tax-Adj tile makes that visible.
      </P>
      <P>
        Click <strong>breakdown →</strong> beneath the tile to see the per-bucket arithmetic. The breakdown modal also discloses what the flat-rate model does not capture (state tax, net investment income tax, IRMAA, bracket variation), so you can judge whether to adjust the rates for your situation.
      </P>
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
        are shown in grey, meaning the effect is negligible.
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
        <strong>⚡ Optimize for me</strong>: the optimizer builds a custom per-age-window
        withdrawal blend and sizes Roth conversions for you. Two pill rows appear:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Goal</strong>: pick what to optimize for: Max End Balance, Max Spending, or Earliest Retire. A ✓ marks the goal the plan was last built for. For Max Spending, you can also set a legacy target (after tax) — the optimizer will limit spending to ensure that floor is met. Selecting a different goal highlights it but does not run the optimizer yet.</li>
        <li><strong>Roth conversions</strong>: five pills let you constrain how the optimizer handles conversions: <em>Optimizer decides</em> (the optimizer searches for the best amount), <em>None</em>, <em>Bracket-Fill</em>, <em>Fixed Amount</em>, or <em>Manual</em>. Picking any conversion pill turns it amber as a "pending" state. The charts do not change yet.</li>
      </ul>
      <P>
        The <strong>↗ Re-optimize</strong> button in the top-right of the panel applies your
        selections. When a pending conversion pill is waiting, the button shows a dot and reads
        "Re-optimize · Apply", a reminder that the charts still reflect the previous run.
        Click it to run the optimizer with your new goal and conversion choice; the charts update
        only after it completes. A small hint "Takes effect when you re-optimize" appears below
        the conversion pills while a selection is pending.
      </P>
      <P>
        When the optimizer finishes, the result appears as a <strong>preview</strong>: an ⚡ banner
        at the top of the Dashboard shows the pending result. You can review the projected outcome
        before committing: click <strong>Apply to Plan</strong> to save the new strategy, or{' '}
        <strong>Discard</strong> to return to your previous plan. This gives you a chance to compare
        Dashboard numbers before overwriting anything.
      </P>
      <P>
        The <strong>📊 Conversions vs RMDs</strong> link opens a chart showing voluntary Roth
        conversions (above zero) versus forced RMDs (below zero) by age. This is useful for seeing when
        and by how much conversions move the needle.
      </P>
      <Tip>
        In <em>Optimize for me</em> mode, selecting a conversion pill does not immediately change
        the charts. That is intentional. The optimizer needs to run with the new constraint
        before the result is meaningful. Click Re-optimize to commit.
      </Tip>

      <P>
        <strong>✎ Set it myself</strong>: you pick the withdrawal strategy and conversion mode
        directly. Changes apply instantly without re-optimizing. Two pill rows appear:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Withdrawal order</strong>: five presets plus a Custom blend option control which accounts you draw from each year:
          <ul style={{ marginTop: 4, lineHeight: 1.9 }}>
            <li><strong>Taxable First</strong>: spend from your brokerage accounts first, letting tax-advantaged accounts compound untouched.</li>
            <li><strong>Roth First</strong>: spend Roth money first, shrinking future Required Minimum Distributions.</li>
            <li><strong>Traditional First</strong>: spend pre-tax accounts first, also reducing RMDs but increasing current taxable income.</li>
            <li><strong>Proportional</strong>: draw from all three account types in proportion to their balances. Simple but rarely the most tax-efficient.</li>
            <li><strong>Bracket-Fill</strong>: a dropdown that lets you pick a bracket ceiling. The engine pulls from traditional (pre-tax) accounts up to that ceiling each year, then covers remaining spending from Roth or taxable. Usually the most tax-efficient withdrawal approach over the long run.</li>
            <li><strong>✎ Custom blend</strong>: opens an editor to define your own per-age-window blend. When the optimizer builds your plan, this is automatically active and reflects the optimizer's output. The Trad Cap and Conv $/yr columns follow the Today's $ / Nominal $ toggle. Switch to Nominal $ to enter future dollar amounts directly.</li>
          </ul>
        </li>
        <li><strong>Roth conversions · instant</strong>: four pills (None, Bracket-Fill, Fixed Amount, Manual) switch the active conversion mode immediately. Bracket-Fill and Fixed Amount show an "Edit details →" link to configure the window and amount; Manual opens a per-year schedule editor.</li>
        <li><strong>Pay taxes from brokerage</strong>: a toggle that directs the engine to cover your annual tax bill from your taxable account first, before touching your IRA or Roth balances. Useful when you want to preserve tax-deferred or tax-free growth as long as possible, or when you need to manage your taxable income precisely without being forced to withdraw extra from pre-tax accounts to cover the tax on the withdrawal itself.</li>
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
        You can freely mix any combination. For example, the optimizer&apos;s custom withdrawal
        blend with Bracket-Fill conversions, or Proportional withdrawals with a Manual schedule.
      </P>
      <P>
        Within conversion mode, switching pills only changes which mode is active. Settings for
        every other mode (amounts, age windows, ceilings, manual schedule entries) are preserved
        but dormant. If you configure a Manual Schedule, switch to Bracket-Fill to compare, then
        switch back, your entries are still there.
      </P>

      <FieldTable rows={[
        ["None", "Leave pre-tax money where it is. RMDs starting at age 73 may push you into higher brackets in later years.", ""],
        ["Fixed Amount", "Convert a set dollar amount each year within an age window you define.", "$30,000/yr, ages 60–70"],
        ["Bracket-Fill", "Convert enough each year to fill the chosen bracket. Ceiling is automatically capped at or below the withdrawal Bracket-Fill ceiling.", "Top of 12% bracket"],
        ["Manual", "Enter a custom conversion amount for each specific age. Maximum control. Amounts follow the Today's $ / Nominal $ toggle. Switch to Nominal $ to enter future dollar figures directly.", "$50k at 62, $40k at 63"],
      ]} />

      <H3>How the two Bracket Fill controls interact</H3>
      <P>
        There are two independent Bracket Fill controls: one for <em>withdrawals</em> and one
        for <em>Roth conversions</em>. They share the same bracket space each year.
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
        <li><strong>Conversion ceiling = Withdrawal ceiling</strong>: the conversion consumes all available bracket room; withdrawal bracket fill adds nothing extra from traditional. Use this when you want all pre-tax draws to be voluntary conversions (maximum Roth build-up).</li>
        <li><strong>Conversion ceiling &lt; Withdrawal ceiling</strong>: the conversion fills the lower band; the withdrawal bracket fill pulls more traditional to fill the rest. For example: conversions target the top of 12% ($100,800 MFJ), withdrawals target the top of 22% ($211,400 MFJ). Conversions cover the 10–12% band, withdrawals cover the 12–22% band for cash flow needs. This is the most common effective setup.</li>
      </ul>
      <Tip>
        Setting the conversion ceiling higher than the withdrawal ceiling is not allowed. The
        UI prevents it. If you lower the withdrawal ceiling, the conversion ceiling is
        automatically clamped down to match.
      </Tip>

      <H3>What-If Bar</H3>
      <P>
        Below the strategy panel, the What-If Bar has sliders that let you explore scenarios
        without changing your saved plan. Your actual inputs are untouched. The bar is a live
        overlay that the Plan Summary banner reflects in real time.
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Retire age slider(s)</strong>: shift your (or your spouse&apos;s) retirement age earlier or later.</li>
        <li><strong>Return rate</strong>: test how the plan holds up if portfolio growth is lower than expected.</li>
        <li><strong>Inflation</strong>: see what happens if prices rise faster than your base assumption.</li>
        <li><strong>Spending</strong>: scale all your expenses up or down by a percentage to find your spending floor or ceiling.</li>
      </ul>
      <P>
        When the bar is active, a warning color and "Active" label remind you that what you see
        is the overlay, not your saved plan. Click <strong>Reset</strong> in the What-If Bar to
        clear the overrides and return to your actual saved numbers.
      </P>
      <P>
        What-If Bar settings carry through to the Monte Carlo and Historical Sequences pages.
        When you run a simulation with the bar active, the simulation uses your slider values,
        not your saved plan, so stress-test scenarios run consistently across all pages.
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
        <li><strong>Portfolio Trajectory</strong>: a stacked area showing your Taxable, Pre-tax, and Roth balances growing and shrinking over time. Vertical dashed lines mark your retirement date, Social Security start, and RMD start at age 73.</li>
        <li><strong>Bucket Composition (%)</strong>: shows how the mix of your three account types shifts over time as a percentage of your total portfolio. Watch the Roth band grow if conversions are working.</li>
        <li><strong>Income Sources Over Time</strong>: a stacked area showing where your spending money comes from each year, including portfolio withdrawals, RMDs, Social Security, and other income streams.</li>
        <li><strong>Cash Flow at Age [X]</strong>: a flow diagram showing where money comes from and where it goes in a single year. Drag the age slider in the panel header to see any year in your plan.</li>
      </ul>

      <H3>Pinned Comparisons panel</H3>
      <P>
        At the bottom of the Dashboard, the Pinned Comparisons panel shows any scenarios you
        have saved from the What-If Bar side by side with your base plan. Key metrics including years funded, end balance, lifetime tax, and withdrawal rate are shown for each.
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
        What-If Bar appears here too. Use it to stress-test without touching your saved inputs.
      </P>

      <H3>Annual Cash Flows chart</H3>
      <P>
        Income bars rise above the center line. Spending and tax bars hang below it. In years
        where your income stack is taller than your spending and tax stack, you have a surplus
        and your portfolio is growing. When spending exceeds income, you are drawing down savings.
        That is completely normal once you have retired.
      </P>
      <P>
        The navy line on the right axis tracks your total portfolio value over time. If it trends
        toward zero before your Plan Through Age, the plan is underfunded and needs adjustments.
      </P>

      <H3>Column groups and visibility</H3>
      <P>
        Table columns are organized into five color-coded groups: <strong>Income</strong>,{' '}
        <strong>Withdrawals</strong>, <strong>Spending</strong>, <strong>Taxes</strong>, and{' '}
        <strong>Balances</strong>. Column headers stay pinned as you scroll in any direction, so
        you always know which group you are in.
      </P>
      <P>
        The toolbar above the table tells you how many columns are visible and how many are
        available. Click to toggle additional columns. The tax group includes detailed deduction
        columns you can show for deeper analysis.
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
        ["Effective Rate", "Federal tax as a percentage of income. A slowly rising rate is healthy. A sudden spike, usually in your mid-70s, signals RMDs forcing income into a higher bracket.", "14%"],
      ]} />
      <H3>Tax deduction waterfall columns (optional)</H3>
      <P>
        Four optional columns in the Taxes group show the full deduction waterfall before federal tax is calculated. Enable them from the column visibility toolbar:
      </P>
      <FieldTable rows={[
        ["MAGI", "Modified Adjusted Gross Income, the income total before any deductions are applied. This is the number used to determine ACA subsidy eligibility, IRMAA surcharge tiers, and the senior bonus phaseout.", "$195,000"],
        ["Std Deduct", "The base standard deduction (including the 65+ senior add-on if applicable), not counting the OBBBA senior bonus. This portion is inflation-indexed. Blank in years with no ordinary income or capital gains. A deduction only exists against income.", "$30,000"],
        ["Senior Bonus", "The temporary $6,000/person OBBBA above-the-line deduction for taxpayers 65 and older (tax years 2025–2028). Phases out as MAGI rises above $75K (Single) or $150K (MFJ). Shows $0 once the plan year is outside 2025–2028 or MAGI exceeds the phaseout ceiling.", "$12,000"],
        ["Taxable Inc", "Ordinary income after all deductions: MAGI minus standard deduction minus senior bonus. The federal tax brackets are applied to this number.", "$153,000"],
      ]} />
      <Tip>
        All four columns display in the same dollars mode as the rest of the table (Today&apos;s $ or Nominal $). Because the standard deduction and IRMAA thresholds are set in nominal law, switch to <strong>Nominal $</strong> view when verifying those numbers against IRS tables.
      </Tip>

      {/* ── Section 7: Tax Planning ──────────────────────────── */}
      <H2 id="s7">Tax Planning Page</H2>
      <P>
        Taxes are one of the largest costs in retirement, and one of the very few you can
        actively control. This page shows your tax picture in detail and helps you evaluate
        whether your Roth conversion strategy is paying off.
      </P>
      <P>
        Three tabs at the top right switch the view: <strong>Federal</strong>,{' '}
        <strong>State</strong>, and <strong>IRMAA</strong>.
      </P>

      <H3>Federal tab: your projected tax trajectory</H3>
      <P>
        Bars show tax dollars paid each year. The line shows your effective rate (tax as a
        percentage of income). A slowly rising effective rate is healthy, meaning income is
        growing while you stay in a manageable bracket. A sudden spike in your mid-70s usually
        means Required Minimum Distributions are pushing income into a higher bracket. That is a
        signal that Roth conversions before age 73 could help.
      </P>

      <H3>State tab</H3>
      <P>
        Shows your projected state income tax year by year. Different states have very different
        rules for retirement income. Some fully exempt Social Security and pension income; others
        tax everything. If your state tab shows significant taxes, it may be worth modeling a
        move to a lower-tax state using the State of Residence field on the Inputs page.
      </P>

      <H3>IRMAA tab: Medicare premium surcharges</H3>
      <P>
        If your income (specifically your MAGI, Modified Adjusted Gross Income) exceeds certain
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
        terms (after the standard deduction), so the ceiling alone does not guarantee you stay
        below an IRMAA tier. After building your plan, check the IRMAA tab to confirm your
        projected income stays below the dashed tier lines. Also note that Bracket Fill ceilings
        automatically step down from MFJ to Single values in the year your filing status changes,
        and survivor years are sized correctly without manual adjustment.
      </Tip>

      <H3>Roth Conversion comparison charts</H3>
      <P>
        Below the Federal tab view, two charts show whether your current conversion strategy is
        actually worth it:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Cumulative Tax — With vs. Without Conversions:</strong> Two running totals of lifetime federal tax paid. If the "With Conversions" line ends lower, you paid less tax overall despite paying some of it earlier. That is the goal of converting.</li>
        <li><strong>Portfolio Balance — With vs. Without Conversions:</strong> Two lines showing ending portfolio value over time. If "With Conversions" is higher at your Plan Through Age, the upfront tax paid resulted in greater after-tax wealth because of Roth&apos;s tax-free compounding.</li>
      </ul>

      {/* ── Section 8: Monte Carlo ───────────────────────────── */}
      <H2 id="s8">Monte Carlo Simulation</H2>
      <P>
        The Projections page answers "what happens if my return assumption is exactly right?"
        Monte Carlo asks a harder question: <em>how often does my plan survive across hundreds
        of different market histories?</em> Some of those histories include crashes at exactly
        the wrong moment. Some are boom periods. The simulation tests your plan against all of them.
      </P>

      <H3>How it works</H3>
      <P>
        The engine draws from real S&amp;P 500, Treasury, and CPI data going back to 1928. Each
        simulated future is built by randomly picking 3-year chunks of actual history and stitching
        them end-to-end until the sequence covers your full retirement. Using 3-year blocks rather than single years preserves short-run volatility clustering: crashes tend to bleed into
        the following year, and rallies often run for a few years. With 500 trials you get a
        realistic spread of outcomes from unlucky to fortunate.
      </P>
      <P>
        <strong>What this method cannot reproduce:</strong> multi-decade secular trends. The
        1966–1982 stagflation era lasted 16 consecutive years of near-zero real returns. Chopping
        it into 3-year blocks and mixing them with random other periods dilutes that sustained
        damage. As a result, bootstrap success rates tend to be somewhat optimistic for plans
        with long retirements, typically 20–30 years or more.
      </P>

      <H3>Running the simulation</H3>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.9, paddingLeft: 20, margin: '0 0 12px' }}>
        <li>
          <strong>▶ Run Simulation</strong>: runs Monte Carlo against your current saved plan.
          Takes 1–2 seconds. Run this first to get a baseline, and again any time you change
          simulation settings.
        </li>
        <li>
          <strong>Optimize for Robustness</strong>: tests your withdrawal strategy across 15
          different historical return sequences, picks the strategy that holds up best across all
          of them, then runs the full simulation. Takes 60–90 seconds. Use this when you want to
          squeeze out extra resilience. It is a fine-tuning step, not a fix for a plan that is
          fundamentally underfunded.
        </li>
      </ul>
      <Tip>
        Run the standard simulation first to establish your baseline. Use Optimize for Robustness
        only once you have a plan you broadly feel good about.
      </Tip>

      <H3>Robustness optimization: preview and apply</H3>
      <P>
        When Optimize for Robustness finishes, the result appears in <em>preview mode</em>. It
        does not automatically change your saved plan. A gold badge lets you know, and the fan
        chart updates to reflect the optimized strategy. You then have two choices:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.9, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Apply to Plan</strong>: permanently saves the new strategy. All other pages update to reflect it.</li>
        <li><strong>Discard</strong>: throws away the result and reverts to your original saved plan.</li>
      </ul>
      <P>
        The robustness optimizer typically scores slightly lower on the deterministic Projections
        page but meaningfully higher on Monte Carlo success rate, because it optimizes for bad
        sequences, not the average case. For most people, that trade-off is worth taking.
      </P>

      <H3>Simulation settings</H3>
      <P>
        If the What-If Bar is active when you click <strong>▶ Run Simulation</strong>, the
        simulation uses those slider values, not your saved plan. This lets you stress-test
        "what if I retire 2 years later?" or "what if returns are 4%?" without needing to
        change your inputs.
      </P>
      <FieldTable rows={[
        ["Equity Allocation %", "The stock/bond split applied inside each simulated year. Match this to your actual portfolio allocation. More stocks means more upside and more risk in bad years.", "60%"],
        ["Number of Trials", "How many simulated futures to run. 500 is fast and accurate enough for planning decisions. 2,000–5,000 gives smoother percentile bands at the cost of a longer wait. Maximum is 10,000.", "500"],
      ]} />

      <H3>How to read the success rate</H3>
      <FieldTable rows={[
        ["95%+", "Very strong. Your plan survives almost every realistic market history. You have a meaningful safety margin.", ""],
        ["90–95%", "Healthy. Only the worst handful of historical sequences cause problems. A common planning target.", ""],
        ["75–90%", "Worth watching. A meaningful number of scenarios end in shortfall. Consider retiring slightly later or trimming spending.", ""],
        ["50–75%", "Under pressure. More than a quarter of simulations run out of money. The plan needs meaningful changes.", ""],
        ["Below 50%", "At risk. More than half of simulated futures deplete the portfolio. Major structural changes required.", ""],
      ]} />

      <H3>Fan Chart: reading the bands</H3>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 12px' }}>
        <li><strong>Middle band (p25–p75)</strong>: the middle half of all outcomes. Half of all simulations land somewhere in this range.</li>
        <li><strong>Outer bands (p10–p25 and p75–p90)</strong>: more extreme outcomes in both directions.</li>
        <li><strong>Solid navy line</strong>: the median outcome. Half of simulations end above this, half below.</li>
        <li><strong>Red ribbon at the bottom</strong>: the fraction of simulations that have already run out of money by each age. If the ribbon appears before age 80, the plan is fragile to early-retirement bad luck, the most damaging kind.</li>
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
        <li><strong>Retiring 2–3 years later</strong> typically has the largest single impact. More contributions, fewer withdrawal years, and a higher Social Security benefit all compound together.</li>
        <li><strong>Reducing spending by 10%</strong> often moves the needle more than changing asset allocation or return assumptions.</li>
        <li><strong>Testing lower return assumptions</strong> shows how sensitive the plan is to market outcomes. If a 1% drop causes failure, build in more buffer before you retire.</li>
        <li><strong>Roth conversions</strong> will not dramatically shift success probability (they move tax timing, not total assets), but they can improve the 10th-percentile outcome by reducing tax drag when markets are already down.</li>
        <li><strong>Optimize for Robustness</strong>: if you are at 85–92% and want to push higher without changing your retirement date or spending, this often finds a withdrawal sequencing that gains a few more percentage points.</li>
      </ul>

      {/* ── Section 9: Historical Sequences ─────────────────── */}
      <H2 id="s9">Historical Sequence Analysis</H2>
      <P>
        This is a fundamentally different type of simulation from the bootstrap above, and the
        two answer different questions. Understanding both helps you know how confident to be in
        your plan.
      </P>

      <H3>How it works: rolling cohorts</H3>
      <P>
        The engine takes every calendar year from 1928 to 2023 and asks: "What would have happened
        to someone who retired in that year and followed this exact plan?" For a retiree starting
        in 1966, it applies the actual 1966 return, then the actual 1967 return, then 1968, and so
        on, following strict historical order with no randomization whatsoever.
      </P>
      <P>
        This is the same method used by tools like cFIREsim. Each start year is called a{' '}
        <em>retirement cohort</em>. The <strong>historical success rate</strong> is simply the
        share of cohorts whose portfolio lasted to your Plan Through Age.
      </P>
      <P>
        A cohort is marked as <strong>full coverage</strong> only when the historical record is
        long enough to cover your entire retirement window without running out of data. A retiree
        who started in 2010 with a 40-year plan would reach 2050, well beyond 2023, so that
        cohort has partial coverage and is excluded from the success rate calculation.
      </P>

      <H3>Why it is more conservative than bootstrap for long retirements</H3>
      <P>
        The 1966–1982 stagflation era ran 16 consecutive years of near-zero or negative real
        returns. In the bootstrap, that era gets chopped into 3-year blocks and mixed with random
        other periods. Any one simulation might get two of those stagflation blocks and then jump
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
        that cohort&apos;s portfolio survived to your Plan Through Age. Red means it ran out of money.
        Gray blocks have partial historical coverage and are not included in the success rate.
        Hover over any block to see the exact year and result.
      </P>
      <P>
        Clusters of red blocks reveal the dangerous eras: typically 1929–1932 (Great Depression),
        1965–1973 (stagflation onset), and sometimes 1999–2001 (dot-com bust). If red blocks
        appear outside those clusters, examine your plan. Moderate eras should not be causing
        failure.
      </P>

      <H3>How to read the trajectory chart</H3>
      <P>
        The gold fan shows the range of portfolio outcomes across full-coverage cohorts, with the same
        structure as the bootstrap fan chart. The thin red lines running through the fan are the
        individual trajectories of cohorts that eventually ran out of money. You can see both
        when depletion started and how steeply the portfolio fell.
      </P>
      <P>
        The median line reflects the cohort at the 50th percentile. Half of full-coverage
        cohorts ended with more, half with less.
      </P>

      <H3>Using bootstrap and historical sequences together</H3>
      <P>
        The two tools are complementary, not redundant. A useful planning posture:
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 12px' }}>
        <li>Use the <strong>bootstrap success rate</strong> as your primary probability estimate. It has 500 trials and gives a statistically stable read on your risk profile.</li>
        <li>Use the <strong>historical success rate</strong> as a stress-test floor. If the plan fails more than a handful of historical cohorts, it has a structural vulnerability to the kind of sustained bad decade that the bootstrap understates.</li>
        <li>If bootstrap and historical rates are close (within 5–8%), the plan is robust to both short volatility and long secular trends. If the gap is large, the plan relies on the future not producing a decade as bad as 1966–1982 or 1929–1933.</li>
      </ul>
      <Tip>
        A plan that passes both tests (bootstrap 90%+ and historical 85%+) is genuinely well
        constructed. A plan that passes bootstrap but fails many historical cohorts is telling you
        it would have struggled in the real world&apos;s worst decades, regardless of what a
        probabilistic model says.
      </Tip>

      <H3>Worst cohort end balance</H3>
      <P>
        This metric cards shows the real-dollar end balance of the single worst-performing
        full-coverage cohort. It is not the cohort that ran out earliest. It is the one that
        ended with the smallest (possibly negative) balance at your Plan Through Age. This is your
        absolute downside under actual historical conditions.
      </P>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 24px' }}>
        <li>If this number is positive, even the worst historical market environment left something in the portfolio.</li>
        <li>If it is deeply negative, the worst cohort ran out significantly before your Plan Through Age. Examine which year it was and what made it particularly damaging.</li>
      </ul>
    </div>
  );
}
