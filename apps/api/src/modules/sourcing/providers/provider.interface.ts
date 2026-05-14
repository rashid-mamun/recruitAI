export interface RawCandidate {
    name: string;
    linkedinUrl: string;
    headline: string;
    summary: string;
    skills: string[];
    experience: string;
    location: string;
    email?: string;
}

export interface SourcingProvider {
    name: string;
    search: (query: string, limit: number) => Promise<RawCandidate[]>;
}
