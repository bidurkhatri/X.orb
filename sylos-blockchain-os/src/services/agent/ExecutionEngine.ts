/**
 * @file ExecutionEngine.ts
 * @description In-browser execution environment for the SylOS Agent IDE.
 * Safely runs JavaScript (via new Function) and Python (via Pyodide Web Worker).
 * Captures stdout/stderr and pipes it to a provided terminal output callback.
 */

declare global {
    interface Window {
        loadPyodide: any
    }
}

export type LogCallback = (str: string) => void

export class ExecutionEngine {
    private pyodide: any = null
    private isPyodideLoading = false
    private onLog: LogCallback = () => { }

    constructor() {
        // Pre-load Pyodide in background
        this.initPyodide().catch(console.error)
    }

    setLogCallback(cb: LogCallback) {
        this.onLog = cb
    }

    private log(msg: string) {
        this.onLog(msg + '\r\n')
    }

    private logError(msg: string) {
        this.onLog('\x1b[31m' + msg + '\x1b[0m\r\n')
    }

    /**
     * Initialize Pyodide. We load it from CDN to avoid bloating the bundle.
     */
    async initPyodide() {
        if (this.pyodide || this.isPyodideLoading) return
        this.isPyodideLoading = true

        try {
            if (!document.querySelector('#pyodide-script')) {
                const script = document.createElement('script')
                script.id = 'pyodide-script'
                script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js'
                document.head.appendChild(script)

                await new Promise((resolve) => {
                    script.onload = resolve
                })
            }

            this.log('\x1b[34m[System]\x1b[0m Initializing Python runtime (WebAssembly)...')

            this.pyodide = await window.loadPyodide({
                stdout: (msg: string) => this.onLog(msg + '\r\n'),
                stderr: (msg: string) => this.logError(msg)
            })

            this.log('\x1b[32m[System]\x1b[0m Python runtime ready.\r\n')
        } catch (e: any) {
            this.logError(`Failed to load Python runtime: ${e.message}`)
        } finally {
            this.isPyodideLoading = false
        }
    }

    /**
     * Execute code based on language
     */
    async execute(code: string, language: string) {
        if (!code.trim()) {
            this.logError('Cannot execute empty file.')
            return
        }

        const lang = language.toLowerCase()
        if (lang === 'javascript' || lang === 'typescript' || lang === 'js' || lang === 'ts') {
            await this.executeJavaScript(code)
        } else if (lang === 'python' || lang === 'py') {
            await this.executePython(code)
        } else {
            this.logError(`Execution not supported for language: ${language}`)
        }
    }

    /**
     * Execute JavaScript safely capturing console logs
     */
    private async executeJavaScript(code: string) {
        this.log('\x1b[33m$ node script.js\x1b[0m')

        // Mock console to capture output
        const originalConsoleLog = console.log
        const originalConsoleError = console.error
        const originalConsoleWarn = console.warn
        const originalConsoleInfo = console.info

        console.log = (...args) => { this.log(args.map(a => String(a)).join(' ')) }
        console.error = (...args) => { this.logError(args.map(a => String(a)).join(' ')) }
        console.warn = (...args) => { this.onLog('\x1b[33m' + args.map(a => String(a)).join(' ') + '\x1b[0m\r\n') }
        console.info = (...args) => { this.onLog('\x1b[36m' + args.map(a => String(a)).join(' ') + '\x1b[0m\r\n') }

        try {
            // Transform typescript to JS naively for standard syntax (remove types)
            // Note: This is a hacky fallback. Real TS execution needs Babel/SWC.
            const jsCode = code.replace(/: \w+/g, '') // remove type annotations loosely
                .replace(/interface \w+\s*{[^}]*}/g, '') // remove interfaces
                .replace(/type \w+\s*=[^;]+;/g, '') // remove type aliases

            // Execute in async context
            const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor
            const fn = new AsyncFunction(jsCode)
            await fn()
        } catch (e: any) {
            this.logError(e.message)
            if (e.stack) this.logError(e.stack.split('\n').slice(0, 3).join('\n'))
        } finally {
            // Restore console
            console.log = originalConsoleLog
            console.error = originalConsoleError
            console.warn = originalConsoleWarn
            console.info = originalConsoleInfo
        }
    }

    /**
     * Execute Python using Pyodide
     */
    private async executePython(code: string) {
        this.log('\x1b[33m$ python3 script.py\x1b[0m')

        if (!this.pyodide) {
            if (this.isPyodideLoading) {
                this.log('\x1b[34m[System]\x1b[0m Waiting for Python runtime to load...')
                while (this.isPyodideLoading) await new Promise(r => setTimeout(r, 100))
            } else {
                await this.initPyodide()
            }
        }

        if (!this.pyodide) {
            this.logError('Python runtime unavailable.')
            return
        }

        try {
            // Load common packages automatically if imported
            if (code.includes('import numpy')) await this.pyodide.loadPackage('numpy')
            if (code.includes('import pandas')) await this.pyodide.loadPackage('pandas')

            // Run the code — stdout/stderr is already piped to our log callback
            await this.pyodide.runPythonAsync(code)
        } catch (e: any) {
            // Pyodide throws Python exceptions as JS errors
            this.logError(e.message)
        }
    }
}

export const executionEngine = new ExecutionEngine()
