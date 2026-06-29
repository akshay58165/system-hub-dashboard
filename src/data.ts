import { GitHubRepo, VercelProject, SupabaseProject, SystemEvent, SupabaseTable, Topic, TopicActivity } from './types';

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

// SQL parser simulation for the interactive query console
export function runSqlSimulation(sql: string, tables: SupabaseTable[]): { success: boolean; message: string; rows?: Record<string, any>[]; columns?: string[] } {
  const cleanSql = sql.trim().replace(/;$/, '').toLowerCase();
  
  if (cleanSql.startsWith('select')) {
    const match = sql.match(/from\s+([a-zA-Z0-9_]+)/i);
    if (!match) {
      return { success: false, message: 'SQL Error: Syntax error or unsupported SELECT. Provide "FROM <table_name>".' };
    }
    const tableName = match[1].toLowerCase();
    const table = tables.find(t => t.name.toLowerCase() === tableName);
    if (!table) {
      return { success: false, message: `SQL Error: relation "${tableName}" does not exist` };
    }
    
    let resultRows = [...table.rows];
    
    const whereMatch = sql.match(/where\s+(.+)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1].toLowerCase();
      if (whereClause.includes('status')) {
        const statusMatch = whereClause.match(/status\s*=\s*['"](.+)['"]/i);
        if (statusMatch) {
          const status = statusMatch[1];
          resultRows = resultRows.filter(r => r.status && r.status.toLowerCase() === status.toLowerCase());
        }
      } else if (whereClause.includes('channel')) {
        const channelMatch = whereClause.match(/channel\s*=\s*['"](.+)['"]/i);
        if (channelMatch) {
          const channel = channelMatch[1];
          resultRows = resultRows.filter(r => r.channel && r.channel.toLowerCase() === channel.toLowerCase());
        }
      }
    }
    
    const columns = table.columns.map(c => c.name);
    return {
      success: true,
      message: `Success: SELECT returned ${resultRows.length} rows from "${table.name}".`,
      rows: resultRows,
      columns,
    };
  }
  
  if (cleanSql.startsWith('insert')) {
    const match = sql.match(/into\s+([a-zA-Z0-9_]+)/i);
    if (!match) {
      return { success: false, message: 'SQL Error: Syntax error in INSERT statement.' };
    }
    const tableName = match[1].toLowerCase();
    const table = tables.find(t => t.name.toLowerCase() === tableName);
    if (!table) {
      return { success: false, message: `SQL Error: relation "${tableName}" does not exist` };
    }
    
    return {
      success: true,
      message: `Row simulated successfully! Use the Table Editor to write persistent rows, or execute 'SELECT * FROM ${table.name}' to see current items.`,
    };
  }
  
  return {
    success: false,
    message: 'SQL execution error: Only SELECT statements are fully supported in the query console. Use SELECT queries or the interactive Table Editor.',
  };
}

// Generate exactly 100 topics (50 LearnDriven, 50 DecodeWorthy)
const generateSampleData = () => {
  const topicsList: Topic[] = [];
  const activitiesList: TopicActivity[] = [];
  
  const now = Date.now();
  const day = 86400000;
  
  const statuses: ('topic' | 'scripted' | 'shot' | 'edited' | 'scheduled')[] = [
    'topic', 'scripted', 'shot', 'edited', 'scheduled'
  ];
  
  // 50 LearnDriven Topics
  const ldTitles = [
    "TypeScript Masterclass: From Beginner to Advanced",
    "React 19 Server Components Explained",
    "Next.js App Router Deep Dive",
    "How to Write Clean Code in JavaScript",
    "Tailwind CSS Layout Tricks",
    "Understanding the Event Loop in Node.js",
    "Drizzle ORM vs Prisma: The Ultimate Showdown",
    "Building APIs with Fastify and Node",
    "Introduction to Docker for Web Developers",
    "Git Branching Strategies that Actually Work",
    "CSS Grid vs Flexbox: Real-World Use Cases",
    "Testing React Apps with Vitest & Testing Library",
    "How to Optimize Core Web Vitals",
    "State Management in React: Zustand vs Redux",
    "Monorepos with Turborepo: A Complete Guide",
    "Building a CLI Tool with Node.js",
    "Understanding JWT & Session Authentication",
    "Introduction to GraphQL & Apollo",
    "Deploying Next.js to Vercel and AWS",
    "How DNS Works: Under the Hood",
    "Web Accessibility (a11y) for Frontend Devs",
    "Using WebSockets for Real-Time Apps",
    "Database Indexing Basics for Developers",
    "How to use TypeScript Utility Types",
    "Python Basics for JS Developers",
    "Understanding REST API Best Practices",
    "Responsive Design with Container Queries",
    "Intro to Data Structures in JavaScript",
    "How HTTPS Keeps the Web Secure",
    "Debugging JavaScript Like a Pro",
    "Creating Chrome Extensions from Scratch",
    "Astro Framework: Static Site Mastery",
    "Functional Programming in JS/TS",
    "Understanding CSS Custom Properties",
    "Testing Node.js APIs with Supertest",
    "How Browser Engines Render Web Pages",
    "Managing Environment Variables Safely",
    "Building a Component Library with Radix UI",
    "Intro to PostgreSQL for Web Devs",
    "Web Performance Checklist for 2026",
    "Regular Expressions: The Developer Guide",
    "Getting Started with Bun Runtime",
    "Effective Code Review Guidelines",
    "Designing Scalable Database Schemas",
    "How to Deploy Apps using Docker Compose",
    "CSS Subgrid & Modern Layouts",
    "TypeScript Generics Made Simple",
    "Working with Server-Sent Events (SSE)",
    "Understanding OAuth 2.0 Flow",
    "Building Microservices with Node.js"
  ];

  // 50 DecodeWorthy Topics
  const dwTitles = [
    "How Google Search Indexing Works Behind the Scenes",
    "The Architecture of YouTube Video Transcoding",
    "Why Apple Silicon (M1/M2/M3) is So Efficient",
    "How Spotify discover Weekly Recommends Music",
    "The Evolution of Video Codecs: H.264 to AV1",
    "How Git Stores Code Internally: DAG and Blobs",
    "How the Linux Kernel Boots Up",
    "How WhatsApp Handles 100 Billion Messages Daily",
    "Inside SSDs: The Physics of Flash Storage",
    "Blockchain Explained Without the Crypto Hype",
    "How Netflix Serves 250M Users Without Crashing",
    "The Math Behind Generative AI Image Models",
    "How CPUs Execute Code: Pipelining & Branch Prediction",
    "TCP vs UDP: Why Multiplayer Games Use UDP",
    "How Uber Computes Fares in Real-Time",
    "Inside Chrome V8 Engine: Ignition and TurboFan",
    "Will Quantum Computing Break RSA Encryption?",
    "How Cloudflare Stops Massive DDoS Attacks",
    "How Shazam Identifies Songs in Seconds",
    "The Engineering Behind Tesla Autopilot",
    "How Transformers & GPT Generate Text",
    "Why Relational Databases Use B-Trees",
    "How Instagram Scaled to Billions of Photos",
    "Wi-Fi 7 Explained: What's New?",
    "How GPS & Google Maps Route You Instantly",
    "The Physics of Display Tech: OLED vs MicroLED",
    "How Zoom Delivers Low-Latency Video Calls",
    "Inside LLVM: How Modern Compilers Work",
    "How PayPal Detects Fraud Instantly",
    "The Architecture of Modern Game Engines",
    "How 5G Technology Works: Beamforming & Millimeter Waves",
    "Why Unicode and Emojis are Hard to Implement",
    "How Stripe Processes Credit Cards Securely",
    "The Engineering Behind Figma's Collaborative Editor",
    "How Facial Recognition Systems Work",
    "Inside Docker: Namespaces & Cgroups",
    "How Starlink Satellite Internet Operates",
    "Why Rust is Replacing C++ for Systems Programming",
    "How NVMe SSDs Achieve Insane Speeds",
    "How Active Noise Cancellation (ANC) Works",
    "How Slack Reengineered its Desktop Client",
    "How Github Copilot Suggests Code",
    "The Science of Fast-Charging Lithium Batteries",
    "How Content Delivery Networks (CDNs) Cache Data",
    "Ray Tracing vs Rasterization in Modern GPUs",
    "How Password Managers Secure Your Vault",
    "The Architecture of Twitter's Timeline System",
    "How Capacitive Touchscreens Detect Input",
    "Why ARM is Threatening x86 Dominance",
    "The Engineering Behind the James Webb Space Telescope"
  ];

  const authors = ['akshay', 'system', 'content-bot'];

  const addChannelTopics = (titles: string[], channel: 'LearnDriven' | 'DecodeWorthy') => {
    titles.forEach((title, index) => {
      // Rotate status evenly (10 topics per status for each channel)
      const status = statuses[index % 5];
      // Generate priority 1-5
      const priority = ((index % 5) + 1) as 1 | 2 | 3 | 4 | 5;
      
      // Calculate createdDate going back up to 30 days
      const daysAgo = 30 - Math.floor(index / 1.7);
      const createdDate = new Date(now - daysAgo * day).toISOString();
      const lastUpdated = new Date(now - Math.max(0, daysAgo - 2) * day).toISOString();
      
      // Calculate dueDate if scheduled (index % 5 === 4)
      const dueDate = status === 'scheduled' 
        ? new Date(now + ((index % 10) + 1) * day).toISOString() 
        : null;

      const prefix = channel === 'LearnDriven' ? 'ld' : 'dw';
      const id = `t-${prefix}-${String(index + 1).padStart(3, '0')}`;
      
      const topic: Topic = {
        id,
        name: title,
        description: `Deep dive resource and roadmap covering the core concepts of "${title}". Built for educational pipeline updates.`,
        channel,
        status,
        priority,
        dueDate,
        createdDate,
        lastUpdated
      };

      topicsList.push(topic);

      // Generate activity logs based on status
      const statusFlow = ['topic', 'scripted', 'shot', 'edited', 'scheduled'];
      const currentIdx = statusFlow.indexOf(status);
      
      for (let i = 0; i <= currentIdx; i++) {
        const activityTime = new Date(new Date(createdDate).getTime() + i * 2 * day).toISOString();
        if (new Date(activityTime).getTime() <= now) {
          if (i === 0) {
            activitiesList.push({
              id: `act-${id}-init`,
              topicName: title,
              channel,
              action: `Topic "${title}" was added to the backlog pipeline.`,
              author: authors[index % authors.length],
              timestamp: activityTime
            });
          } else {
            activitiesList.push({
              id: `act-${id}-${statusFlow[i]}`,
              topicName: title,
              channel,
              action: `Moved status from "${statusFlow[i-1]}" to "${statusFlow[i]}".`,
              author: authors[index % authors.length],
              timestamp: activityTime
            });
          }
        }
      }
    });
  };

  addChannelTopics(ldTitles, 'LearnDriven');
  addChannelTopics(dwTitles, 'DecodeWorthy');
  
  // Sort activities by timestamp descending
  activitiesList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  return { topics: topicsList, activities: activitiesList };
};

const generated = generateSampleData();

export const initialTopics: Topic[] = generated.topics;
export const initialActivities: TopicActivity[] = generated.activities;
