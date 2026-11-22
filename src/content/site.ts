/**
 * PROJECT AETHER — personal content.
 *
 * Edit this file to update the portfolio. Everything here is written from what
 * Adil has stated about himself; nothing is invented. Projects and contribution
 * history are NOT typed in here: they sync automatically from GitHub
 * (see scripts/sync-github.ts and public/data/github.json).
 */

export interface ContactLink {
  label: string;
  href: string;
  handle: string;
}

export const site = {
  name: 'Adil Akhtab Abir',
  firstName: 'Abir',
  monogram: 'A·A·A',
  /** The GitHub account the Launch Archive and Selected Work read from. */
  githubUsername: 'Muhammad-Adil-Abir',
  role: 'IT Student · Builder',
  /** Where this project's source lives (the profile repository). */
  sourceUrl: 'https://github.com/Muhammad-Adil-Abir/Muhammad-Adil-Abir',

  arrival: {
    kicker: 'Welcome to',
    title: "Abir's World.",
    supporting: 'A world built on curiosity, code, and possibility.',
    tagline: 'Some people launch missiles. I launch ideas.',
  },

  manifesto: {
    lead: "I'm Adil Akhtab Abir — an IT student building toward production-grade software.",
    body: [
      'Websites, applications, automation systems and AI agents: the long-term mission is to build software people can depend on, from the first commit to large systems running in production.',
      'This universe is the working record of that mission. Every repository is a launch, every contribution a data point on the trajectory.',
    ],
  },

  /** Engineering principles, in Adil's own priorities. */
  principles: [
    { title: 'Accuracy', text: 'No invented APIs, numbers or facts. Verify first, then build.' },
    { title: 'Reliability', text: 'Tests, type checks and a passing build before anything is called done.' },
    { title: 'Security', text: 'Secrets stay out of code. Protections stay switched on.' },
    { title: 'Maintainability', text: 'Modular, readable code the next engineer can trust and extend.' },
  ],

  disciplines: [
    {
      code: 'D-01',
      title: 'Web & Application Engineering',
      text: 'Interfaces and full-stack applications built for real people: responsive, accessible and fast on every screen.',
    },
    {
      code: 'D-02',
      title: 'Automation Systems',
      text: 'Workflows with clear inputs and outputs, careful retries and honest logs — automation that is safe to leave running.',
    },
    {
      code: 'D-03',
      title: 'AI Agents',
      text: 'Agents with guardrails: scoped permissions, human approval for anything destructive, no uncontrolled autonomy.',
    },
    {
      code: 'D-04',
      title: 'Software Architecture',
      text: 'Plan before implementation — requirements, dependencies and risks mapped into milestones that ship one by one.',
    },
  ],

  /**
   * Optional curation for "Selected Work". Leave empty to show pinned repositories
   * (then the most recently pushed ones). List repository names to choose the order yourself.
   */
  featuredRepos: [] as string[],

  /**
   * Contact channels. Only GitHub is filled in; add others when you want them public.
   * Example: { label: 'Email', href: 'mailto:you@example.com', handle: 'you@example.com' }
   */
  contact: [
    { label: 'GitHub', href: 'https://github.com/Muhammad-Adil-Abir', handle: '@Muhammad-Adil-Abir' },
  ] as ContactLink[],

  /** README banner: a black hole whose accretion disk holds one particle per day. 'ember' or 'cobalt'. */
  singularity: { palette: 'ember' as 'ember' | 'cobalt' },

  finale: {
    lines: ['Every ending', 'is a new beginning.'],
    coda: 'The work is never done.',
    signature: '— Adil Akhtab Abir',
    thanks: 'Thank you for stepping into my world.',
  },
} as const;
