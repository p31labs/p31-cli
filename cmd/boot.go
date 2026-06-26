package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/p31labs/p31-cli/internal/config"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(bootCmd)
}

var bootCmd = &cobra.Command{
	Use:   "boot",
	Short: "Execute P31 startup sequence",
	Long: `Staged boot banner + INIT/MESH/READY sequence.

  p31 boot                  # full ANSI boot (TTY) or short "ready" (CI / no-tty)
  P31_CLI_MINIMAL=1 p31 boot   # short ready only
  P31_CLI_PLAIN=1 p31 boot    # short ready only
  CI=true p31 boot            # short ready only`,
	RunE: runBoot,
}

func runBoot(cmd *cobra.Command, args []string) error {
	_, err := config.Load()
	if err != nil {
		return err
	}

	if !useFullBoot() {
		fmt.Println(dim("P31 CLI · ") + green("ready"))
		return nil
	}

	fmt.Print(renderBoot())
	return nil
}

func useFullBoot() bool {
	if os.Getenv("CI") == "true" {
		return false
	}
	if os.Getenv("P31_CLI_MINIMAL") == "1" {
		return false
	}
	if os.Getenv("P31_CLI_PLAIN") == "1" {
		return false
	}
	return isTerminal()
}

func isTerminal() bool {
	fileInfo, _ := os.Stdout.Stat()
	return (fileInfo.Mode() & os.ModeCharDevice) != 0
}

func renderBoot() string {
	var b strings.Builder

	b.WriteString("\033[2J\033[H")

	b.WriteString(colorize("35", "════════════════════════════════════════════════════════════") + "\n\n")
	b.WriteString(fmt.Sprintf("      %s\n", colorize("38;2;205;168;82", "⬡")))
	b.WriteString(colorize("35", "     /|\\") + "\n")
	b.WriteString(colorize("35", "    / | \\") + "\n")
	b.WriteString(colorize("35", "   /__|__\\") + "\n")
	b.WriteString(colorize("35", "  /\\  |  /\\") + "\n")
	b.WriteString(colorize("35", " /__\\_|_/__\\") + "\n\n")

	b.WriteString(colorize("35", "────────────────────────────────────────────────────────────") + "\n")

	wordmark := []string{
		"#####   #####      ##",
		"#   #       #       #",
		"#####   #####       #",
		"#           #       #",
		"#       #####   #####",
	}
	for _, line := range wordmark {
		b.WriteString(colorize("38;2;77;184;168", line) + "\n")
	}

	b.WriteString(colorize("35", "════════════════════════════════════════════════════════════\n"))
	b.WriteString(colorize("38;2;90;107;124", "local mesh · build · connect") + "\n\n")

	muted := "38;2;90;107;124"
	cyan := "38;2;77;184;168"
	b.WriteString(fmt.Sprintf("%s INIT %s·%s calibrating local mesh context\n",
		colorize(cyan, "INIT"), colorize(muted, "·"), ""))
	b.WriteString(fmt.Sprintf("%s MESH %s·%s K₄ topology · loopback bindings\n",
		colorize(cyan, "MESH"), colorize(muted, "·"), ""))
	b.WriteString(fmt.Sprintf("%sREADY %s·%s handoff to operator\n\n",
		colorize(cyan, "READY"), colorize(muted, "·"), ""))

	b.WriteString(colorize("38;2;59;163;114", "● online") + "\n\n")
	return b.String()
}
