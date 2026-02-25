import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AgentService } from '../services/agent/AgentService';
import type {
  RegisteredAgent,
  TransactionProposal,
  CommunityPost,
  ActivityEvent,
} from '../types/agent';

interface AgentContextType {
  agents: RegisteredAgent[];
  activeAgents: RegisteredAgent[];
  proposals: TransactionProposal[];
  pendingProposals: TransactionProposal[];
  posts: CommunityPost[];
  events: ActivityEvent[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  pauseAgent: (id: string) => void;
  resumeAgent: (id: string) => void;
  revokeAgent: (id: string) => void;
  approveProposal: (id: string) => void;
  rejectProposal: (id: string) => void;
  votePost: (id: string, direction: 1 | -1) => void;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export const useAgents = () => {
  const context = useContext(AgentContext);
  if (!context) throw new Error('useAgents must be used within AgentProvider');
  return context;
};

export const AgentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [proposals, setProposals] = useState<TransactionProposal[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    await AgentService.init();
    setAgents(AgentService.getAgents());
    setProposals(AgentService.getProposals());
    setPosts(AgentService.getPosts());
    setEvents(AgentService.getRecentEvents());
    setIsLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const refresh = useCallback(async () => { await loadAll(); }, [loadAll]);

  const pauseAgent = useCallback((id: string) => {
    AgentService.pauseAgent(id);
    setAgents([...AgentService.getAgents()]);
  }, []);

  const resumeAgent = useCallback((id: string) => {
    AgentService.resumeAgent(id);
    setAgents([...AgentService.getAgents()]);
  }, []);

  const revokeAgent = useCallback((id: string) => {
    AgentService.revokeAgent(id);
    setAgents([...AgentService.getAgents()]);
  }, []);

  const approveProposal = useCallback((id: string) => {
    AgentService.approveProposal(id);
    setProposals([...AgentService.getProposals()]);
  }, []);

  const rejectProposal = useCallback((id: string) => {
    AgentService.rejectProposal(id);
    setProposals([...AgentService.getProposals()]);
  }, []);

  const votePost = useCallback((id: string, direction: 1 | -1) => {
    AgentService.votePost(id, direction);
    setPosts([...AgentService.getPosts()]);
  }, []);

  const activeAgents = agents.filter(a => a.status === 'active');
  const pendingProposals = proposals.filter(p => p.status === 'pending');

  return (
    <AgentContext.Provider value={{
      agents, activeAgents, proposals, pendingProposals,
      posts, events, isLoading, refresh,
      pauseAgent, resumeAgent, revokeAgent,
      approveProposal, rejectProposal, votePost,
    }}>
      {children}
    </AgentContext.Provider>
  );
};
