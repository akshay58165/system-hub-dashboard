import { GitHubRepo, VercelProject, SupabaseProject, SystemEvent, Topic, TopicActivity, VideoRecord, Experiment, CreatorInsight } from './types';

export const initialSystemEvents: SystemEvent[] = [];
export const initialGitHubRepos: GitHubRepo[] = [];
export const initialVercelProjects: VercelProject[] = [];

export const initialSupabaseProject: SupabaseProject = {
  id: 'sub-proj-1',
  name: 'content-pipeline',
  status: 'active',
  region: 'default',
  dbVersion: 'Content Engine v1.0',
  tables: [],
  authUsers: [],
  apiLogs: [],
  metrics: {
    dbSize: '0 MB',
    activeConnections: 0,
    cpuUsage: 0,
    memoryUsage: 0,
  },
};

const infotainmentTopicSeeds: Array<Pick<Topic, 'name' | 'description' | 'channel' | 'status' | 'priority' | 'dueDate' | 'format' | 'category'>> = [
  { name: 'Why QR Codes Still Work When Damaged', description: 'A visual explanation of error correction and the hidden redundancy inside every QR code.', channel: 'LearnDriven', format: 'Short', category: 'Everyday Tech', status: 'topic', priority: 5, dueDate: '2026-07-03T18:30:00.000Z' },
  { name: 'How Autocomplete Guesses Your Next Word', description: 'Turn language-model prediction into a fast, relatable keyboard experiment.', channel: 'LearnDriven', format: 'Short', category: 'AI Explained', status: 'scripted', priority: 4, dueDate: '2026-07-06T18:30:00.000Z' },
  { name: "Why Airplane Mode Doesn't Turn Off GPS", description: 'Separate GPS reception from cellular transmission with a simple satellite analogy.', channel: 'LearnDriven', format: 'Short', category: 'Tech Myths', status: 'topic', priority: 3, dueDate: '2026-07-08T18:30:00.000Z' },
  { name: 'What Clearing Your Browser Cache Actually Does', description: 'Show cached assets, stale files, and why clearing them fixes mysteriously broken websites.', channel: 'LearnDriven', format: 'Short', category: 'Web Basics', status: 'shot', priority: 4, dueDate: '2026-07-10T18:30:00.000Z' },
  { name: 'How Passwords Are Checked Without Being Stored', description: 'Explain hashing and salting through a one-way kitchen-recipe analogy.', channel: 'LearnDriven', format: 'Short', category: 'Cybersecurity', status: 'edited', priority: 5, dueDate: '2026-07-12T18:30:00.000Z' },
  { name: 'Why Your Phone Gets Hot During Video Calls', description: 'Connect camera processing, encoding, networking, and battery load in under a minute.', channel: 'LearnDriven', format: 'Short', category: 'Device Science', status: 'topic', priority: 2, dueDate: '2026-07-15T18:30:00.000Z' },
  { name: 'How Maps Know There Is a Traffic Jam', description: 'Reveal how anonymous phone movement becomes a live traffic map.', channel: 'LearnDriven', format: 'Short', category: 'Data Systems', status: 'scripted', priority: 4, dueDate: '2026-07-17T18:30:00.000Z' },
  { name: 'What Incognito Mode Actually Hides', description: 'A myth-busting breakdown of local history, networks, websites, and tracking.', channel: 'LearnDriven', format: 'Short', category: 'Privacy', status: 'topic', priority: 5, dueDate: '2026-07-19T18:30:00.000Z' },
  { name: 'Why USB-C Works Both Ways Up', description: 'Use mirrored pins to explain reversible connectors without heavy electronics jargon.', channel: 'LearnDriven', format: 'Short', category: 'Hardware', status: 'scheduled', priority: 3, dueDate: '2026-07-21T18:30:00.000Z' },
  { name: 'How Spam Filters Spot Scam Emails', description: 'Show the signals and probability checks that separate an inbox message from spam.', channel: 'LearnDriven', format: 'Short', category: 'AI Explained', status: 'topic', priority: 3, dueDate: '2026-07-23T18:30:00.000Z' },
  { name: 'The First 100ms After You Tap a Link', description: 'A rapid DNS-to-render journey through the invisible work behind opening a webpage.', channel: 'LearnDriven', format: 'Short', category: 'Internet', status: 'shot', priority: 5, dueDate: '2026-07-25T18:30:00.000Z' },
  { name: 'Inside a Password Manager', description: 'A practical deep dive into vault encryption, autofill, sync, and recovery tradeoffs.', channel: 'LearnDriven', format: 'Long', category: 'Cybersecurity', status: 'scripted', priority: 5, dueDate: '2026-07-14T18:30:00.000Z' },
  { name: 'How Recommendation Engines Learn Your Taste', description: 'Build an intuitive model of embeddings, ranking, feedback loops, and exploration.', channel: 'LearnDriven', format: 'Long', category: 'AI Explained', status: 'topic', priority: 4, dueDate: '2026-07-27T18:30:00.000Z' },
  { name: 'The Journey of a Photo to the Cloud', description: 'Trace compression, upload chunks, object storage, replication, and delivery.', channel: 'LearnDriven', format: 'Long', category: 'Cloud Computing', status: 'edited', priority: 3, dueDate: '2026-07-29T18:30:00.000Z' },
  { name: 'Build a Tiny Search Engine From Scratch', description: 'Members workshop covering crawling, indexing, scoring, and a usable search interface.', channel: 'LearnDriven', format: 'Members', category: 'Build Workshop', status: 'topic', priority: 4, dueDate: null },

  { name: 'Why Netflix Changes the Thumbnail You See', description: 'Expose the quiet personalization experiment happening on every streaming homepage.', channel: 'DecodeWorthy', format: 'Short', category: 'Algorithm Stories', status: 'scripted', priority: 5, dueDate: '2026-07-04T18:30:00.000Z' },
  { name: 'How CAPTCHA Knows You Are Human', description: 'Turn cursor movement, browser signals, and risk scoring into a visual detective story.', channel: 'DecodeWorthy', format: 'Short', category: 'Internet Mysteries', status: 'topic', priority: 4, dueDate: '2026-07-07T18:30:00.000Z' },
  { name: 'The Internet Runs Through Underwater Cables', description: 'Follow one message across oceans through fiber thinner than a garden hose.', channel: 'DecodeWorthy', format: 'Short', category: 'Hidden Infrastructure', status: 'shot', priority: 5, dueDate: '2026-07-09T18:30:00.000Z' },
  { name: 'How Your Phone Hears “Hey Google”', description: 'Explain always-listening wake-word chips without implying constant cloud recording.', channel: 'DecodeWorthy', format: 'Short', category: 'AI Explained', status: 'topic', priority: 5, dueDate: '2026-07-11T18:30:00.000Z' },
  { name: 'How WhatsApp Shows “Typing…” Instantly', description: 'A tiny status event travels through a massive distributed messaging system.', channel: 'DecodeWorthy', format: 'Short', category: 'System Design', status: 'scheduled', priority: 4, dueDate: '2026-07-13T18:30:00.000Z' },
  { name: 'The Algorithm Inside an Elevator', description: 'Why elevators do not simply serve requests in the order buttons are pressed.', channel: 'DecodeWorthy', format: 'Short', category: 'Everyday Algorithms', status: 'topic', priority: 3, dueDate: '2026-07-16T18:30:00.000Z' },
  { name: 'How an ATM Counts Cash Without Seeing It', description: 'Rollers, optical sensors, thickness checks, and rejection paths in one visual sequence.', channel: 'DecodeWorthy', format: 'Short', category: 'Machine Stories', status: 'scripted', priority: 3, dueDate: '2026-07-18T18:30:00.000Z' },
  { name: 'Why Barcodes Need a Quiet Zone', description: 'Decode guard bars, spacing, checksums, and the blank margin scanners depend on.', channel: 'DecodeWorthy', format: 'Short', category: 'Hidden Design', status: 'topic', priority: 2, dueDate: '2026-07-20T18:30:00.000Z' },
  { name: 'Why Digital Clocks Slowly Drift', description: 'A crystal oscillator story about tiny timing errors accumulating into visible minutes.', channel: 'DecodeWorthy', format: 'Short', category: 'Device Science', status: 'edited', priority: 3, dueDate: '2026-07-22T18:30:00.000Z' },
  { name: 'How Wi-Fi Works Inside an Airplane', description: 'Compare satellite and air-to-ground links while following one passenger request.', channel: 'DecodeWorthy', format: 'Short', category: 'Hidden Infrastructure', status: 'topic', priority: 4, dueDate: '2026-07-24T18:30:00.000Z' },
  { name: 'How Traffic Lights Synchronize a City', description: 'Show timing plans, road sensors, control rooms, and adaptive intersections.', channel: 'DecodeWorthy', format: 'Short', category: 'Smart Cities', status: 'shot', priority: 4, dueDate: '2026-07-26T18:30:00.000Z' },
  { name: 'What Happens Inside One Google Search', description: 'A cinematic journey through routing, indexing, ranking, and distributed result serving.', channel: 'DecodeWorthy', format: 'Long', category: 'System Design', status: 'scripted', priority: 5, dueDate: '2026-07-28T18:30:00.000Z' },
  { name: 'Inside a Global Live Sports Stream', description: 'How cameras, encoders, regional edges, and adaptive bitrate keep millions synchronized.', channel: 'DecodeWorthy', format: 'Long', category: 'Streaming Systems', status: 'topic', priority: 5, dueDate: '2026-07-30T18:30:00.000Z' },
  { name: 'How the Cloud Survives a Server Failure', description: 'A story-led explanation of health checks, replicas, failover, and eventual recovery.', channel: 'DecodeWorthy', format: 'Long', category: 'Cloud Computing', status: 'topic', priority: 4, dueDate: null },
  { name: 'Inside the Recommendation War for Your Attention', description: 'Members deep dive comparing ranking objectives, feedback loops, and creator incentives.', channel: 'DecodeWorthy', format: 'Members', category: 'Platform Economics', status: 'topic', priority: 4, dueDate: null },
];

export const initialTopics: Topic[] = infotainmentTopicSeeds.map((topic, index) => ({
  ...topic,
  id: `t-manual-demo-infotainment-${String(index + 1).padStart(2, '0')}`,
  createdDate: '2026-07-01T00:00:00.000Z',
  lastUpdated: '2026-07-01T00:00:00.000Z',
  revenueLevel: topic.format === 'Members' ? 'High Revenue' : topic.format === 'Long' ? 'Medium Revenue' : 'Discovery',
  isDemo: true,
}));
export const initialActivities: TopicActivity[] = [];

// Clean datasets: no fabricated or placeholder data. Everything is populated live via APIs or User Input.
export const initialVideos: VideoRecord[] = [];
export const initialExperiments: Experiment[] = [];
export const initialCreatorInsights: CreatorInsight[] = [];
