export interface HelpSection {
  heading: string;
  paras: string[];
}

export interface HelpTopic {
  eyebrow: string;
  title: string;
  sections: HelpSection[];
}

export const MC_SIMULATE_HELP: HelpTopic = {
  eyebrow: 'Learn more',
  title: 'What the simulation does',
  sections: [
    {
      heading: 'The idea behind it',
      paras: [
        'How well your plan works depends on what the markets do over the next few decades. Nobody can know that in advance.',
        'This tool runs your entire plan thousands of times over. Each run uses a different sequence of market ups and downs, drawn from real market history going back to 1928.',
        'Every run is one possible future for you. In some of them the markets are generous in your early years and your savings build up. In others a crash lands right after you retire, which is the hardest kind of timing to recover from.',
      ],
    },
    {
      heading: 'How the market histories are built',
      paras: [
        'Each future is stitched together from three-year blocks of real S&P 500 and Treasury returns, drawn at random from 1928 through 2023 and mixed to your stock and bond split.',
        'Keeping whole three-year blocks holds on to the way good and bad years cluster together. Long stretches such as the sixteen lean years from 1966 to 1982 get broken into pieces and spread around, so a slump that deep shows up rarely.',
        'That makes this page a little kind to very long retirements. The historical cohort chart further down the page runs the years in their real order and gives you the stricter read.',
      ],
    },
    {
      heading: 'Why this reads higher than the Dashboard',
      paras: [
        'The Dashboard grows your money by one fixed return every year, taken from your own assumptions, and gives you the same answer each time you open it. That figure is set on the cautious side.',
        'Real market history has averaged closer to 8% a year for a stock-heavy mix, so success rates here normally come out above the Dashboard number.',
        'Use the Dashboard as your planning baseline and this page for the range of luck around it.',
      ],
    },
    {
      heading: 'What the numbers tell you',
      paras: [
        'Probability of success is the share of runs in which your money lasted all the way to your plan-to age. A reading of 90% means your money held up in 9 out of every 10 futures that were tested.',
        'The fan chart shows the whole spread of results. The middle line is the typical outcome. The outer edges show the lucky and the unlucky ends of the range.',
        'The four historical cohort cards test something different. They run your plan through four specific bad stretches that really happened, such as retiring right before the 1929 crash.',
      ],
    },
    {
      heading: 'The two settings',
      paras: [
        'Equity % is how much of your portfolio sits in stocks. Stocks tend to grow more over long stretches of time. They also move up and down more from one year to the next. Whatever is left over goes into bonds.',
        'Trials is how many futures to test. 5,000 gives you a steady answer. A higher number settles the answer down a little further and takes slightly longer to finish.',
      ],
    },
    {
      heading: 'How to use it',
      paras: [
        'Run it once to see where your plan stands today. Then change one thing, such as your retirement age or your yearly spending, and run it again.',
        'Watching how far the success number moves each time tells you which decisions actually matter for your situation.',
      ],
    },
  ],
};

export const MC_OPTIMIZE_HELP: HelpTopic = {
  eyebrow: 'Learn more',
  title: 'What the optimizer does',
  sections: [
    {
      heading: 'What it is deciding for you',
      paras: [
        'Your plan makes two choices that you can tune. The first is which accounts you take money out of, and in what order. The second is how much you move from your traditional accounts into your Roth each year.',
        'Both choices change the taxes you pay over your lifetime, and your tax bill changes how long your money lasts.',
        'The optimizer searches through a very large number of combinations of those two choices. It keeps the combination that holds up best across all the market futures from your simulation.',
      ],
    },
    {
      heading: 'How it weighs a bad run of markets',
      paras: [
        'The optimizer scores a candidate strategy by running it through 32 simulated market histories. Half the score comes from the average across all of them, and half from the worst quarter alone.',
        'That second half is what makes it a robustness run. A strategy that does well on average and falls apart in the worst quarter scores badly.',
      ],
    },
    {
      heading: 'Why it sometimes finds nothing',
      paras: [
        'Withdrawal order and Roth conversions are tax levers. They change what you keep, and on many plans they change it by a few percent. Whether your money lasts is driven far more by your spending, your retirement age, and your stock and bond mix.',
        'So on a lot of plans the tuned strategy scores the same as the one you already have. When that happens this page says so and offers you nothing to apply, rather than dressing up a rounding error as an improvement.',
        'A result only counts as an improvement here when it beats your current strategy by more than a full percentage point, which is the simulation\u2019s own margin of error at 5,000 trials.',
      ],
    },
    {
      heading: 'Why it waits for a simulation',
      paras: [
        'The optimizer scores every candidate strategy against the exact same set of market futures your last simulation used. That keeps the before and after comparison fair.',
        'This is why it stays locked until you have run a simulation, and why changing a setting asks you to run the simulation once more.',
      ],
    },
    {
      heading: 'Applying the result',
      paras: [
        'The search takes about 20 seconds. When it finishes, a strip inside the Optimize section shows the outcome.',
        'A green strip means the tuned strategy beats your current one by more than a full percentage point. A gold bar appears at the bottom of the panel with two choices: Apply to Plan (saves the new strategy permanently, replacing your current withdrawal order and Roth conversions) or Discard (clears the preview and leaves your plan exactly as it was).',
        'A grey strip means the improvement was smaller than one percentage point, which is the margin of error for 5,000 trials. Nothing is offered to apply.',
        'Once applied, the Dashboard labels the plan "Monte Carlo tuned" so you can always see where the saved strategy came from.',
      ],
    },
  ],
};
