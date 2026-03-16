/**
 * Xorb Agent Supervisor Daemon
 * Manages the lifecycle, resource tracking, and "Heartbeat" wake cycles of all AI Agents.
 *
 * Resource metrics are tracked from actual agent activity:
 * - CPU usage is derived from time spent executing (active cycle time vs idle time)
 * - RAM is estimated from the size of agent context + conversation history
 * - Task completion is reported by the AutonomyEngine, not randomly generated
 */
import { sysIpc } from './IpcBridge';
import { v4 as uuidv4 } from 'uuid';

export type AgentRole = 'RESEARCHER' | 'DEFI_TRADER' | 'SMART_CONTRACT_AUDITOR' | 'VFS_ORGANIZER';

export interface AgentInstance {
    id: string;
    name: string;
    role: AgentRole;
    stakedBond: number;      // Proof of Stake bond for accountability
    allowance: number;       // ERC-4337 Session Key spending limit
    status: 'SLEEPING' | 'EXECUTING' | 'HALTED' | 'TERMINATED';
    cpuUsage: number;
    ramUsageMB: number;
    spawnTime: number;
    lastCycleStart: number;
    totalCycleTimeMs: number;
    totalCycles: number;
    contextTokens: number;   // Estimated token count in agent context
}

class AgentSupervisor {
    private agents: Map<string, AgentInstance> = new Map();
    private daemonInterval: any = null;

    // Limits
    private MAX_TOTAL_RAM_MB = 1024;
    private HARD_HALT_TRIGGERED = false;

    constructor() {
        this.bootDaemon();
    }

    /**
     * Initializes a new Web3 LLM Agent localized within the OS memory sandbox.
     */
    public spawnAgent(name: string, role: AgentRole, stakedBond: number, allowance: number): AgentInstance {
        if (this.HARD_HALT_TRIGGERED) {
            throw new Error("[SUPERVISOR] Cannot spawn agents. Master Kill-Switch is active.");
        }

        const id = uuidv4();
        const newAgent: AgentInstance = {
            id,
            name,
            role,
            stakedBond,
            allowance,
            status: 'SLEEPING',
            cpuUsage: 0,
            ramUsageMB: 5, // Base overhead for agent registration
            spawnTime: Date.now(),
            lastCycleStart: 0,
            totalCycleTimeMs: 0,
            totalCycles: 0,
            contextTokens: 0,
        };

        this.agents.set(id, newAgent);
        console.log(`[SUPERVISOR] Spawning Agent [${id}] - ${name}`);
        return newAgent;
    }

    /**
     * Retrieves all active instances for the OS Task Manager.
     */
    public listAgents(): AgentInstance[] {
        return Array.from(this.agents.values());
    }

    public getAgent(id: string): AgentInstance | undefined {
        return this.agents.get(id);
    }

    /**
     * Called by the AutonomyEngine when an agent starts an execution cycle.
     */
    public reportCycleStart(agentId: string): void {
        const agent = this.agents.get(agentId);
        if (agent && agent.status !== 'TERMINATED' && agent.status !== 'HALTED') {
            agent.status = 'EXECUTING';
            agent.lastCycleStart = performance.now();
        }
    }

    /**
     * Called by the AutonomyEngine when an agent finishes an execution cycle.
     */
    public reportCycleEnd(agentId: string, contextTokens?: number): void {
        const agent = this.agents.get(agentId);
        if (!agent) return;

        if (agent.lastCycleStart > 0) {
            const elapsed = performance.now() - agent.lastCycleStart;
            agent.totalCycleTimeMs += elapsed;
            agent.totalCycles++;
            agent.lastCycleStart = 0;
        }

        if (contextTokens !== undefined) {
            agent.contextTokens = contextTokens;
        }

        agent.status = 'SLEEPING';
    }

    /**
     * Safely powers down a singular agent and slashes/refunds their bond based on OS state.
     */
    public terminateAgent(id: string) {
        const agent = this.agents.get(id);
        if (agent) {
            agent.status = 'TERMINATED';
            agent.cpuUsage = 0;
            agent.ramUsageMB = 0;
            console.log(`[SUPERVISOR] Agent Terminated: ${id}`);
        }
    }

    /**
     * The OS Master Kill-Switch.
     * Instantly suspends the event loops of all spawned agents.
     */
    public triggerMasterKillSwitch() {
        console.warn("[SUPERVISOR] MASTER KILL-SWITCH ENGAGED. HALTING ALL ACTIVE AGENTS.");
        this.HARD_HALT_TRIGGERED = true;
        this.agents.forEach(agent => {
            if (agent.status !== 'TERMINATED') {
                agent.status = 'HALTED';
                agent.cpuUsage = 0;
            }
        });
    }

    public disarmKillSwitch() {
        console.info("[SUPERVISOR] MASTER KILL-SWITCH DISARMED. RESUMING SCHEDULER.");
        this.HARD_HALT_TRIGGERED = false;
        this.agents.forEach(agent => {
            if (agent.status === 'HALTED') {
                agent.status = 'SLEEPING';
            }
        });
    }

    private bootDaemon() {
        // Runs a daemon cycle every 3 seconds to compute real metrics
        this.daemonInterval = setInterval(() => {
            if (this.HARD_HALT_TRIGGERED) return;

            let totalRam = 0;
            const now = performance.now();

            this.agents.forEach(agent => {
                if (agent.status === 'TERMINATED' || agent.status === 'HALTED') return;

                // Compute CPU usage: percentage of time spent executing in the last 30s window
                if (agent.status === 'EXECUTING' && agent.lastCycleStart > 0) {
                    const activeMs = now - agent.lastCycleStart;
                    // CPU% = active time as fraction of the daemon window (3s)
                    agent.cpuUsage = Math.min(100, (activeMs / 3000) * 100);
                } else {
                    // Decay CPU toward 0 when sleeping
                    agent.cpuUsage = Math.max(0, agent.cpuUsage * 0.5);
                }

                // RAM estimate: base overhead + ~4 bytes per token in context
                const contextMB = (agent.contextTokens * 4) / (1024 * 1024);
                agent.ramUsageMB = 5 + contextMB;

                sysIpc.dispatch(agent.id, 'HEARTBEAT', { cpu: agent.cpuUsage, ram: agent.ramUsageMB });

                totalRam += agent.ramUsageMB;
            });

            // Guardrail: Memory threshold breach triggers a Halt
            if (totalRam > this.MAX_TOTAL_RAM_MB) {
                console.warn(`[SUPERVISOR] System RAM maxed (${Math.round(totalRam)}MB). Throttling compute.`);
                this.triggerMasterKillSwitch();
            }

        }, 3000);
    }

    /**
     * Complete nuclear shutdown of the entire OS supervisor daemon
     */
    public shutdownOSDaemon() {
        if (this.daemonInterval) {
            clearInterval(this.daemonInterval);
            this.daemonInterval = null;
        }
    }
}

export const sysAgentDaemon = new AgentSupervisor();
