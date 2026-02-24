/**
 * SylOS IPC Bridge (Inter-Process Communication)
 * Provides a controlled messaging pipeline for AI Agents to communicate with the OS User Interface, 
 * as well as other running Agents, without directly accessing the global Window or Document objects.
 */
import { v4 as uuidv4 } from 'uuid';

export type IpcMessageType = 'REQUEST_PERMISSION' | 'EXECUTE_ONCHAIN' | 'FILE_READ' | 'FILE_WRITE' | 'AGENT_CHAT' | 'HEARTBEAT';

export interface IpcMessage {
    id: string;
    sourceAgentId: string;
    targetAgentId?: string | undefined; // Optional: If targeting another agent instead of OS API
    type: IpcMessageType;
    payload: any;
    timestamp: number;
}

export type OSCommandHandler = (message: IpcMessage) => Promise<any>;

class IpcBridge {
    private messageQueue: IpcMessage[] = [];
    private listeners: Map<string, OSCommandHandler[]> = new Map();
    private _isListening: boolean = false;

    constructor() {
        this.startEventLoop();
    }

    /**
     * Agents use this method to dispatch intentions into the OS IPC pipe.
     */
    public dispatch(sourceAgentId: string, type: IpcMessageType, payload: any, targetAgentId?: string): IpcMessage {
        const msg: IpcMessage = {
            id: uuidv4(),
            sourceAgentId,
            targetAgentId,
            type,
            payload,
            timestamp: Date.now()
        };
        this.messageQueue.push(msg);
        console.log(`[IPC] Message routed from ${sourceAgentId}: ${type}`);
        return msg;
    }

    /**
     * SylOS modules subscribe to specific intent types (e.g. Wallet API subscribes to 'EXECUTE_ONCHAIN')
     */
    public subscribeOSCommand(type: IpcMessageType, handler: OSCommandHandler) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type)?.push(handler);
    }

    /**
     * Background event loop processing the stack frame sequentially to prevent concurrency collisions.
     */
    private startEventLoop() {
        if (this._isListening) return;
        this._isListening = true;

        setInterval(async () => {
            if (this.messageQueue.length > 0) {
                // Pop the oldest message
                const msg = this.messageQueue.shift();
                if (msg) {
                    const handlers = this.listeners.get(msg.type) || [];
                    for (const handler of handlers) {
                        try {
                            await handler(msg);
                        } catch (err) {
                            console.error(`[IPC] Handler failed for ${msg.type}`, err);
                        }
                    }
                }
            }
        }, 100); // 100ms cycle tick
    }
}

export const sysIpc = new IpcBridge();
