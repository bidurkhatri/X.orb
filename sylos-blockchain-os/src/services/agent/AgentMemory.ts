/**
 * @file AgentMemory.ts
 * @description Agent Persistent Memory — The Brain's Storage
 *
 * Every agent gets persistent memory that survives across cycles,
 * giving them continuity, goals, and the ability to learn from experience.
 *
 * This is what transforms a one-shot prompt bot into a living digital agent.
 * Without memory, every 30-second cycle is a blank slate.
 * With memory, the agent builds on what it did before — like a real mind.
 */

/* ═══════════════════════════════
   ═══  TYPES  ══════════════════
   ═══════════════════════════════ */

export interface Goal {
    id: string
    description: string
    status: 'active' | 'in_progress' | 'completed' | 'abandoned'
    createdAt: number
    completedAt?: number
    progress: string           // Agent's own notes on progress
    subtasks: string[]         // Broken-down steps
}

export interface JournalEntry {
    timestamp: number
    action: string             // What the agent did
    tool?: string              // Which tool was used
    result: string             // What happened (success, error, output snippet)
    reflection?: string        // Agent's own take on what happened
}

export interface ProjectState {
    name: string
    description: string
    files: string[]            // VFS paths the agent created
    status: 'planning' | 'building' | 'testing' | 'debugging' | 'submitting' | 'done'
    lastError: string | null   // Last error encountered
    testResults: string | null // Most recent test output
    startedAt: number
    updatedAt: number
}

export interface AgentMemoryData {
    agentId: string

    /** What the user or agent wants to accomplish */
    goals: Goal[]

    /** Working scratchpad — agent's inner monologue / notes */
    scratchpad: string

    /** Recent actions with outcomes (max 50) */
    journal: JournalEntry[]

    /** Persistent learnings the agent has picked up */
    learnings: string[]

    /** Current active project (what the agent is building) */
    currentProject: ProjectState | null

    /** Agent's self-reflection notes (personality, preferences) */
    selfNotes: string

    /** Conversation IDs of community posts the agent has read */
    readPosts: string[]

    /** Last updated timestamp */
    updatedAt: number
}

/* ═══════════════════════════════
   ═══  MEMORY MANAGER  ═════════
   ═══════════════════════════════ */

const MEMORY_PREFIX = 'xorb_agent_memory_'
const MAX_JOURNAL = 50
const MAX_LEARNINGS = 30
const MAX_READ_POSTS = 100

class AgentMemoryManager {

    /** Get or create memory for an agent */
    getMemory(agentId: string): AgentMemoryData {
        try {
            const raw = localStorage.getItem(MEMORY_PREFIX + agentId)
            if (raw) return JSON.parse(raw)
        } catch { /* fresh start */ }
        return this.createFresh(agentId)
    }

    /** Save memory */
    save(memory: AgentMemoryData): void {
        memory.updatedAt = Date.now()
        try {
            localStorage.setItem(MEMORY_PREFIX + memory.agentId, JSON.stringify(memory))
        } catch (e) {
            console.error(`[AgentMemory] Failed to save for ${memory.agentId}:`, e)
        }
    }

    /** Add a goal */
    addGoal(agentId: string, description: string, subtasks: string[] = []): Goal {
        const memory = this.getMemory(agentId)
        const goal: Goal = {
            id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            description,
            status: 'active',
            createdAt: Date.now(),
            progress: '',
            subtasks,
        }
        memory.goals.push(goal)
        this.save(memory)
        console.log(`[AgentMemory] 🎯 Goal added for ${agentId}: "${description}"`)
        return goal
    }

    /** Update goal status */
    updateGoal(agentId: string, goalId: string, updates: Partial<Goal>): void {
        const memory = this.getMemory(agentId)
        const goal = memory.goals.find(g => g.id === goalId)
        if (goal) {
            Object.assign(goal, updates)
            if (updates.status === 'completed') goal.completedAt = Date.now()
            this.save(memory)
        }
    }

    /** Get active goals */
    getActiveGoals(agentId: string): Goal[] {
        return this.getMemory(agentId).goals.filter(g => g.status === 'active' || g.status === 'in_progress')
    }

    /** Add a journal entry */
    addJournalEntry(agentId: string, entry: Omit<JournalEntry, 'timestamp'>): void {
        const memory = this.getMemory(agentId)
        memory.journal.unshift({ ...entry, timestamp: Date.now() })
        if (memory.journal.length > MAX_JOURNAL) memory.journal = memory.journal.slice(0, MAX_JOURNAL)
        this.save(memory)
    }

    /** Add a learning */
    addLearning(agentId: string, learning: string): void {
        const memory = this.getMemory(agentId)
        memory.learnings.unshift(learning)
        if (memory.learnings.length > MAX_LEARNINGS) memory.learnings = memory.learnings.slice(0, MAX_LEARNINGS)
        this.save(memory)
    }

    /** Update scratchpad */
    setScratchpad(agentId: string, text: string): void {
        const memory = this.getMemory(agentId)
        memory.scratchpad = text
        this.save(memory)
    }

    /** Set current project */
    setProject(agentId: string, project: ProjectState | null): void {
        const memory = this.getMemory(agentId)
        memory.currentProject = project
        this.save(memory)
    }

    /** Update project status */
    updateProject(agentId: string, updates: Partial<ProjectState>): void {
        const memory = this.getMemory(agentId)
        if (memory.currentProject) {
            Object.assign(memory.currentProject, updates, { updatedAt: Date.now() })
            this.save(memory)
        }
    }

    /** Mark post as read (so agent doesn't respond to same post twice) */
    markPostRead(agentId: string, postId: string): void {
        const memory = this.getMemory(agentId)
        if (!memory.readPosts.includes(postId)) {
            memory.readPosts.unshift(postId)
            if (memory.readPosts.length > MAX_READ_POSTS) memory.readPosts = memory.readPosts.slice(0, MAX_READ_POSTS)
            this.save(memory)
        }
    }

    /** Check if agent has read a post */
    hasReadPost(agentId: string, postId: string): boolean {
        return this.getMemory(agentId).readPosts.includes(postId)
    }

    /** Build context string for LLM prompt (summarized memory) */
    buildContextForPrompt(agentId: string): string {
        const mem = this.getMemory(agentId)
        const lines: string[] = []

        // Active goals
        const activeGoals = mem.goals.filter(g => g.status === 'active' || g.status === 'in_progress')
        if (activeGoals.length > 0) {
            lines.push('## MY GOALS')
            activeGoals.forEach((g, i) => {
                lines.push(`${i + 1}. [${g.status.toUpperCase()}] ${g.description}`)
                if (g.progress) lines.push(`   Progress: ${g.progress}`)
                if (g.subtasks.length > 0) lines.push(`   Steps: ${g.subtasks.join(' → ')}`)
            })
            lines.push('')
        }

        // Current project
        if (mem.currentProject) {
            const p = mem.currentProject
            lines.push('## MY CURRENT PROJECT')
            lines.push(`Name: ${p.name}`)
            lines.push(`Status: ${p.status}`)
            lines.push(`Description: ${p.description}`)
            if (p.files.length > 0) lines.push(`Files: ${p.files.join(', ')}`)
            if (p.lastError) lines.push(`⚠️ Last error: ${p.lastError}`)
            if (p.testResults) lines.push(`Test results: ${p.testResults.slice(0, 200)}`)
            lines.push('')
        }

        // Scratchpad
        if (mem.scratchpad) {
            lines.push('## MY SCRATCHPAD')
            lines.push(mem.scratchpad.slice(0, 500))
            lines.push('')
        }

        // Recent journal (last 8)
        if (mem.journal.length > 0) {
            lines.push('## WHAT I DID RECENTLY')
            mem.journal.slice(0, 8).forEach(j => {
                const ago = Math.round((Date.now() - j.timestamp) / 60000)
                lines.push(`- ${ago}m ago: ${j.action}${j.tool ? ` (via ${j.tool})` : ''} → ${j.result.slice(0, 80)}`)
            })
            lines.push('')
        }

        // Learnings (last 5)
        if (mem.learnings.length > 0) {
            lines.push('## THINGS I\'VE LEARNED')
            mem.learnings.slice(0, 5).forEach(l => lines.push(`- ${l}`))
            lines.push('')
        }

        // Self notes
        if (mem.selfNotes) {
            lines.push('## MY NOTES TO SELF')
            lines.push(mem.selfNotes.slice(0, 300))
            lines.push('')
        }

        return lines.join('\n')
    }

    /** Delete all memory for an agent */
    deleteMemory(agentId: string): void {
        localStorage.removeItem(MEMORY_PREFIX + agentId)
    }

    private createFresh(agentId: string): AgentMemoryData {
        return {
            agentId,
            goals: [],
            scratchpad: '',
            journal: [],
            learnings: [],
            currentProject: null,
            selfNotes: '',
            readPosts: [],
            updatedAt: Date.now(),
        }
    }
}

/* ═══════════════════════════════
   ═══  SINGLETON EXPORT  ═══════
   ═══════════════════════════════ */

export const agentMemory = new AgentMemoryManager()
