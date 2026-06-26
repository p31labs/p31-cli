package tui

import (
	"strconv"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/sahilm/fuzzy"
)

type PaletteItem struct {
	Label    string
	Desc     string
	Keywords string
	Action   func() tea.Cmd
}

type CommandPalette struct {
	Visible  bool
	items    []PaletteItem
	filtered []PaletteItem
	input    textinput.Model
	cursor   int
	width    int
	height   int
}

var (
	paletteBorder  = lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("#2dd4bf")).Width(56)
	paletteTitle   = lipgloss.NewStyle().Foreground(lipgloss.Color("#2dd4bf")).Bold(true)
	paletteItem    = lipgloss.NewStyle().Padding(0, 2)
	paletteItemSel = lipgloss.NewStyle().Padding(0, 2).Background(lipgloss.Color("#2dd4bf")).Foreground(lipgloss.Color("#0f172a"))
	paletteDesc = lipgloss.NewStyle().Foreground(lipgloss.Color("#64748b"))
)

func NewCommandPalette(items []PaletteItem) CommandPalette {
	ti := textinput.New()
	ti.Placeholder = "Type a command..."
	ti.Focus()
	ti.CharLimit = 64
	ti.Width = 50
	ti.Prompt = "> "
	ti.TextStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#39ff14"))
	return CommandPalette{
		items:    items,
		filtered: items,
		input:    ti,
		cursor:   0,
		width:    60,
		height:   20,
	}
}

func (p *CommandPalette) Open() tea.Cmd {
	p.Visible = true
	p.input.SetValue("")
	p.input.Focus()
	p.filtered = p.items
	p.cursor = 0
	return textinput.Blink
}

func (p *CommandPalette) Close() {
	p.Visible = false
	p.input.Blur()
}

func (p *CommandPalette) Update(msg tea.Msg) (tea.Cmd, bool) {
	if !p.Visible {
		return nil, false
	}

	var cmd tea.Cmd
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyEsc:
			p.Close()
			return nil, true
		case tea.KeyDown:
			if p.cursor < len(p.filtered)-1 {
				p.cursor++
			}
			return nil, true
		case tea.KeyUp:
			if p.cursor > 0 {
				p.cursor--
			}
			return nil, true
		case tea.KeyEnter:
			if len(p.filtered) > 0 && p.cursor < len(p.filtered) {
				item := p.filtered[p.cursor]
				p.Close()
				if item.Action != nil {
					return item.Action(), true
				}
			}
			return nil, true
		default:
			p.input, cmd = p.input.Update(msg)
			p.filter()
			return cmd, true
		}
	}

	return nil, false
}

func (p *CommandPalette) filter() {
	val := p.input.Value()
	if val == "" {
		p.filtered = p.items
		p.cursor = 0
		return
	}

	searchTargets := make([]string, len(p.items))
	for i, item := range p.items {
		target := item.Label + " " + item.Keywords
		searchTargets[i] = strings.ToLower(target)
	}

	matches := fuzzy.Find(strings.ToLower(val), searchTargets)
	p.filtered = make([]PaletteItem, 0, len(matches))
	for _, m := range matches {
		p.filtered = append(p.filtered, p.items[m.Index])
	}
	if p.cursor >= len(p.filtered) {
		p.cursor = 0
	}
}

func (p *CommandPalette) View() string {
	if !p.Visible {
		return ""
	}

	body := strings.Builder{}
	body.WriteString(paletteTitle.Render("  P31 Commands") + "\n\n")
	body.WriteString(p.input.View() + "\n\n")

	maxShow := min(len(p.filtered), 10)
	for i := 0; i < maxShow; i++ {
		item := p.filtered[i]
		label := item.Label
		if len(label) > 20 {
			label = label[:20]
		}
		line := "  " + label
		if i == p.cursor {
			line = paletteItemSel.Render("  " + item.Label + "  ")
			line += paletteDesc.Render(" " + item.Desc)
		} else {
			line = paletteItem.Render("  " + item.Label)
			line += paletteDesc.Render(" " + item.Desc)
		}
		body.WriteString(line + "\n")
	}

	if len(p.filtered) > maxShow {
		body.WriteString(paletteDesc.Render("  ... " + strconv.Itoa(len(p.filtered)-maxShow) + " more"))
	}

	return paletteBorder.Render(body.String())
}


