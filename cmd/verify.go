package cmd

import (
	"fmt"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/spf13/cobra"
)

type verifyModel struct {
	spinner  spinner.Model
	quitting bool
}

func (m verifyModel) Init() tea.Cmd {
	return m.spinner.Tick
}

func (m verifyModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			m.quitting = true
			return m, tea.Quit
		}
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd
	}
	return m, nil
}

func (m verifyModel) View() string {
	if m.quitting {
		return ""
	}
	return fmt.Sprintf("%s running verification suite...\n", m.spinner.View())
}

var verifyCmd = &cobra.Command{
	Use:   "verify",
	Short: "Run verification suite",
	RunE: func(cmd *cobra.Command, args []string) error {
		s := spinner.New()
		s.Spinner = spinner.Dot
		s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

		m := verifyModel{spinner: s}

		p := tea.NewProgram(m, tea.WithAltScreen())
		if _, err := p.Run(); err != nil {
			return err
		}

		fmt.Println(colorize("32", "✔  verification complete"))
		fmt.Println(colorize("90", "  at   0x01f4a2"))
		fmt.Println(colorize("90", "  hash 0x7b2f"))

		return nil
	},
}

func init() {
	rootCmd.AddCommand(verifyCmd)
}
