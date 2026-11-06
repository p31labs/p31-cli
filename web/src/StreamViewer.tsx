import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface StreamViewerProps {
  wsUrl: string;
  title?: string;
  spoonLevel?: 1 | 3 | 5;
}

export const StreamViewer: React.FC<StreamViewerProps> = ({
  wsUrl,
  title = 'P31 Agent Stream',
  spoonLevel = 5,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  const HIGH_WATERMARK = 100000;
  const LOW_WATERMARK = 10000;

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: spoonLevel === 1 ? '#0a0806' : '#030305',
        foreground: spoonLevel === 1 ? '#f5f0eb' : '#ffffff',
        cursor: spoonLevel === 1 ? '#f5a623' : '#00f0ff',
        selectionBackground: 'rgba(181, 60, 255, 0.3)',
        black: '#030305',
        red: '#ff003c',
        green: '#00ff66',
        yellow: '#ffd700',
        blue: '#00f0ff',
        magenta: '#b53cff',
        cyan: '#5cc2c9',
        white: '#ffffff',
        brightBlack: '#4a5b78',
        brightRed: '#ff003c',
        brightGreen: '#00ff66',
        brightYellow: '#ffd700',
        brightBlue: '#00f0ff',
        brightMagenta: '#b53cff',
        brightCyan: '#5cc2c9',
        brightWhite: '#f0f4ff',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: spoonLevel === 1 ? 18 : 14,
      lineHeight: 1.6,
      cursorBlink: spoonLevel !== 1,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(terminalRef.current);
    fitAddon.fit();

    termRef.current = term;

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    let watermark = 0;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        term.writeln('\x1b[38;2;0;255;102m\u2713 Connected to stream relay\x1b[0m');
        term.writeln(`\x1b[38;2;74;91;120m[${title}]\x1b[0m Live stream starting...\r\n`);
      };

      ws.onmessage = (event: MessageEvent) => {
        const chunk = typeof event.data === 'string' ? event.data : '';
        watermark += chunk.length;

        try {
          const data = JSON.parse(chunk);
          if (data.type === 'stats' && data.viewers !== undefined) {
            setViewerCount(data.viewers);
            return;
          }
          if (data.type === 'system' && data.message) {
            term.writeln(`\x1b[38;2;74;91;120m[system]\x1b[0m ${data.message}`);
            if (data.viewers !== undefined) setViewerCount(data.viewers);
            return;
          }
        } catch {
          // Not JSON — treat as terminal output
        }

        term.write('\x1b[?2026h');
        term.write(chunk, () => {
          watermark = Math.max(watermark - chunk.length, 0);
        });
        term.write('\x1b[?2026l');

        if (watermark > HIGH_WATERMARK && wsRef.current) {
          wsRef.current?.send(JSON.stringify({ type: 'flowcontrol', action: 'pause' }));
        }
        if (watermark < LOW_WATERMARK && wsRef.current) {
          wsRef.current?.send(JSON.stringify({ type: 'flowcontrol', action: 'resume' }));
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        term.writeln('\r\n\x1b[38;2;255;0;60m\u26A0 Stream disconnected. Reconnecting in 3s...\x1b[0m');
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        term.writeln('\r\n\x1b[38;2;255;0;60m\u2717 WebSocket error\x1b[0m');
      };
    }

    connect();

    return () => {
      window.removeEventListener('resize', handleResize);
      wsRef.current?.close();
      term.dispose();
    };
  }, [wsUrl, title, spoonLevel]);

  return (
    <div className="stream-viewer" style={styles.container}>
      <div style={styles.header}>
        <div style={styles.liveBadge}>
          <span style={{
            ...styles.pulse,
            background: isConnected ? '#ff003c' : '#4a5b78',
            boxShadow: isConnected ? '0 0 0 0 rgba(255, 0, 60, 0.7)' : 'none',
          }} />
          {isConnected ? 'LIVE' : 'OFFLINE'}
        </div>
        <div style={styles.title}>{title}</div>
        <div style={styles.viewers}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>{viewerCount}</span>
        </div>
      </div>
      <div ref={terminalRef} style={styles.terminal} />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(3, 3, 5, 0.8)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: 960,
    margin: '40px auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(0, 0, 0, 0.2)',
  },
  liveBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#ff003c',
    fontWeight: 800,
    fontSize: 11,
    letterSpacing: 1,
  },
  pulse: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    animation: 'pulsePulse 1.5s infinite',
  },
  title: {
    fontSize: 11,
    color: '#4a5b78',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  viewers: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#00f0ff',
    fontSize: 11,
  },
  terminal: {
    height: 400,
    padding: 8,
  },
};
