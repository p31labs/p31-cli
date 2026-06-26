package tui

import (
    "fmt"
    "time"

    tea "github.com/charmbracelet/bubbletea"
    "github.com/charmbracelet/lipgloss"
    "github.com/p31labs/p31-cli/internal/api"
    "github.com/p31labs/p31-cli/internal/config"
)

type dashboardModel struct {
    status     string
    lastUpdate time.Time
    err        error
}

func RunDashboard() error {
    // Load config to ensure config file exists; ignore error handling beyond returning it
    _, err := config.Load()
    if err != nil {
        return err
    }
    m := dashboardModel{
        status:     "Loading mesh...",
        lastUpdate: time.Now(),
    }
    p := tea.NewProgram(m)
    _, err = p.Run()
    return err
}

func (m dashboardModel) Init() tea.Cmd {
    // Initial fetch and schedule periodic updates every 5 seconds
    return tea.Batch(
        m.fetchMeshStatus(),
        tea.Tick(5*time.Second, func(t time.Time) tea.Msg { return fetchMeshMsg{} }),
    )
}

type fetchMeshMsg struct{}

type meshStatusMsg string

func (m dashboardModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.KeyMsg:
        if msg.String() == "ctrl+c" || msg.String() == "q" {
            return m, tea.Quit
        }
    case fetchMeshMsg:
        // Trigger another fetch and schedule next tick
        return m, tea.Batch(
            m.fetchMeshStatus(),
            tea.Tick(5*time.Second, func(t time.Time) tea.Msg { return fetchMeshMsg{} }),
        )
    case meshStatusMsg:
        m.status = string(msg)
        m.lastUpdate = time.Now()
        return m, nil
    case error:
        m.err = msg
        return m, tea.Quit
    }
    return m, nil
}

func (m dashboardModel) fetchMeshStatus() tea.Cmd {
    return func() tea.Msg {
        cfg, err := config.Load()
        if err != nil {
            return err
        }
        client := api.NewK4Client(cfg.K4CageURL)
        mesh, err := client.GetMesh()
        if err != nil {
            return err
        }
        var out string
        for _, node := range mesh.Mesh.Vertices {
            out += fmt.Sprintf("%s (%d❤️) [%s]  ", node.Name, node.Love, node.Status)
        }
        return meshStatusMsg(out)
    }
}

func (m dashboardModel) View() string {
    header := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("39")).Render("📡 P31 Mesh Dashboard (q to quit)")
    if m.err != nil {
        errLine := lipgloss.NewStyle().Foreground(lipgloss.Color("1")).Render(fmt.Sprintf("Error: %v", m.err))
        return lipgloss.JoinVertical(lipgloss.Top, header, errLine)
    }
    statusLine := lipgloss.NewStyle().Foreground(lipgloss.Color("86")).Render(m.status)
    timestamp := lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Render("Last update: " + m.lastUpdate.Format("15:04:05"))
    return lipgloss.JoinVertical(lipgloss.Top, header, statusLine, timestamp)
}
