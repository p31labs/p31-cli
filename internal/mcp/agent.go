package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	mcpclient "github.com/mark3labs/mcp-go/client"
	mcptypes "github.com/mark3labs/mcp-go/mcp"
	"github.com/sashabaranov/go-openai"
)

type ServerDef struct {
	Name    string
	Command string
	Args    []string
	Env     map[string]string
}

type serverConnection struct {
	def    ServerDef
	client *mcpclient.Client
	tools  []mcptypes.Tool
}

type Agent struct {
	mu      sync.Mutex
	servers []*serverConnection
	tools   []openai.Tool
}

func NewAgent(servers []ServerDef) (*Agent, error) {
	a := &Agent{}
	ctx := context.Background()

	for _, s := range servers {
		env := make([]string, 0, len(s.Env))
		for k, v := range s.Env {
			env = append(env, k+"="+v)
		}

		c, err := mcpclient.NewStdioMCPClient(s.Command, env, s.Args...)
		if err != nil {
			log.Printf("MCP: failed to connect to %s: %v", s.Name, err)
			continue
		}

		initReq := mcptypes.InitializeRequest{}
		initReq.Params.ProtocolVersion = mcptypes.LATEST_PROTOCOL_VERSION
		initReq.Params.ClientInfo = mcptypes.Implementation{
			Name:    "p31-cli",
			Version: "1.0.0",
		}

		initCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		initResult, err := c.Initialize(initCtx, initReq)
		cancel()
		if err != nil {
			log.Printf("MCP: failed to initialize %s: %v", s.Name, err)
			c.Close()
			continue
		}

		listCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		toolsResult, err := c.ListTools(listCtx, mcptypes.ListToolsRequest{})
		cancel()
		if err != nil {
			log.Printf("MCP: failed to list tools for %s: %v", s.Name, err)
			c.Close()
			continue
		}

		conn := &serverConnection{
			def:    s,
			client: c,
			tools:  toolsResult.Tools,
		}
		a.servers = append(a.servers, conn)

		log.Printf("MCP: connected %s (v%s) with %d tools",
			initResult.ServerInfo.Name, initResult.ServerInfo.Version, len(toolsResult.Tools))

		for _, tool := range toolsResult.Tools {
			openaiTool := mcpToolToOpenAI(s.Name, tool)
			a.tools = append(a.tools, openaiTool)
		}
	}

	return a, nil
}

func mcpToolToOpenAI(serverName string, tool mcptypes.Tool) openai.Tool {
	schemaBytes, _ := json.Marshal(tool.InputSchema)
	return openai.Tool{
		Type: "function",
		Function: &openai.FunctionDefinition{
			Name:        serverName + "__" + tool.Name,
			Description: tool.Description,
			Parameters:  schemaBytes,
		},
	}
}

func parseToolName(fullName string) (server string, tool string) {
	idx := strings.Index(fullName, "__")
	if idx < 0 {
		return "", fullName
	}
	return fullName[:idx], fullName[idx+2:]
}

func (a *Agent) Tools() []openai.Tool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.tools
}

func (a *Agent) CallTool(ctx context.Context, toolCall openai.ToolCall) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	serverName, toolName := parseToolName(toolCall.Function.Name)

	var args map[string]any
	if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
		return "", fmt.Errorf("failed to parse tool arguments: %w", err)
	}

	for _, conn := range a.servers {
		if conn.def.Name != serverName {
			continue
		}

		req := mcptypes.CallToolRequest{}
		req.Params.Name = toolName
		req.Params.Arguments = args

		result, err := conn.client.CallTool(ctx, req)
		if err != nil {
			return "", fmt.Errorf("tool %s/%s failed: %w", serverName, toolName, err)
		}

		var parts []string
		for _, content := range result.Content {
			switch c := content.(type) {
			case mcptypes.TextContent:
				parts = append(parts, c.Text)
			default:
				b, _ := json.Marshal(c)
				parts = append(parts, string(b))
			}
		}
		return strings.Join(parts, "\n"), nil
	}

	return "", fmt.Errorf("unknown server: %s", serverName)
}

func (a *Agent) Close() {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, conn := range a.servers {
		conn.client.Close()
	}
}

func (a *Agent) ServerCount() int {
	a.mu.Lock()
	defer a.mu.Unlock()
	return len(a.servers)
}

func (a *Agent) ToolCount() int {
	a.mu.Lock()
	defer a.mu.Unlock()
	return len(a.tools)
}
