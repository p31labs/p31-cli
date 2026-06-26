package cmd

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/sashabaranov/go-openai"
	"github.com/spf13/cobra"

	"github.com/p31labs/p31-cli/internal/config"
	p31mcp "github.com/p31labs/p31-cli/internal/mcp"
	"github.com/p31labs/p31-cli/internal/tui"
)

var (
	neonGreen  = lipgloss.Color("#39ff14")
	teal       = lipgloss.Color("#2dd4bf")

	systemStyle = lipgloss.NewStyle().Foreground(teal).Bold(true)
	userStyle   = lipgloss.NewStyle().Foreground(neonGreen).Bold(true)
	agentStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("#f8fafc"))
	titleStyle  = lipgloss.NewStyle().Foreground(teal).Bold(true).Padding(0, 1)
)

type chatMessage struct {
	content string
	role    string
}

type execMsg struct {
	output string
	err    error
}

type chatModel struct {
	viewport   viewport.Model
	messages   []chatMessage
	textarea   textarea.Model
	aiClient   *openai.Client
	mcpAgent   *p31mcp.Agent
	palette    tui.CommandPalette
	statusBar  tui.StatusBar
	proxyModel string
	ready      bool
	width      int
	height     int
}

var chatCmd = &cobra.Command{
	Use:   "chat",
	Short: "Start P31 interactive AI chat (Router Proxy)",
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := config.Load()
		if err != nil {
			fmt.Println("Error loading config:", err)
			os.Exit(1)
		}
		proxyURL := cfg.ProxyURL
		if proxyURL == "" {
			proxyURL = "http://localhost:4001/v1"
		}
		proxyModel := cfg.ProxyModel
		if proxyModel == "" {
			proxyModel = "flash"
		}

		oc := openai.DefaultConfig("not-needed")
		oc.BaseURL = proxyURL
		client := openai.NewClientWithConfig(oc)

		m := initialModel(client, proxyModel)
		p := tea.NewProgram(m, tea.WithAltScreen())
		if _, err := p.Run(); err != nil {
			fmt.Printf("Error: %v", err)
			os.Exit(1)
		}
	},
}

func init() {
	rootCmd.AddCommand(chatCmd)
}

func initialModel(client *openai.Client, proxyModel string) chatModel {
	ta := textarea.New()
	ta.Placeholder = "Communicate with the P31 Mesh... (Ctrl+P for commands)"
	ta.Focus()
	ta.Prompt = "┃ "
	ta.CharLimit = 0
	ta.SetWidth(80)
	ta.SetHeight(3)
	ta.FocusedStyle.CursorLine = lipgloss.NewStyle()
	ta.ShowLineNumbers = false

	vp := viewport.New(80, 20)
	vp.SetContent(systemStyle.Render("╭──────────────────────────────────────╮\n│  P31 // SPATIAL OASIS              │\n│  Resident Agent Online             │\n│  Router: :4001                     │\n╰──────────────────────────────────────╯\n"))

	paletteItems := []tui.PaletteItem{
		{Label: "Chat", Desc: "Return to chat", Keywords: "chat message talk", Action: func() tea.Cmd { return nil }},
		{Label: "Doctor", Desc: "Run ecosystem diagnostics", Keywords: "diagnostic health check doctor", Action: func() tea.Cmd { return execCmd("p31", "doctor") }},
		{Label: "Mesh Status", Desc: "Show K4 Cage mesh status", Keywords: "k4 cage family mesh status", Action: func() tea.Cmd { return execCmd("p31", "mesh", "status") }},
		{Label: "Spoon", Desc: "Show current spoon level", Keywords: "spoon energy cognitive", Action: func() tea.Cmd { return execCmd("p31", "spoon") }},
		{Label: "Energy", Desc: "Query energy level via AI", Keywords: "energy level power", Action: func() tea.Cmd { return execCmd("p31", "energy") }},
		{Label: "Ping", Desc: "Send a ping to a family member", Keywords: "ping family k4", Action: func() tea.Cmd { return execCmd("p31", "ping") }},
		{Label: "Connect", Desc: "Show connection spine", Keywords: "connect spine link", Action: func() tea.Cmd { return execCmd("p31", "connect") }},
		{Label: "Boot", Desc: "Execute P31 startup sequence", Keywords: "boot startup init", Action: func() tea.Cmd { return execCmd("p31", "boot") }},
		{Label: "Passport", Desc: "Show cognitive passport", Keywords: "passport identity key did", Action: func() tea.Cmd { return execCmd("p31", "passport", "show") }},
		{Label: "Passport Generate", Desc: "Generate Ed25519 keypair", Keywords: "passport generate key ed25519", Action: func() tea.Cmd { return execCmd("p31", "passport", "generate") }},
		{Label: "Dashboard", Desc: "Start TUI dashboard", Keywords: "dashboard tui", Action: func() tea.Cmd { return execCmd("p31", "dashboard") }},
		{Label: "Verify", Desc: "Run verification suite", Keywords: "verify test check", Action: func() tea.Cmd { return execCmd("p31", "verify") }},
		{Label: "Surfaces", Desc: "List available surfaces", Keywords: "surfaces list launch", Action: func() tea.Cmd { return execCmd("p31", "surface", "list") }},
		{Label: "Forge", Desc: "Document generation", Keywords: "forge document grant court", Action: func() tea.Cmd { return execCmd("p31", "forge") }},
		{Label: "Quantum", Desc: "Interact with Quantum Gateway", Keywords: "quantum qasm gateway", Action: func() tea.Cmd { return execCmd("p31", "quantum") }},
		{Label: "Kilo", Desc: "Interact with Kilo Gateway", Keywords: "kilo gateway profile", Action: func() tea.Cmd { return execCmd("p31", "kilo") }},
		{Label: "Kilo Models", Desc: "List available Kilo models", Keywords: "kilo models list", Action: func() tea.Cmd { return execCmd("p31", "kilo", "models") }},
		{Label: "Logs", Desc: "Tail command-center logs", Keywords: "logs tail", Action: func() tea.Cmd { return execCmd("p31", "logs", "tail") }},
		{Label: "Command Center", Desc: "Start local operator UI (:3131)", Keywords: "command-center operator ui", Action: func() tea.Cmd { return execCmd("p31", "command-center") }},
		{Label: "CI", Desc: "Run CI equivalent locally", Keywords: "ci pipeline build", Action: func() tea.Cmd { return execCmd("p31", "ci") }},
		{Label: "Launch", Desc: "Market launch pipeline", Keywords: "launch pipeline market", Action: func() tea.Cmd { return execCmd("p31", "launch") }},
		{Label: "Triper", Desc: "TRIPER MVP certification", Keywords: "triper certification mvp", Action: func() tea.Cmd { return execCmd("p31", "triper") }},
		{Label: "Hub Diff", Desc: "Diff p31ca hub against ground truth", Keywords: "hub diff p31ca", Action: func() tea.Cmd { return execCmd("p31", "hub-diff") }},
		{Label: "Cashpilot", Desc: "DePIN earnings optimizer", Keywords: "cashpilot depin earn", Action: func() tea.Cmd { return execCmd("p31", "cashpilot") }},
		{Label: "Open Surface", Desc: "Open a local dev surface", Keywords: "open surface launch", Action: func() tea.Cmd { return execCmd("p31", "open") }},
		{Label: "Version", Desc: "Print version number", Keywords: "version number", Action: func() tea.Cmd { return execCmd("p31", "version") }},
		{Label: "Clear", Desc: "Clear chat messages", Keywords: "clear clean reset", Action: func() tea.Cmd {
			return func() tea.Msg { return clearMsg{} }
		}},
		{Label: "Change Model", Desc: "Switch AI model (flash/premium/scavenger)", Keywords: "model switch change flash premium scavenger", Action: func() tea.Cmd {
			return func() tea.Msg { return modelSwitchMsg{} }
		}},
	}

	m := chatModel{
		textarea:   ta,
		viewport:   vp,
		messages:   []chatMessage{},
		aiClient:   client,
		palette:    tui.NewCommandPalette(paletteItems),
		statusBar:  tui.StatusBar{SpoonLevel: 3, SpoonLabel: "Medium", Model: proxyModel, MeshStatus: ""},
		proxyModel: proxyModel,
	}

	return m
}

type clearMsg struct{}
type modelSwitchMsg struct{}

func execCmd(name string, args ...string) tea.Cmd {
	return func() tea.Msg {
		cmd := exec.Command(name, args...)
		out, err := cmd.CombinedOutput()
		if err != nil {
			return execMsg{output: string(out), err: err}
		}
		return execMsg{output: string(out)}
	}
}

func (m chatModel) Init() tea.Cmd {
	return tea.Batch(textarea.Blink, m.fetchSpoonLevel(), m.initMCP())
}

func (m chatModel) initMCP() tea.Cmd {
	return func() tea.Msg {
		servers := []p31mcp.ServerDef{
			{
				Name:    "phos-forge",
				Command: "node",
				Args:    []string{"/home/p31/P31-local-workspace/tools/phos-forge/mcp-server.mjs"},
				Env:     map[string]string{},
			},
			{
				Name:    "google-workspace",
				Command: "node",
				Args:    []string{"/home/p31/google-workspace-mcp/build/index.js"},
				Env: map[string]string{
					"GOOGLE_CLIENT_ID":     os.Getenv("GOOGLE_CLIENT_ID"),
					"GOOGLE_CLIENT_SECRET": os.Getenv("GOOGLE_CLIENT_SECRET"),
				},
			},
		}
		agent, err := p31mcp.NewAgent(servers)
		if err != nil {
			return mcpReadyMsg{err: err}
		}
		return mcpReadyMsg{agent: agent}
	}
}

type mcpReadyMsg struct {
	agent *p31mcp.Agent
	err   error
}

func (m chatModel) fetchSpoonLevel() tea.Cmd {
	return func() tea.Msg {
		cmd := exec.Command("p31", "spoon")
		out, err := cmd.Output()
		if err != nil {
			return spoonMsg{level: 3, label: "Unknown"}
		}
		s := strings.TrimSpace(string(out))
		level := 3
		label := s
		if len(s) > 0 {
			switch {
			case strings.Contains(s, "Full"):
				level = 5
			case strings.Contains(s, "High"):
				level = 4
			case strings.Contains(s, "Medium"):
				level = 3
			case strings.Contains(s, "Low"):
				level = 2
			case strings.Contains(s, "Crisis"):
				level = 1
			case strings.Contains(s, "Shutdown"):
				level = 0
			}
		}
		return spoonMsg{level: level, label: label}
	}
}

type spoonMsg struct {
	level int
	label string
}

func (m chatModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	if paletteCmd, handled := m.palette.Update(msg); handled {
		if paletteCmd != nil {
			cmds = append(cmds, paletteCmd)
		}
		return m, tea.Batch(cmds...)
	}

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		headerHeight := 1
		statusBarHeight := 1
		inputHeight := 4
		vpHeight := m.height - headerHeight - statusBarHeight - inputHeight - 2
		if vpHeight < 10 {
			vpHeight = 10
		}
		m.viewport = viewport.New(msg.Width-2, vpHeight)
		m.viewport.YPosition = 1
		m.textarea.SetWidth(msg.Width - 4)
		m.ready = true
		m.renderMessages()
		return m, nil

	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyCtrlC:
			m.cleanup()
			return m, tea.Quit
		case tea.KeyEscape:
			m.cleanup()
			return m, tea.Quit
		case tea.KeyCtrlP:
			cmds = append(cmds, m.palette.Open())
			return m, tea.Batch(cmds...)
		case tea.KeyEnter:
			if m.textarea.Value() != "" {
				userInput := m.textarea.Value()
				m.messages = append(m.messages, chatMessage{content: userInput, role: "user"})
				m.textarea.Reset()
				m.renderMessages()
				cmds = append(cmds, m.sendToAI(userInput))
			}
			return m, tea.Batch(cmds...)
		}

	case aiResponseMsg:
		m.messages = append(m.messages, chatMessage{content: string(msg), role: "assistant"})
		m.renderMessages()
		return m, nil

	case errMsg:
		m.messages = append(m.messages, chatMessage{content: fmt.Sprintf("Error: %s", string(msg)), role: "system"})
		m.renderMessages()
		return m, nil

	case execMsg:
		content := string(msg.output)
		if msg.err != nil {
			content = fmt.Sprintf("Command failed: %v\n%s", msg.err, content)
		}
		m.messages = append(m.messages, chatMessage{content: "```\n" + content + "\n```", role: "system"})
		m.renderMessages()
		return m, nil

	case spoonMsg:
		m.statusBar.SpoonLevel = msg.level
		m.statusBar.SpoonLabel = msg.label
		return m, nil

	case mcpReadyMsg:
		if msg.err != nil {
			m.messages = append(m.messages, chatMessage{content: "MCP: " + msg.err.Error(), role: "system"})
		} else {
			m.mcpAgent = msg.agent
			m.statusBar.MeshStatus = "MCP:" + itoa(msg.agent.ToolCount()) + "tools"
			m.messages = append(m.messages, chatMessage{
				content: "MCP connected: " + itoa(msg.agent.ServerCount()) + " servers, " + itoa(msg.agent.ToolCount()) + " tools",
				role:    "system",
			})
		}
		m.renderMessages()
		return m, nil

	case clearMsg:
		m.messages = nil
		m.renderMessages()
		return m, nil

	case modelSwitchMsg:
		models := []string{"flash", "premium", "scavenger"}
		current := m.proxyModel
		nextIdx := 0
		for i, model := range models {
			if model == current {
				nextIdx = (i + 1) % len(models)
				break
			}
		}
		m.proxyModel = models[nextIdx]
		m.statusBar.Model = m.proxyModel
		m.messages = append(m.messages, chatMessage{content: "Switched to model: " + m.proxyModel, role: "system"})
		m.renderMessages()
		return m, nil
	}

	var tiCmd, vpCmd tea.Cmd
	m.textarea, tiCmd = m.textarea.Update(msg)
	m.viewport, vpCmd = m.viewport.Update(msg)
	cmds = append(cmds, tiCmd, vpCmd)

	return m, tea.Batch(cmds...)
}

func (m *chatModel) renderMessages() {
	if !m.ready {
		return
	}
	var b strings.Builder
	for _, msg := range m.messages {
		switch msg.role {
		case "user":
			b.WriteString(userStyle.Render("\n┃ " + msg.content) + "\n")
		case "assistant":
			b.WriteString(agentStyle.Render("\n" + msg.content) + "\n")
		case "system":
			b.WriteString(systemStyle.Render("\n" + msg.content) + "\n")
		case "tool_use":
			b.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("#f59e0b")).Render("\n🔧 " + msg.content) + "\n")
		case "tool_result":
			b.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("#a78bfa")).Render("\n📋 " + msg.content) + "\n")
		}
	}
	m.viewport.SetContent(b.String())
	m.viewport.GotoBottom()
}

func (m chatModel) View() string {
	if !m.ready {
		return "Initializing P31 Spatial Oasis..."
	}

	header := titleStyle.Render(" P31 // SPATIAL OASIS ")

	chatArea := lipgloss.JoinVertical(
		lipgloss.Top,
		header,
		m.viewport.View(),
		m.textarea.View(),
	)

	paletteView := m.palette.View()

	if m.palette.Visible {
		return lipgloss.JoinVertical(
			lipgloss.Center,
			chatArea,
			"\n",
			paletteView,
		)
	}

	statusBarView := m.statusBar.Render(m.width)
	return lipgloss.JoinVertical(
		lipgloss.Top,
		chatArea,
		statusBarView,
	)
}

type aiResponseMsg string
type errMsg string

func (m chatModel) sendToAI(prompt string) tea.Cmd {
	return func() tea.Msg {
		apiMessages := m.buildAPIMessages(prompt)
		maxIter := 10

		for iter := 0; iter < maxIter; iter++ {
			req := openai.ChatCompletionRequest{
				Model:    m.proxyModel,
				Messages: apiMessages,
			}

			if m.mcpAgent != nil {
				req.Tools = m.mcpAgent.Tools()
			}

			aiCtx, aiCancel := context.WithTimeout(context.Background(), 60*time.Second)
			resp, err := m.aiClient.CreateChatCompletion(aiCtx, req)
			aiCancel()
			if err != nil {
				return errMsg(err.Error())
			}
			if len(resp.Choices) == 0 {
				return errMsg("no response from model")
			}

			choice := resp.Choices[0]
			assistantMsg := choice.Message

			if len(assistantMsg.ToolCalls) == 0 {
				return aiResponseMsg(assistantMsg.Content)
			}

			apiMessages = append(apiMessages, assistantMsg)

			for _, tc := range assistantMsg.ToolCalls {
				toolCtx, toolCancel := context.WithTimeout(context.Background(), 30*time.Second)
				result, err := m.mcpAgent.CallTool(toolCtx, tc)
				toolCancel()
				if err != nil {
					result = fmt.Sprintf("Error: %v", err)
				}

				apiMessages = append(apiMessages, openai.ChatCompletionMessage{
					Role:       openai.ChatMessageRoleTool,
					ToolCallID: tc.ID,
					Content:    result,
				})
			}
		}

		return errMsg("tool call limit reached")
	}
}

func (m chatModel) buildAPIMessages(prompt string) []openai.ChatCompletionMessage {
	var apiMessages []openai.ChatCompletionMessage

	sysContent := `You are the P31 Spatial Oasis resident agent. You help the operator manage their sovereign infrastructure.
You have access to MCP tools for PHOS Forge (file management, deploy, cognitive state) and Google Workspace (calendar, contacts).
Use these tools when the operator asks about their files, projects, calendar, or to perform actions.`
	apiMessages = append(apiMessages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleSystem,
		Content: sysContent,
	})

	for _, msg := range m.messages {
		role := msg.role
		switch role {
		case "user":
			apiMessages = append(apiMessages, openai.ChatCompletionMessage{
				Role:    openai.ChatMessageRoleUser,
				Content: msg.content,
			})
		case "assistant":
			apiMessages = append(apiMessages, openai.ChatCompletionMessage{
				Role:    openai.ChatMessageRoleAssistant,
				Content: msg.content,
			})
		}
	}

	apiMessages = append(apiMessages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: prompt,
	})

	return apiMessages
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	return s
}

func (m chatModel) cleanup() {
	if m.mcpAgent != nil {
		m.mcpAgent.Close()
	}
}
