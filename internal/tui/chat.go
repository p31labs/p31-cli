package tui

import (
    "fmt"
    "strings"

    "github.com/charmbracelet/bubbles/textarea"
    "github.com/charmbracelet/bubbles/viewport"
    tea "github.com/charmbracelet/bubbletea"
    "github.com/charmbracelet/lipgloss"
    "github.com/p31labs/p31-cli/internal/api"
    "github.com/p31labs/p31-cli/internal/config"
)

type chatMsg struct {
    content string
    isUser  bool
}

type chatModel struct {
    messages  []chatMsg
    textarea  textarea.Model
    viewport  viewport.Model
    ready     bool
    ollama    *api.OllamaClient
}

func RunChat() error {
    cfg, err := config.Load()
    if err != nil {
        return err
    }
    ollama := api.NewOllamaClient(cfg.OllamaURL, cfg.DefaultModel)

    ta := textarea.New()
    ta.Placeholder = "Ask something..."
    ta.Focus()
    ta.CharLimit = 0
    ta.SetWidth(80)
    ta.SetHeight(3)

    m := chatModel{
        textarea: ta,
        ollama:   ollama,
        messages: []chatMsg{},
    }

    p := tea.NewProgram(m, tea.WithAltScreen())
    _, err = p.Run()
    return err
}

func (m chatModel) Init() tea.Cmd {
    return textarea.Blink
}

func (m chatModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    var cmds []tea.Cmd
    var cmd tea.Cmd

    switch msg := msg.(type) {
    case tea.WindowSizeMsg:
        m.viewport = viewport.New(msg.Width, msg.Height-6)
        m.viewport.YPosition = 2
        m.textarea.SetWidth(msg.Width)
        m.ready = true
        return m, nil

    case tea.KeyMsg:
        switch msg.String() {
        case "ctrl+c", "esc":
            return m, tea.Quit
        case "enter":
            if m.textarea.Value() != "" {
                userMsg := m.textarea.Value()
                m.messages = append(m.messages, chatMsg{content: userMsg, isUser: true})
                m.textarea.Reset()
                cmds = append(cmds, m.sendToLLM(userMsg))
            }
            return m, tea.Batch(cmds...)
        }
    }

    m.textarea, cmd = m.textarea.Update(msg)
    cmds = append(cmds, cmd)

    return m, tea.Batch(cmds...)
}

func (m chatModel) sendToLLM(prompt string) tea.Cmd {
    return func() tea.Msg {
        resp, err := m.ollama.Chat(prompt)
        if err != nil {
            return chatMsg{content: fmt.Sprintf("Error: %v", err), isUser: false}
        }
        return chatMsg{content: resp, isUser: false}
    }
}

func (m chatModel) View() string {
    if !m.ready {
        return "Loading..."
    }

    var content strings.Builder
    for _, msg := range m.messages {
        if msg.isUser {
            content.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("86")).Render("> " + msg.content))
        } else {
            content.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("39")).Render(msg.content))
        }
        content.WriteString("\n")
    }
    m.viewport.SetContent(content.String())

    header := lipgloss.NewStyle().Bold(true).Render("💬 P31 Chat (Ctrl+C to exit)")
    return lipgloss.JoinVertical(lipgloss.Top, header, m.viewport.View(), m.textarea.View())
}