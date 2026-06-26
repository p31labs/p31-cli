package tui

import (
	"strconv"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

type StatusBar struct {
	SpoonLevel int
	SpoonLabel string
	Model      string
	MeshStatus string
	SessionID  string
}

var (
	barStyle     = lipgloss.NewStyle().Background(lipgloss.Color("#0f172a")).Padding(0, 1)
	spoonStyle   = lipgloss.NewStyle().Background(lipgloss.Color("#2dd4bf")).Foreground(lipgloss.Color("#0f172a")).Padding(0, 1).Bold(true)
	modelStyle   = lipgloss.NewStyle().Background(lipgloss.Color("#1e293b")).Foreground(lipgloss.Color("#39ff14")).Padding(0, 1)
	meshStyle    = lipgloss.NewStyle().Background(lipgloss.Color("#1e293b")).Foreground(lipgloss.Color("#94a3b8")).Padding(0, 1)
	hintStyle    = lipgloss.NewStyle().Background(lipgloss.Color("#0f172a")).Foreground(lipgloss.Color("#64748b")).Padding(0, 1)
	spoonColors  = []string{"#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e", "#39ff14"}
)

func (s StatusBar) Render(width int) string {
	if width < 40 {
		width = 40
	}

	spoonStr := s.SpoonLabel
	if spoonStr == "" {
		spoonStr = strconv.Itoa(s.SpoonLevel) + "/5"
	}
	spoonColor := spoonColors[s.SpoonLevel]
	if s.SpoonLevel >= len(spoonColors) {
		spoonColor = spoonColors[len(spoonColors)-1]
	}

	spoonBlock := lipgloss.NewStyle().
		Background(lipgloss.Color(spoonColor)).
		Foreground(lipgloss.Color("#0f172a")).
		Padding(0, 1).
		Bold(true).
		Render(" spoons:" + spoonStr)

	modelBlock := modelStyle.Render(" " + s.Model + " ")

	meshBlock := ""
	if s.MeshStatus != "" {
		meshBlock = meshStyle.Render(" " + s.MeshStatus + " ")
	}

	hints := hintStyle.Render(" Ctrl+P commands  Ctrl+S sessions  Ctrl+C quit ")

	left := spoonBlock + modelBlock + meshBlock
	right := hints

	spacer := width - lipgloss.Width(left) - lipgloss.Width(right)
	if spacer < 1 {
		spacer = 1
	}

	return barStyle.Render(left + strings.Repeat(" ", spacer) + right)
}
