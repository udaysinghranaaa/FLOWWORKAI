export const plans = [
  {
    name: 'Starter',
    monthly: 19,
    description: 'A thoughtful place to start.',
    seats: 5,
    storage: '5 GB',
    ai: 'Example allowance: 10k tokens',
    features: ['Projects & task boards', 'Client-facing project preview', 'Team collaboration'],
  },
  {
    name: 'Growth',
    monthly: 49,
    description: 'More room for your best work.',
    seats: 20,
    storage: '25 GB',
    ai: 'Example allowance: 50k tokens',
    features: ['Everything in Starter', 'Support ticket workspace', 'Knowledge & FlowAI preview'],
  },
  {
    name: 'Business',
    monthly: 99,
    description: 'For an agency finding its stride.',
    seats: 50,
    storage: '100 GB',
    ai: 'Example allowance: 150k tokens',
    features: ['Everything in Growth', 'Expanded illustrative limits', 'Workspace analytics'],
  },
] as const
