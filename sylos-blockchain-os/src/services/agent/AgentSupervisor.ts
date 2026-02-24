/**
 * SylOS Agent Supervisor Daemon
 * Manages the lifecycle, RAM/CPU allocation limits, and "Heartbeat" wake cycles of all AI Agents.
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
}

class AgentSupervisor {
    private agents: Map<string, AgentInstance> = new Map();
    private daemonInterval: any = null;

    // Limits
    private MAX_TOTAL_RAM_MB = 1024; // 1GB cap inside localized browser WASM simulation
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
            ramUsageMB: 10 + Math.floor(Math.random() * 20), // Base LLM context size
            spawnTime: Date.now()
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
     * Instantly suspends the event loops of all spawned agents to prevent unapproved blockchain leakage.
     */
    public triggerMasterKillSwitch() {
        console.warn("🚨 [SUPERVISOR] MASTER KILL-SWITCH ENGAGED. HALTING ALL ACTIVE AGENTS.");
        this.HARD_HALT_TRIGGERED = true;
        this.agents.forEach(agent => {
            if (agent.status !== 'TERMINATED') {
                agent.status = 'HALTED';
                agent.cpuUsage = 0;
            }
        });
    }

    public disarmKillSwitch() {
        console.info("🟩 [SUPERVISOR] MASTER KILL-SWITCH DISARMED. RESUMING SCHEDULER.");
        this.HARD_HALT_TRIGGERED = false;
        this.agents.forEach(agent => {
            if (agent.status === 'HALTED') {
                agent.status = 'SLEEPING'; // Needs a task to wake up
            }
        });
    }

    private bootDaemon() {
        // Runs a daemon cycle every 3 seconds to manage heat output and memory scaling
        this.daemonInterval = setInterval(() => {
            if (this.HARD_HALT_TRIGGERED) return;

            let totalRam = 0;
            this.agents.forEach(agent => {
                if (agent.status === 'TERMINATED' || agent.status === 'HALTED') return;

                // Simulate Agent lifecycle changes
                if (agent.status === 'EXECUTING') {
                    // Random fluctuate CPU usage to simulate inference
                    agent.cpuUsage = Math.min(100, agent.cpuUsage + (Math.random() * 40 - 20));
                    agent.ramUsageMB = Math.min(250, agent.ramUsageMB + (Math.random() * 10));

                    sysIpc.dispatch(agent.id, 'HEARTBEAT', { cpu: agent.cpuUsage, ram: agent.ramUsageMB });

                    // Simulating task completion probability
                    if (Math.random() > 0.8) {
                        agent.status = 'SLEEPING';
                        agent.cpuUsage = 0;
                    }
                } else if (agent.status === 'SLEEPING') {
                    // Slight chance to wake up and request work
                    if (Math.random() > 0.9) {
                        agent.status = 'EXECUTING';
                    }
                }

                totalRam += agent.ramUsageMB;
            });

            // Guardrail constraint: Memory threshold breach triggers a Halt
            if (totalRam > this.MAX_TOTAL_RAM_MB) {
                console.warn(`[SUPERVISOR] System RAM maxed (${totalRam}MB). Throttling compute.`);
                this.triggerMasterKillSwitch(); // Drastic measure for prototype showcasing limits
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
