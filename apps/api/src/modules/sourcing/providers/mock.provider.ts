import type { SourcingProvider, RawCandidate } from './provider.interface';

const MOCK_CANDIDATES: RawCandidate[] = [
    {
        name: 'Alex Chen',
        linkedinUrl: 'https://www.linkedin.com/in/alex-chen-dev',
        headline: 'Senior Node.js Engineer | 8 years building scalable APIs',
        summary:
            'Experienced backend engineer specializing in Node.js, Express, and MongoDB. Built microservices serving 10M+ requests/day.',
        skills: ['Node.js', 'TypeScript', 'MongoDB', 'Redis', 'Docker', 'AWS', 'Express'],
        experience: '8 years',
        location: 'San Francisco, CA',
        email: 'alex.chen@example.com',
    },
    {
        name: 'Priya Sharma',
        linkedinUrl: 'https://www.linkedin.com/in/priya-sharma-fullstack',
        headline: 'Full Stack MERN Developer | React + Node.js | Remote',
        summary:
            'Full-stack developer with deep expertise in the MERN stack. Passionate about clean code, CI/CD, and developer experience.',
        skills: ['React', 'Node.js', 'MongoDB', 'Express', 'TypeScript', 'GraphQL', 'Jest'],
        experience: '5 years',
        location: 'Remote',
    },
    {
        name: 'Marcus Johnson',
        linkedinUrl: 'https://www.linkedin.com/in/marcus-johnson-backend',
        headline: 'Lead Backend Engineer | Node.js | Distributed Systems',
        summary:
            'Lead engineer with experience architecting distributed systems. Strong in BullMQ, Redis, and event-driven architectures.',
        skills: ['Node.js', 'Redis', 'BullMQ', 'Kafka', 'PostgreSQL', 'MongoDB', 'Kubernetes'],
        experience: '10 years',
        location: 'Austin, TX',
    },
    {
        name: 'Sarah Kim',
        linkedinUrl: 'https://www.linkedin.com/in/sarah-kim-engineer',
        headline: 'Software Engineer | React | TypeScript | Open to Remote',
        summary:
            'Frontend-leaning full-stack developer. Loves React, TypeScript, and building accessible, performant UIs.',
        skills: ['React', 'TypeScript', 'Next.js', 'Node.js', 'CSS', 'GraphQL'],
        experience: '4 years',
        location: 'Seattle, WA',
    },
    {
        name: 'David Okonkwo',
        linkedinUrl: 'https://www.linkedin.com/in/david-okonkwo-dev',
        headline: 'Senior Software Engineer | MongoDB | AWS | Node.js',
        summary:
            'Backend specialist with cloud-native architecture experience. AWS certified. MongoDB expert with aggregation pipeline optimization skills.',
        skills: ['Node.js', 'AWS', 'MongoDB', 'Terraform', 'Docker', 'Lambda', 'DynamoDB'],
        experience: '7 years',
        location: 'Lagos, Nigeria (Remote)',
    },
    {
        name: 'Emma Wilson',
        linkedinUrl: 'https://www.linkedin.com/in/emma-wilson-fullstack',
        headline: 'MERN Stack Developer | Startup Experience | Remote',
        summary:
            'Experienced MERN developer who has built products from 0 to 1 in fast-moving startup environments.',
        skills: ['MongoDB', 'Express', 'React', 'Node.js', 'Docker', 'CI/CD'],
        experience: '3 years',
        location: 'London, UK (Remote)',
    },
    {
        name: 'Jason Park',
        linkedinUrl: 'https://www.linkedin.com/in/jason-park-node',
        headline: 'Node.js Developer | REST & GraphQL APIs | TypeScript',
        summary:
            'API developer focused on building reliable, well-documented REST and GraphQL APIs. Strong testing discipline.',
        skills: ['Node.js', 'TypeScript', 'GraphQL', 'REST', 'PostgreSQL', 'Jest', 'OpenAPI'],
        experience: '4 years',
        location: 'Toronto, Canada',
    },
    {
        name: 'Fatima Al-Hassan',
        linkedinUrl: 'https://www.linkedin.com/in/fatima-alhassan-engineer',
        headline: 'Backend Engineer | Python & Node.js | ML Integration',
        summary:
            'Polyglot backend engineer who bridges traditional API development with ML model serving.',
        skills: ['Python', 'Node.js', 'FastAPI', 'MongoDB', 'Redis', 'Docker', 'TensorFlow'],
        experience: '5 years',
        location: 'Dubai, UAE',
    },
    {
        name: 'Ryan Torres',
        linkedinUrl: 'https://www.linkedin.com/in/ryan-torres-dev',
        headline: 'Junior Developer | React | Node.js | Learning every day',
        summary:
            'Junior developer eager to grow. Completed bootcamp, built several full-stack projects using the MERN stack.',
        skills: ['React', 'Node.js', 'MongoDB', 'JavaScript', 'HTML/CSS'],
        experience: '1 year',
        location: 'Miami, FL',
    },
    {
        name: 'Li Wei',
        linkedinUrl: 'https://www.linkedin.com/in/li-wei-architect',
        headline: 'Principal Engineer | System Architecture | Node.js at Scale',
        summary:
            'Principal engineer with 12 years building high-scale distributed systems. Led teams of 15+ engineers.',
        skills: ['Node.js', 'System Design', 'Redis', 'Kafka', 'MongoDB', 'Kubernetes', 'Go'],
        experience: '12 years',
        location: 'Singapore (Remote)',
    },
];

export const mockProvider: SourcingProvider = {
    name: 'mock',
    search: async (query: string, limit: number): Promise<RawCandidate[]> => {
        await new Promise(resolve => setTimeout(resolve, 500));

        const keywords = query.toLowerCase().split(' ');
        const scored = MOCK_CANDIDATES.map(c => {
            const text = `${c.headline} ${c.skills.join(' ')} ${c.summary}`.toLowerCase();
            const score = keywords.reduce((s, kw) => s + (text.includes(kw) ? 1 : 0), 0);
            return { candidate: c, score };
        });

        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(s => s.candidate);
    },
};
